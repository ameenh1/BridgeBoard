import type { ChildProfile } from "@/types/profile";
import { DEFAULT_PROFILE } from "@/types/profile";
import { ChildProfileSchema } from "@/lib/validation/profileSchema";

const STORAGE_KEY = "bridgeboard.profile.v1";

/**
 * Caregiver settings, persisted locally.
 *
 * Every function here is total: nothing throws, ever. Storage can be
 * unavailable (private browsing, blocked cookies, SSR), corrupted, or written
 * by an older build with a different shape. In all of those cases a
 * communicator still gets a working app with sensible defaults — losing a
 * preference is an inconvenience, losing the board is not.
 */

function getStorage(): Storage | null {
  try {
    // Guards SSR, where `localStorage` does not exist at all.
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Accessing localStorage throws outright when site data is blocked.
    return null;
  }
}

/** Returns stored settings, or `DEFAULT_PROFILE` if anything is wrong. */
export function loadSettings(): ChildProfile {
  const storage = getStorage();
  if (!storage) return DEFAULT_PROFILE;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_PROFILE;
  }

  if (!raw) return DEFAULT_PROFILE;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupted JSON. Defaults, not a crash.
    return DEFAULT_PROFILE;
  }

  const result = ChildProfileSchema.safeParse(parsed);
  if (!result.success) {
    // Valid JSON of the wrong shape — likely an older schema.
    return DEFAULT_PROFILE;
  }

  return result.data;
}

/** Persists settings. Silently no-ops when storage is unavailable or full. */
export function saveSettings(profile: ChildProfile): void {
  const storage = getStorage();
  if (!storage) return;

  // Validate on the way out too, so a bad value never becomes tomorrow's
  // corrupted read.
  const result = ChildProfileSchema.safeParse(profile);
  if (!result.success) {
    console.error("[settings] refusing to save invalid profile", result.error.issues);
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(result.data));
  } catch (error) {
    // Quota exceeded, or storage disabled mid-session.
    console.error("[settings] save failed", error);
  }
}

export function clearSettings(): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("[settings] clear failed", error);
  }
}

/** Applies a partial change and persists the result. Returns the new profile. */
export function updateSettings(patch: Partial<ChildProfile>): ChildProfile {
  const next = { ...loadSettings(), ...patch };
  saveSettings(next);
  return next;
}
