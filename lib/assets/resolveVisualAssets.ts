// Server orchestration module. Browser callers should use the event contract,
// not import OpenAI or Supabase implementation modules.
import {
  IMAGE_MANIFEST,
  VERIFIED_LOCAL_IMAGE_MANIFEST
} from "../../data/imageManifest.js";
import {
  APPROVED_VOCABULARY,
  type ApprovedVocabularyItem
} from "../../data/approvedVocabulary.js";
import { classifyQuestion, type ClassifyQuestionOptions } from "../ai/classifyQuestion.js";
import { validateImageBytes } from "./imageValidation.js";
import { buildVisualAssetRequests } from "./visualRequests.js";
import { createNoopAssetCache } from "./cache.js";
import type {
  AssetCache,
  AssetProviders,
  AssetRecord,
  AssetResolution,
  AssetResolutionEvent,
  AssetSearchMode,
  ImageCandidate,
  SharedAssetCache,
  VisualAssetRequest
} from "./types.js";

export type ResolveVisualAssetsOptions = {
  transcript: string;
  recentContext?: readonly string[];
  vocabulary?: readonly ApprovedVocabularyItem[];
  classifyOptions?: Omit<ClassifyQuestionOptions, "approvedVocabulary" | "recentContext">;
  localCache?: AssetCache;
  sharedCache?: SharedAssetCache;
  providers?: AssetProviders;
  onEvent?: (event: AssetResolutionEvent) => void;
  locale?: string;
  styleVersion?: string;
  maxVisualAssets?: number;
  assetSearchMode?: AssetSearchMode;
};

export type ResolveVisualAssetsResult = {
  classification: Awaited<ReturnType<typeof classifyQuestion>>;
  requests: VisualAssetRequest[];
  pending: Promise<void>;
};

function fallbackResolution(request: VisualAssetRequest): AssetResolution {
  const assetUrl = IMAGE_MANIFEST[request.vocabularyId] ?? "/default-images/placeholder.svg";
  return {
    assetKey: request.cacheKey,
    vocabularyId: request.vocabularyId,
    label: request.displayLabel,
    status: "fallback",
    source: assetUrl === "/default-images/placeholder.svg" ? "placeholder" : "local",
    assetUrl
  };
}

function verifiedLocalResolution(request: VisualAssetRequest): AssetResolution | null {
  const assetUrl = VERIFIED_LOCAL_IMAGE_MANIFEST[request.vocabularyId];
  return assetUrl
    ? {
        assetKey: request.cacheKey,
        vocabularyId: request.vocabularyId,
        label: request.displayLabel,
        status: "ready",
        source: "local",
        assetUrl
      }
    : null;
}

function emit(options: ResolveVisualAssetsOptions, event: AssetResolutionEvent): void {
  try {
    options.onEvent?.(event);
  } catch (error) {
    console.error("BridgeBoard asset event handler failed.", error);
  }
}

function candidateToDataUrl(candidate: ImageCandidate): string {
  return `data:${candidate.mimeType};base64,${Buffer.from(candidate.data).toString("base64")}`;
}

