// Server orchestration module. Browser callers should use the event contract,
// not import OpenAI or Supabase implementation modules.
import { IMAGE_MANIFEST } from "../../data/imageManifest.js";
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
};

export type ResolveVisualAssetsResult = {
  classification: Awaited<ReturnType<typeof classifyQuestion>>;
  requests: VisualAssetRequest[];
  pending: Promise<void>;
};

function fallbackResolution(request: VisualAssetRequest): AssetResolution {
  return {
    assetKey: request.cacheKey,
    vocabularyId: request.vocabularyId,
    status: "fallback",
    source: "placeholder",
    assetUrl: IMAGE_MANIFEST[request.vocabularyId] ?? "/default-images/placeholder.svg"
  };
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

  const candidatePromises = [
    Promise.resolve().then(() => providers.discoverWebImage(request)),
    Promise.resolve().then(() => providers.generateImage(request))
  ];

  // Start both providers concurrently. The allSettled call ensures every
  // provider is observed even after the first valid candidate wins.
  const allProvidersSettled = Promise.allSettled(candidatePromises);
  const candidate = await firstValidCandidate(candidatePromises);

  if (!candidate) {
    await allProvidersSettled;
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
        status: "ready",
        source: record.source,
        assetUrl: record.assetUrl,
        attribution: record.attribution
      }
    });
    // Do not delay the ready event for the slower provider, but keep awaiting
    // it so the returned pending promise represents complete background work.
    await allProvidersSettled;
  } catch (error) {
    await allProvidersSettled;
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
    styleVersion: options.styleVersion
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
          status: "ready",
          source: "local",
          assetUrl: localRecord.assetUrl,
          attribution: localRecord.attribution
        }
      });
      continue;
    }

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
          status: "ready",
          source: "supabase",
          assetUrl: sharedRecord.assetUrl,
          attribution: sharedRecord.attribution
        }
      });
      continue;
    }

    emit(options, { type: "fallback", resolution: fallback });
    pendingWork.push(resolveMiss(request, { ...options, localCache }, fallback));
  }

  return {
    classification,
    requests,
    pending: Promise.all(pendingWork).then(() => undefined)
  };
}
