import { z } from "zod";
import { verifyAssetStreamToken } from "@/lib/assets/assetToken";
import { createOpenAIAssetProviders } from "@/lib/assets/openaiAssetProviders";
import { resolveAssetBatch } from "@/lib/assets/resolveVisualAssets";
import { createOptionalSupabaseAssetCache } from "@/lib/assets/supabaseAssetCache";
import type { AssetStreamEvent } from "@/lib/assets/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  token: z.string().min(1).max(20_000),
  skipAssetKeys: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(6).optional(),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  let grant;
  try {
    grant = verifyAssetStreamToken(parsed.data.token);
  } catch (error) {
    const expired = error instanceof Error && error.message === "asset_stream_expired";
    return Response.json({ error: expired ? "expired_token" : "invalid_token" }, { status: expired ? 410 : 401 });
  }

  const allowedKeys = new Set(grant.requests.map((item) => item.assetKey));
  const skipped = new Set(
    (parsed.data.skipAssetKeys ?? []).filter((assetKey) => allowedKeys.has(assetKey)),
  );
  const requests = grant.requests.filter((item) => !skipped.has(item.assetKey));
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (event: AssetStreamEvent) => {
        if (!abortController.signal.aborted) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      };

      void resolveAssetBatch(requests, {
        providers: createOpenAIAssetProviders(),
        sharedCache: createOptionalSupabaseAssetCache(),
        signal: abortController.signal,
        concurrency: 3,
        onResolution(resolution) {
          write({
            type: resolution.status === "ready" ? "asset.ready" : "asset.unavailable",
            ...resolution,
          } as AssetStreamEvent);
        },
      })
        .then(() => {
          write({ type: "complete", boardId: grant.boardId });
        })
        .catch((error) => {
          if (!abortController.signal.aborted) {
            console.warn("[asset-stream] batch failed", error instanceof Error ? error.name : "unknown");
          }
        })
        .finally(() => {
          request.signal.removeEventListener("abort", abort);
          if (!abortController.signal.aborted) controller.close();
        });
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
