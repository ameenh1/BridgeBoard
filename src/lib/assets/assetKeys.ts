import { createHash } from "node:crypto";

export const ASSET_STYLE_VERSION = "aac-flat-v1";

export function normalizeConcept(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createAssetKey(concept: string, locale = "en"): string {
  return createHash("sha256")
    .update(`${ASSET_STYLE_VERSION}|${locale}|${normalizeConcept(concept)}`)
    .digest("hex");
}

export function createDynamicChoiceId(concept: string): string {
  return `dynamic_${createHash("sha256").update(normalizeConcept(concept)).digest("hex").slice(0, 16)}`;
}
