import { z } from "zod";

const STORAGE_KEY = "bridgeboard.personalPhotos.v1";

/**
 * Caregiver-supplied photos, stored on the device and nowhere else.
 *
 * A generic illustration of a cup is not this person's cup. Being able to
 * point at *their* cup is a large part of what makes an AAC board feel like
 * it belongs to someone, and it is the one thing no image model can produce.
 *
 * These deliberately never reach the server. They are applied to a board in
 * the browser after it arrives, so a photo of a child's bedroom or their
 * medication never crosses the network, is never sent to an image provider,
 * and is not in any backup we control. That is also why they are not part of
 * the `RenderableBoard` the API returns.
 *
 * Every function here is total: storage may be unavailable, full, or hold
 * something written by an older build. Losing a photo is a disappointment;
 * throwing would take the board down with it.
 */

/** Photos are downscaled before they get here; this is a backstop. */
const MAX_PHOTO_BYTES = 400_000;

/** Enough to personalize a board without crowding out settings and history. */
const MAX_PHOTOS = 16;

export type PersonalPhoto = {
  /** The approved-vocabulary id this photo stands in for. */
  vocabularyId: string;
  /** A downscaled image as a data URL. */
  dataUrl: string;
  addedAt: string;
};

const PersonalPhotoSchema = z.object({
  vocabularyId: z.string().min(1).max(100),
  dataUrl: z
    .string()
    .max(MAX_PHOTO_BYTES)
    .regex(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/),
  addedAt: z.string().min(1),
});

const PersonalPhotosSchema = z.array(PersonalPhotoSchema);

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadPersonalPhotos(): PersonalPhoto[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = PersonalPhotosSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** A lookup keyed by vocabulary id, for applying photos to a board. */
export function personalPhotoMap(photos = loadPersonalPhotos()): Map<string, string> {
  return new Map(photos.map((photo) => [photo.vocabularyId, photo.dataUrl]));
}

/**
 * Adds or replaces the photo for one word. Returns the new list, or the
 * unchanged list when the photo is unusable or storage refuses it.
 */
export function savePersonalPhoto(
  vocabularyId: string,
  dataUrl: string,
): PersonalPhoto[] {
  const storage = getStorage();
  if (!storage) return loadPersonalPhotos();

  const candidate = { vocabularyId, dataUrl, addedAt: new Date().toISOString() };
  const valid = PersonalPhotoSchema.safeParse(candidate);
  if (!valid.success) {
    console.error("[photos] refusing to save", valid.error.issues[0]?.message);
    return loadPersonalPhotos();
  }

  const existing = loadPersonalPhotos().filter((p) => p.vocabularyId !== vocabularyId);
  if (existing.length >= MAX_PHOTOS) {
    console.error("[photos] limit reached");
    return loadPersonalPhotos();
  }

  const next = [...existing, valid.data];
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch (error) {
    // Quota exceeded. The previous photos are still there and still work.
    console.error("[photos] save failed", error);
    return loadPersonalPhotos();
  }
}

export function removePersonalPhoto(vocabularyId: string): PersonalPhoto[] {
  const storage = getStorage();
  if (!storage) return [];
  const next = loadPersonalPhotos().filter((p) => p.vocabularyId !== vocabularyId);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("[photos] remove failed", error);
  }
  return next;
}

export function clearPersonalPhotos(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("[photos] clear failed", error);
  }
}

export const PERSONAL_PHOTO_LIMIT = MAX_PHOTOS;
