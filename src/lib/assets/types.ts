import type { VisualSource } from "@/types/board";

export type VisualAssetRequest = {
  boardId: string;
  choiceId: string;
  assetKey: string;
  label: string;
  normalizedConcept: string;
  locale: string;
  styleVersion: string;
  webSearchQuery: string;
  generationPrompt: string;
};

export type AssetStreamGrant = {
  version: 1;
  boardId: string;
  expiresAt: number;
  requests: VisualAssetRequest[];
};

export type ImageCandidate = {
  source: "web" | "generated";
  data: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  sourceUrl?: string;
  attribution?: string;
  width?: number;
  height?: number;
};

export type AssetRecord = {
  assetKey: string;
  choiceId: string;
  source: VisualSource;
  url: string;
  /** When present, the URL is only safe to reuse until this time. */
  expiresAt?: number;
  objectPath?: string;
  sourceUrl?: string;
  attribution?: string;
  mimeType: string;
  width?: number;
  height?: number;
  byteSize?: number;
  sha256?: string;
};

export type AssetResolution = {
  boardId: string;
  choiceId: string;
  assetKey: string;
  status: "ready" | "unavailable";
  source?: VisualSource;
  url?: string;
  sourceUrl?: string;
  attribution?: string;
};

export type AssetStreamEvent =
  | ({ type: "asset.ready" } & AssetResolution & { status: "ready" })
  | ({ type: "asset.unavailable" } & AssetResolution & { status: "unavailable" })
  | { type: "complete"; boardId: string };

export type AssetCache = {
  get(assetKey: string): Promise<AssetRecord | null>;
  put(record: AssetRecord): Promise<void>;
};

export type SharedAssetCache = AssetCache & {
  saveCandidate(request: VisualAssetRequest, candidate: ImageCandidate): Promise<AssetRecord>;
};

export type AssetProviders = {
  discoverWebImage(request: VisualAssetRequest, signal: AbortSignal): Promise<ImageCandidate | null>;
  generateImage(request: VisualAssetRequest, signal: AbortSignal): Promise<ImageCandidate | null>;
};

export type AssetContentPolicy = (
  request: VisualAssetRequest,
  candidate: ImageCandidate,
) => Promise<boolean>;
