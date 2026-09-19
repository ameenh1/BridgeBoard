"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { approvedVocabulary } from "@/lib/vocabulary/approvedVocabulary";
import { downscalePhotoToDataUrl, isSupportedPhoto } from "@/lib/images/downscalePhoto";
import {
  PERSONAL_PHOTO_LIMIT,
  removePersonalPhoto,
  savePersonalPhoto,
  type PersonalPhoto,
} from "@/lib/storage/personalPhotos";
import { imageExists } from "@/lib/images/imageManifest";
import { ChoiceIcon } from "./icons";

/**
 * Attach a photo of the real thing to a word.
 *
 * Words the AI is allowed to propose come first, because those are the ones a
 * photo changes most: a generated picture of "a cup" is generic by
 * definition, and this is how it becomes *their* cup.
 */
export function PhotosScreen({
  photos,
  onChange,
}: {
  photos: PersonalPhoto[];
  onChange: (next: PersonalPhoto[]) => void;
}) {
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const targetId = useRef<string>("");

  const byId = new Map(photos.map((photo) => [photo.vocabularyId, photo.dataUrl]));
  const items = [...approvedVocabulary].sort((a, b) => {
    const has = (id: string) => (byId.has(id) ? 0 : 1);
    return has(a.id) - has(b.id) || Number(b.allowedForAI) - Number(a.allowedForAI)
      || a.label.localeCompare(b.label);
  });

  function pick(vocabularyId: string) {
    setError(undefined);
    targetId.current = vocabularyId;
    inputRef.current?.click();
  }

  async function handleFile(file: File | undefined) {
    const vocabularyId = targetId.current;
    if (!file || !vocabularyId) return;
    if (!isSupportedPhoto(file)) {
      setError("That file is not an image.");
      return;
    }

    setPendingId(vocabularyId);
    try {
      const dataUrl = await downscalePhotoToDataUrl(file);
      const next = savePersonalPhoto(vocabularyId, dataUrl);
      if (!next.some((photo) => photo.vocabularyId === vocabularyId)) {
        setError(
          photos.length >= PERSONAL_PHOTO_LIMIT
            ? `That is the maximum of ${PERSONAL_PHOTO_LIMIT} photos. Remove one first.`
            : "That photo could not be saved on this device.",
        );
        return;
      }
      onChange(next);
    } catch {
      setError("That photo could not be read.");
    } finally {
      setPendingId(undefined);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="simple-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Caregiver</span>
          <h1>Personal photos</h1>
          <p>
            Use a photo of the real thing instead of a drawing. Photos stay on
            this device — they are never uploaded, never sent to the AI, and
            are not part of any board the server sees.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {error ? (
        <p className="inline-alert" role="alert">
          {error}
        </p>
      ) : null}

      <p className="photo-count">
        {photos.length} of {PERSONAL_PHOTO_LIMIT} photos used
      </p>

      <div className="photo-grid">
        {items.map((item) => {
          const dataUrl = byId.get(item.id);
          const bundled = item.imageUrl && imageExists(item.imageUrl) ? item.imageUrl : undefined;
          const busy = pendingId === item.id;

          return (
            <div className={`photo-row${dataUrl ? " has-photo" : ""}`} key={item.id}>
              <span className="photo-thumb">
                {dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dataUrl} alt="" />
                ) : bundled ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bundled} alt="" className="is-generic" />
                ) : (
                  <ChoiceIcon iconKey={item.iconKey} size={28} />
                )}
              </span>

              <span className="photo-label">
                <strong>{item.label}</strong>
                <small>{dataUrl ? "Your photo" : bundled ? "Drawing" : "Symbol"}</small>
              </span>

              <span className="photo-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => pick(item.id)}
                >
                  <Camera aria-hidden="true" size={16} />
                  {busy ? "Saving…" : dataUrl ? "Replace" : "Add photo"}
                  <span className="sr-only"> for {item.label}</span>
                </button>
                {dataUrl ? (
                  <button
                    className="danger-button photo-remove"
                    type="button"
                    onClick={() => onChange(removePersonalPhoto(item.id))}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                    <span className="sr-only">Remove photo for {item.label}</span>
                  </button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
