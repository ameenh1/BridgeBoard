import type { ImageCandidate } from "./types.js";

export const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ValidatedImage = {
  data: Uint8Array;
  mimeType: ImageCandidate["mimeType"];
  width?: number;
  height?: number;
};

function startsWithBytes(data: Uint8Array, bytes: readonly number[]): boolean {
  return bytes.every((value, index) => data[index] === value);
}

export function detectImageMimeType(data: Uint8Array): ImageCandidate["mimeType"] | null {
  if (startsWithBytes(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (startsWithBytes(data, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (
    startsWithBytes(data, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithBytes(data.slice(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }

  return null;
}

export function validateImageBytes(
  data: Uint8Array,
  advertisedMimeType?: string,
  maxBytes = Number(process.env.AI_ASSET_MAX_BYTES ?? DEFAULT_MAX_IMAGE_BYTES)
): ValidatedImage | null {
  if (data.byteLength === 0 || data.byteLength > maxBytes) {
    return null;
  }

  const detected = detectImageMimeType(data);
  if (!detected || (advertisedMimeType && advertisedMimeType !== detected)) {
    return null;
  }

  return { data, mimeType: detected };
}

export function isAllowedImageUrl(urlString: string, allowedDomains: readonly string[]): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}
