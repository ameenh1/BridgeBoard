"use client";

/**
 * Shrinks a camera photo to something a board can hold.
 *
 * A phone photo is 3-8 MB. localStorage gives roughly 5 MB for everything,
 * shared with settings and history, so an untouched photo would blow the
 * quota on the first save and could take the caregiver's settings with it.
 *
 * Tiles render at about 150px, so 512px is already generous for a 2x screen.
 * Done on a canvas in the browser: the photo is never uploaded to be
 * processed, which is the entire point of keeping it on the device.
 */

const MAX_EDGE = 512;
const QUALITY = 0.82;

/** Rejects anything that is not an image before it ever reaches a canvas. */
export function isSupportedPhoto(file: File): boolean {
  return /^image\/(png|jpeg|webp|heic|heif)$/i.test(file.type);
}

export async function downscalePhotoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.drawImage(bitmap, 0, 0, width, height);

    // WebP where supported; a browser that cannot encode it returns a PNG
    // data URL from toDataURL, which the storage schema also accepts.
    const encoded = canvas.toDataURL("image/webp", QUALITY);
    if (encoded.startsWith("data:image/webp")) return encoded;
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}