async function firstValidCandidate(promises: readonly Promise<ImageCandidate | null>[]): Promise<ImageCandidate | null> {
  return new Promise((resolve) => {
    let remaining = promises.length;
    let settled = false;

    if (remaining === 0) {
      resolve(null);
      return;
    }

    for (const promise of promises) {
      promise
        .then((candidate) => {
          if (candidate && !settled) {
            settled = true;
            resolve(candidate);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          remaining -= 1;
          if (remaining === 0 && !settled) {
            settled = true;
            resolve(null);
          }
        });
    }
  });
}

async function resolveMiss(
  request: VisualAssetRequest,
  options: ResolveVisualAssetsOptions,
  fallback: AssetResolution
): Promise<void> {
  const providers = options.providers;
  if (!providers) {
    emit(options, {
      type: "error",
      resolution: { ...fallback, status: "error", error: "No asset providers configured." }
    });
    return;
  }

  const searchMode = resolveAssetSearchMode(options.assetSearchMode);
  const providerResult = await findProviderCandidate(request, providers, searchMode);
  const candidate = providerResult.candidate;

  if (!candidate) {
    emit(options, {
      type: "error",
      resolution: { ...fallback, status: "error", error: "Web discovery and image generation returned no valid asset." }
    });
    return;
  }

  const validated = validateImageBytes(candidate.data, candidate.mimeType);
  if (!validated) {
    emit(options, {
      type: "error",
      resolution: { ...fallback, status: "error", error: "The winning asset failed image validation." }
    });
    return;
  }

  try {
    const record: AssetRecord = options.sharedCache
      ? await options.sharedCache.saveCandidate(request, {
          ...candidate,
          data: validated.data,
          mimeType: validated.mimeType
        })
      : {
          cacheKey: request.cacheKey,
          vocabularyId: request.vocabularyId,
          source: candidate.source,
          assetUrl: candidateToDataUrl(candidate),
          sourceUrl: candidate.sourceUrl,
          attribution: candidate.attribution,
          promptVersion: request.styleVersion,
          mimeType: validated.mimeType,
          byteSize: validated.data.byteLength
        };

    await options.localCache?.put(record);
    emit(options, {
      type: "ready",
      resolution: {
        assetKey: request.cacheKey,
        vocabularyId: request.vocabularyId,
        label: request.displayLabel,
        status: "ready",
        source: record.source,
        assetUrl: record.assetUrl,
        sourceUrl: record.sourceUrl,
        attribution: record.attribution
      }
    });
    // In parallel mode the slower provider is observed in the background, but
    // the ready event above is emitted as soon as the first valid candidate is cached.
    await providerResult.allProvidersSettled;
  } catch (error) {
    await providerResult.allProvidersSettled;
    emit(options, {
      type: "error",
      resolution: {
        ...fallback,
        status: "error",
        error: error instanceof Error ? error.message : "The winning asset could not be cached."
      }
    });
  }
}

function resolveAssetSearchMode(configured?: AssetSearchMode): AssetSearchMode {
  const value = configured ?? process.env.AI_ASSET_SEARCH_MODE ?? "generation_first";
  return value === "parallel" || value === "generation_first" || value === "web_first" || value === "off"
    ? value
    : "generation_first";
}

async function safeProviderCall(
  name: string,
  callback: () => Promise<ImageCandidate | null>
): Promise<ImageCandidate | null> {
  try {
    return await callback();
  } catch (error) {
    console.error(`${name} asset provider failed.`, error);
    return null;
  }
}

async function findProviderCandidate(
  request: VisualAssetRequest,
  providers: AssetProviders,
  mode: AssetSearchMode
): Promise<{ candidate: ImageCandidate | null; allProvidersSettled: Promise<unknown> }> {
  if (mode === "off") {
    return { candidate: null, allProvidersSettled: Promise.resolve() };
  }

  if (mode === "generation_first") {
    const generated = await safeProviderCall("Image generation", () => providers.generateImage(request));
    if (generated) {
      return { candidate: generated, allProvidersSettled: Promise.resolve() };
    }

    const web = await safeProviderCall("Web discovery", () => providers.discoverWebImage(request));
    return { candidate: web, allProvidersSettled: Promise.resolve() };
  }

  if (mode === "web_first") {
    const web = await safeProviderCall("Web discovery", () => providers.discoverWebImage(request));
    if (web) {
      return { candidate: web, allProvidersSettled: Promise.resolve() };
    }

    const generated = await safeProviderCall("Image generation", () => providers.generateImage(request));
    return { candidate: generated, allProvidersSettled: Promise.resolve() };
  }

  const candidatePromises = [
    safeProviderCall("Web discovery", () => providers.discoverWebImage(request)),
    safeProviderCall("Image generation", () => providers.generateImage(request))
  ];
  const allProvidersSettled = Promise.allSettled(candidatePromises);
  return {
    candidate: await firstValidCandidate(candidatePromises),
    allProvidersSettled
  };
}

export async function resolveVisualAssets(
  options: ResolveVisualAssetsOptions
): Promise<ResolveVisualAssetsResult> {
  const vocabulary = options.vocabulary ?? APPROVED_VOCABULARY;
  const classification = await classifyQuestion(options.transcript, {
    ...options.classifyOptions,
    approvedVocabulary: vocabulary,
    recentContext: options.recentContext
  });
  const requests = buildVisualAssetRequests(classification, {
    vocabulary,
    locale: options.locale,
    styleVersion: options.styleVersion,
    maxVisualAssets: options.maxVisualAssets ?? Number(process.env.AI_MAX_VISUAL_ASSETS ?? 8)
  });
  const localCache = options.localCache ?? createNoopAssetCache();
  const pendingWork: Promise<void>[] = [];

  for (const request of requests) {
    const fallback = fallbackResolution(request);
    const localRecord = await localCache.get(request.cacheKey).catch((error) => {
      console.error("Local asset cache lookup failed; continuing with shared cache.", error);
      return null;
    });
    if (localRecord) {
      emit(options, {
        type: "ready",
        resolution: {
          assetKey: request.cacheKey,
          vocabularyId: request.vocabularyId,
          label: request.displayLabel,
          status: "ready",
          source: localRecord.source,
          assetUrl: localRecord.assetUrl,
          sourceUrl: localRecord.sourceUrl,
          attribution: localRecord.attribution
        }
      });
      continue;
    }

    const localVerified = verifiedLocalResolution(request);
    if (localVerified) {
      emit(options, { type: "ready", resolution: localVerified });
      continue;
    }

    // Paint the local symbol before waiting on a network-backed shared cache.
    // The shared lookup and both AI providers remain background work.
    emit(options, { type: "fallback", resolution: fallback });

    const sharedRecord = options.sharedCache
      ? await options.sharedCache.get(request.cacheKey).catch((error) => {
          console.error("Shared asset cache lookup failed; continuing with fallback.", error);
          return null;
        })
      : null;
    if (sharedRecord) {
      await localCache.put({ ...sharedRecord, source: "local" }).catch(() => undefined);
      emit(options, {
        type: "ready",
        resolution: {
          assetKey: request.cacheKey,
          vocabularyId: request.vocabularyId,
          label: request.displayLabel,
          status: "ready",
          source: "supabase",
          assetUrl: sharedRecord.assetUrl,
          sourceUrl: sharedRecord.sourceUrl,
          attribution: sharedRecord.attribution
        }
      });
      continue;
    }

    pendingWork.push(resolveMiss(request, { ...options, localCache }, fallback));
  }

  return {
    classification,
    requests,
    pending: Promise.all(pendingWork).then(() => undefined)
  };
}
