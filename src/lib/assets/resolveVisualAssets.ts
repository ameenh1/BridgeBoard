import "server-only";
import { processAssetCache } from "./cache";
import { MAX_AI_VISUAL_ASSETS } from "./visualRequests";
import type {
  AssetContentPolicy,
  AssetProviders,
  AssetRecord,
  AssetResolution,
  ImageCandidate,
  SharedAssetCache,
  VisualAssetRequest,
} from "./types";

type ResolverOptions = {
  providers: AssetProviders;
  sharedCache?: SharedAssetCache;
  contentPolicy?: AssetContentPolicy;
  signal: AbortSignal;
};

type InflightEntry = {
  controller: AbortController;
  subscribers: number;
  promise: Promise<AssetRecord | null>;
};

const inflight = new Map<string, InflightEntry>();

function toResolution(
  request: VisualAssetRequest,
  record: AssetRecord | null,
): AssetResolution {
  if (!record) {
    return {
      boardId: request.boardId,
      choiceId: request.choiceId,
      assetKey: request.assetKey,
      status: "unavailable",
    };
  }
  return {
    boardId: request.boardId,
    choiceId: request.choiceId,
    assetKey: request.assetKey,
    status: "ready",
    source: record.source,
    url: record.url,
    sourceUrl: record.sourceUrl,
    attribution: record.attribution,
  };
}

function transientRecord(request: VisualAssetRequest, candidate: ImageCandidate): AssetRecord {
  return {
    assetKey: request.assetKey,
    choiceId: request.choiceId,
    source: candidate.source,
    url: `data:${candidate.mimeType};base64,${Buffer.from(candidate.data).toString("base64")}`,
    sourceUrl: candidate.sourceUrl,
    attribution: candidate.attribution,
    mimeType: candidate.mimeType,
    width: candidate.width,
    height: candidate.height,
    byteSize: candidate.data.byteLength,
  };
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timeout = setTimeout(() => reject(new Error("timeout")), milliseconds);
      timeout.unref?.();
    }),
  ]);
}

async function providerCandidate(
  request: VisualAssetRequest,
  providers: AssetProviders,
  signal: AbortSignal,
): Promise<ImageCandidate | null> {
  const webController = new AbortController();
  const generationController = new AbortController();
  const abortAll = () => {
    webController.abort();
    generationController.abort();
  };
  signal.addEventListener("abort", abortAll, { once: true });

  const calls = [
    providers
      .discoverWebImage(
        request,
        AbortSignal.any([webController.signal, AbortSignal.timeout(15_000)]),
      )
      .then((candidate) => ({ candidate, loser: generationController }))
      .catch(() => ({ candidate: null, loser: generationController })),
    providers
      .generateImage(
        request,
        AbortSignal.any([generationController.signal, AbortSignal.timeout(45_000)]),
      )
      .then((candidate) => ({ candidate, loser: webController }))
      .catch(() => ({ candidate: null, loser: webController })),
  ];

  try {
    return await new Promise<ImageCandidate | null>((resolve) => {
      let remaining = calls.length;
      let settled = false;
      for (const call of calls) {
        void call.then(({ candidate, loser }) => {
          if (candidate && !settled) {
            settled = true;
            loser.abort();
            resolve(candidate);
          }
          remaining -= 1;
          if (remaining === 0 && !settled) resolve(null);
        });
      }
    });
  } finally {
    signal.removeEventListener("abort", abortAll);
  }
}

async function resolveUncached(
  request: VisualAssetRequest,
  options: Omit<ResolverOptions, "signal">,
  signal: AbortSignal,
): Promise<AssetRecord | null> {
  const hot = await processAssetCache.get(request.assetKey);
  if (hot) return hot;

  if (options.sharedCache) {
    try {
      const shared = await withTimeout(options.sharedCache.get(request.assetKey), 1_500);
      if (shared) {
        await processAssetCache.put(shared);
        return shared;
      }
    } catch (error) {
      console.warn("[asset-resolver] shared cache lookup failed", error instanceof Error ? error.message : "unknown");
    }
  }
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  const candidate = await providerCandidate(request, options.providers, signal);
  if (!candidate) return null;
  const allowed = await (options.contentPolicy?.(request, candidate) ?? Promise.resolve(true));
  if (!allowed) return null;

  let record = transientRecord(request, candidate);
  if (options.sharedCache) {
    try {
      record = await options.sharedCache.saveCandidate(request, candidate);
    } catch (error) {
      console.warn("[asset-resolver] shared cache write failed", error instanceof Error ? error.message : "unknown");
    }
  }
  await processAssetCache.put(record);
  return record;
}

function subscribeInflight(
  request: VisualAssetRequest,
  options: ResolverOptions,
): Promise<AssetRecord | null> {
  let entry = inflight.get(request.assetKey);
  if (!entry) {
    const controller = new AbortController();
    const promise = resolveUncached(request, options, controller.signal).finally(() => {
      inflight.delete(request.assetKey);
    });
    entry = { controller, subscribers: 0, promise };
    inflight.set(request.assetKey, entry);
  }
  entry.subscribers += 1;

  return new Promise((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      options.signal.removeEventListener("abort", onAbort);
      entry!.subscribers -= 1;
      if (entry!.subscribers === 0 && inflight.get(request.assetKey) === entry) {
        entry!.controller.abort();
      }
    };
    const onAbort = () => {
      release();
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (options.signal.aborted) {
      onAbort();
      return;
    }
    options.signal.addEventListener("abort", onAbort, { once: true });
    entry!.promise.then(resolve, reject).finally(release);
  });
}

export async function resolveVisualAsset(
  request: VisualAssetRequest,
  options: ResolverOptions,
): Promise<AssetResolution> {
  try {
    return toResolution(request, await subscribeInflight(request, options));
  } catch (error) {
    if (options.signal.aborted) throw error;
    console.warn("[asset-resolver] resolution failed", error instanceof Error ? error.message : "unknown");
    return toResolution(request, null);
  }
}

export async function resolveAssetBatch(
  requests: readonly VisualAssetRequest[],
  options: ResolverOptions & {
    concurrency?: number;
    onResolution: (resolution: AssetResolution) => void;
  },
): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (!options.signal.aborted) {
      const index = cursor;
      cursor += 1;
      const request = requests[index];
      if (!request) return;
      const resolution = await resolveVisualAsset(request, options);
      if (!options.signal.aborted) options.onResolution(resolution);
    }
  };
  const count = Math.max(
    1,
    Math.min(options.concurrency ?? 3, MAX_AI_VISUAL_ASSETS, requests.length),
  );
  await Promise.all(Array.from({ length: count }, worker));
}
