import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOpenAIRealtimeTranscriptionSession,
  createOpenAIAssetProviders,
  createSupabaseAssetCache,
  resolveVisualAssets
} from "../../lib/server.js";
import { getApprovedVocabularySpeechKeywords } from "../../data/approvedVocabulary.js";
import { MemoryAssetCache } from "../../lib/assets/cache.js";
import type { AssetResolutionEvent } from "../../lib/assets/types.js";

const demoDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
const publicDirectory = resolve(demoDirectory, "../../public");
const port = Number(process.env.BRIDGEBOARD_DEMO_PORT ?? 3000);
const demoLocalAssetCache = new MemoryAssetCache();

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = resolve(demoDirectory, relativePath.startsWith("default-images/")
    ? `../../public/${relativePath}`
    : relativePath);
  const allowedRoot = relativePath.startsWith("default-images/") ? publicDirectory : demoDirectory;
  if (!filePath.startsWith(allowedRoot)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const contents = await readFile(filePath);
    const extension = extname(filePath).toLowerCase();
    const contentType = extension === ".html"
      ? "text/html; charset=utf-8"
      : extension === ".svg"
        ? "image/svg+xml"
        : extension === ".png"
          ? "image/png"
          : extension === ".jpg" || extension === ".jpeg"
            ? "image/jpeg"
            : extension === ".webp"
              ? "image/webp"
              : "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      ...(filePath.endsWith(".html") ? { "Cache-Control": "no-store" } : {})
    });
    response.end(contents);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

function writeNdjson(response: ServerResponse, payload: unknown): void {
  if (!response.destroyed) {
    response.write(`${JSON.stringify(payload)}\n`);
  }
}

function createOptionalSharedCache() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return undefined;
  }
  return createSupabaseAssetCache();
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  try {
    if (request.method === "GET" && url.pathname === "/") {
      await serveStatic("/", response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/default-images/placeholder.svg") {
      await serveStatic(url.pathname, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/realtime/session") {
      const sdp = await readBody(request);
      const answer = await createOpenAIRealtimeTranscriptionSession({
        sdp,
        languages: ["en"],
        keywords: getApprovedVocabularySpeechKeywords(),
        prompt: "A caregiver is speaking short AAC choice questions and support phrases.",
        delay: "low"
      });
      response.writeHead(200, { "Content-Type": "application/sdp" });
      response.end(answer);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/resolve-assets") {
      const body = JSON.parse(await readBody(request)) as {
        transcript?: unknown;
        recentContext?: unknown;
      };
      if (typeof body.transcript !== "string" || !body.transcript.trim()) {
        sendJson(response, 400, { error: "A finalized transcript is required." });
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Transfer-Encoding": "chunked"
      });

      const recentContext = Array.isArray(body.recentContext)
        ? body.recentContext.filter((line): line is string => typeof line === "string").slice(-2)
        : [];
      const queuedEvents: AssetResolutionEvent[] = [];
      let classificationSent = false;
      const result = await resolveVisualAssets({
        transcript: body.transcript,
        recentContext,
        localCache: demoLocalAssetCache,
        providers: createOpenAIAssetProviders(),
        sharedCache: createOptionalSharedCache(),
        onEvent: (event) => {
          if (classificationSent) {
            writeNdjson(response, event);
          } else {
            queuedEvents.push(event);
          }
        }
      });
      writeNdjson(response, {
        type: "classification",
        classification: result.classification,
        requests: result.requests
      });
      classificationSent = true;
      for (const event of queuedEvents) {
        writeNdjson(response, event);
      }
      await result.pending;
      writeNdjson(response, { type: "done" });
      response.end();
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    if (response.headersSent) {
      writeNdjson(response, {
        type: "error",
        error: error instanceof Error ? error.message : "BridgeBoard demo request failed."
      });
      response.end();
    } else {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "BridgeBoard demo request failed."
      });
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`BridgeBoard Realtime demo: http://localhost:${port}`);
});
