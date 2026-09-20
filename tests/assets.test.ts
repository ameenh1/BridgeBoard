import { beforeEach, describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { createAssetStreamDescriptor, verifyAssetStreamToken } from "@/lib/assets/assetToken";
import { isAllowedImageUrl } from "@/lib/assets/imageValidation";
import { createOpenAIAssetProviders, rawImageResults } from "@/lib/assets/openaiAssetProviders";
import { processAssetCache } from "@/lib/assets/cache";
import { resolveAssetBatch, resolveVisualAsset } from "@/lib/assets/resolveVisualAssets";
import { buildVisualAssetRequests } from "@/lib/assets/visualRequests";
import type { VisualAssetRequest } from "@/lib/assets/types";
import type { RenderableBoard } from "@/types/board";

const request: VisualAssetRequest = {
  boardId: "00000000-0000-4000-8000-000000000001",
  choiceId: "dragon-fruit",
  assetKey: "a".repeat(64),
  label: "Dragon fruit",
  normalizedConcept: "dragon fruit",
  locale: "en",
  styleVersion: "aac-flat-v1",
  webSearchQuery: "dragon fruit AAC",
  generationPrompt: "one dragon fruit",
};

beforeEach(() => {
  process.env.ASSET_STREAM_SECRET = "test-secret-that-is-long-enough";
  processAssetCache.clear();
});

describe("asset grants", () => {
  it("round-trips eight signed requests and rejects tampering", () => {
    const requests = Array.from({ length: 8 }, (_, index) => ({
      ...request,
      choiceId: `choice-${index}`,
      assetKey: `${String(index).padStart(2, "0")}${"c".repeat(62)}`,
    }));
    const descriptor = createAssetStreamDescriptor(request.boardId, requests, 1_000)!;
    expect(verifyAssetStreamToken(descriptor.token, 2_000).requests).toHaveLength(8);
    expect(() => verifyAssetStreamToken(`${descriptor.token}x`, 2_000)).toThrow("asset_stream_invalid");
    expect(() => verifyAssetStreamToken(descriptor.token, 121_001)).toThrow("asset_stream_expired");
  });
});

describe("web image boundaries", () => {
  it("keeps paid web search disabled unless explicitly enabled", async () => {
    const previous = process.env.AI_ASSET_SEARCH_ENABLED;
    const create = vi.fn().mockResolvedValue({ output: [] });
    const client = { responses: { create } } as unknown as OpenAI;
    const providers = createOpenAIAssetProviders({ client });

    try {
      delete process.env.AI_ASSET_SEARCH_ENABLED;
      await expect(providers.discoverWebImage(request, new AbortController().signal)).resolves.toBeNull();
      expect(create).not.toHaveBeenCalled();

      process.env.AI_ASSET_SEARCH_ENABLED = "false";
      await expect(providers.discoverWebImage(request, new AbortController().signal)).resolves.toBeNull();
      expect(create).not.toHaveBeenCalled();

      process.env.AI_ASSET_SEARCH_ENABLED = "true";
      await expect(providers.discoverWebImage(request, new AbortController().signal)).resolves.toBeNull();
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.AI_ASSET_SEARCH_ENABLED;
      else process.env.AI_ASSET_SEARCH_ENABLED = previous;
    }
  });

  it("parses raw image results rather than assistant-authored URLs", () => {
    const results = rawImageResults({
      output: [{
        type: "web_search_call",
        results: [{
          type: "image_result",
          image_url: "https://images.example.test/image.jpg",
          source_website_url: "https://example.test/page",
          caption: "A fruit",
        }],
      }],
    });
    expect(results).toEqual([{
      imageUrl: "https://images.example.test/image.jpg",
      sourceUrl: "https://example.test/page",
      caption: "A fruit",
    }]);
  });

  it("requires HTTPS and an allowed host", () => {
    expect(isAllowedImageUrl("https://cdn.example.test/a.png", ["example.test"])).toBe(true);
    expect(isAllowedImageUrl("http://cdn.example.test/a.png", ["example.test"])).toBe(false);
    expect(isAllowedImageUrl("https://example.test.evil.test/a.png", ["example.test"])).toBe(false);
  });
});

describe("asset resolution", () => {
  it("races providers, caches the first candidate, and deduplicates callers", async () => {
    const web = vi.fn(async () => ({
      source: "web" as const,
      data: new Uint8Array([1, 2, 3]),
      mimeType: "image/webp" as const,
    }));
    const generated = vi.fn(async () => new Promise<null>((resolve) => setTimeout(() => resolve(null), 50)));
    const options = {
      providers: { discoverWebImage: web, generateImage: generated },
      signal: new AbortController().signal,
    };
    const [first, second] = await Promise.all([
      resolveVisualAsset(request, options),
      resolveVisualAsset(request, options),
    ]);
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    expect(web).toHaveBeenCalledTimes(1);
    expect(generated).toHaveBeenCalledTimes(1);
  });
});

describe("visual request limits", () => {
  it("supports eight pending visuals while honoring lower configuration", () => {
    const board: RenderableBoard = {
      boardId: "00000000-0000-4000-8000-000000000002",
      title: "Suggestions",
      boardType: "choice",
      choices: Array.from({ length: 10 }, (_, index) => ({
        id: `choice-${index}`,
        choiceKey: `choice-${index}`,
        label: `Choice ${index}`,
        spokenPhrase: `Choice ${index}`,
        iconKey: "shapes",
        origin: "dynamic" as const,
        visual: {
          assetKey: `${String(index).padStart(2, "0")}${"a".repeat(62)}`,
          status: "pending" as const,
        },
      })),
      actions: ["help"],
      isFallback: false,
      isRefreshing: false,
    };
    const previous = process.env.AI_MAX_VISUAL_ASSETS;

    try {
      process.env.AI_MAX_VISUAL_ASSETS = "20";
      expect(buildVisualAssetRequests(board)).toHaveLength(8);

      process.env.AI_MAX_VISUAL_ASSETS = "3";
      expect(buildVisualAssetRequests(board)).toHaveLength(3);
    } finally {
      if (previous === undefined) delete process.env.AI_MAX_VISUAL_ASSETS;
      else process.env.AI_MAX_VISUAL_ASSETS = previous;
    }
  });

  it("can resolve eight assets concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requests = Array.from({ length: 8 }, (_, index) => ({
      ...request,
      choiceId: `choice-${index}`,
      assetKey: `${String(index).padStart(2, "0")}${"b".repeat(62)}`,
    }));
    const resolutions: string[] = [];

    const batch = resolveAssetBatch(requests, {
      providers: {
        discoverWebImage: async (assetRequest) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await gate;
          active -= 1;
          return {
            source: "web" as const,
            data: new Uint8Array([1]),
            mimeType: "image/webp" as const,
            attribution: assetRequest.label,
          };
        },
        generateImage: async () => null,
      },
      signal: new AbortController().signal,
      concurrency: 20,
      onResolution: (resolution) => resolutions.push(resolution.choiceId),
    });

    await vi.waitFor(() => expect(maxActive).toBe(8), { timeout: 1_000 });
    release();
    await batch;

    expect(resolutions).toHaveLength(8);
  });
});
