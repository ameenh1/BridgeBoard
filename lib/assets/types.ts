import type { ApprovedVocabularyItem } from "../../data/approvedVocabulary.js";

export type AssetSource = "local" | "supabase" | "web" | "generated" | "placeholder";
export type AssetStatus = "pending" | "ready" | "fallback" | "error";

export type VisualAssetRequest = {
  vocabularyId: string;
  normalizedConcept: string;
  cacheKey: string;
  webSearchQuery: string;
  imageGenerationPrompt: string;
  styleVersion: string;
  locale: string;
};

export type ImageCandidate = {
  source: "web" | "generated";
  data: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  sourceUrl?: string;
  attribution?: string;
};

export type AssetRecord = {
  cacheKey: string;
  vocabularyId: string;
  source: AssetSource;
  assetUrl: string;
  objectPath?: string;
  sourceUrl?: string;
  attribution?: string;
  promptVersion: string;
  mimeType: string;
  width?: number;
  height?: number;
  byteSize?: number;
  sha256?: string;
  expiresAt?: string;
};

export type AssetResolution = {
  assetKey: string;
  vocabularyId: string;
  status: AssetStatus;
  source: AssetSource;
  assetUrl: string;
  sourceUrl?: string;
  attribution?: string;
  error?: string;
};

export type AssetResolutionEvent =
  | { type: "fallback"; resolution: AssetResolution }
  | { type: "ready"; resolution: AssetResolution }
  | { type: "error"; resolution: AssetResolution };

export type AssetCache = {
  get(cacheKey: string): Promise<AssetRecord | null>;
  put(record: AssetRecord): Promise<void>;
};

export type SharedAssetCache = AssetCache & {
  saveCandidate(
    request: VisualAssetRequest,
    candidate: ImageCandidate
  ): Promise<AssetRecord>;
};

export type AssetProviders = {
  discoverWebImage(request: VisualAssetRequest): Promise<ImageCandidate | null>;
  generateImage(request: VisualAssetRequest): Promise<ImageCandidate | null>;
};

export type BuildVisualRequestOptions = {
  locale?: string;
  styleVersion?: string;
  vocabulary?: readonly ApprovedVocabularyItem[];
};
