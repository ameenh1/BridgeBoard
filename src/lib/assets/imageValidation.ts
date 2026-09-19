import "server-only";
import sharp from "sharp";
import type { ImageCandidate } from "./types";

export const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 768 * 1024;

function startsWith(data: Uint8Array, bytes: readonly number[]): boolean {
  return bytes.every((value, index) => data[index] === value);
}

export function detectImageMimeType(data: Uint8Array): ImageCandidate["mimeType"] | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(data, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    startsWith(data, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(data.slice(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  return null;
}

export function isAllowedImageUrl(value: string, domains: readonly string[]): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export async function readBoundedBody(
  response: Response,
  maxBytes = Number(process.env.AI_ASSET_MAX_BYTES ?? DEFAULT_MAX_IMAGE_BYTES),
): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export async function normalizeImageCandidate(
  candidate: ImageCandidate,
): Promise<ImageCandidate | null> {
  const maxInput = Number(process.env.AI_ASSET_MAX_BYTES ?? DEFAULT_MAX_IMAGE_BYTES);
  if (candidate.data.byteLength === 0 || candidate.data.byteLength > maxInput) return null;
  const detected = detectImageMimeType(candidate.data);
  if (!detected || detected !== candidate.mimeType) return null;

  try {
    const source = sharp(candidate.data, {
      failOn: "warning",
      limitInputPixels: 16_777_216,
    }).rotate();
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height) return null;

    const maxOutput = Number(process.env.AI_ASSET_OUTPUT_MAX_BYTES ?? DEFAULT_MAX_OUTPUT_BYTES);
    for (const [width, quality] of [[1024, 82], [768, 74], [512, 68]] as const) {
      const data = await source
        .clone()
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      if (data.byteLength <= maxOutput) {
        const output = await sharp(data).metadata();
        return {
          ...candidate,
          data: new Uint8Array(data),
          mimeType: "image/webp",
          width: output.width,
          height: output.height,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}
