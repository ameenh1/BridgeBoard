import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAssetStreamDescriptor, verifyAssetStreamToken } from "@/lib/assets/assetToken";
import { isAllowedImageUrl } from "@/lib/assets/imageValidation";
import { rawImageResults } from "@/lib/assets/openaiAssetProviders";
import { processAssetCache } from "@/lib/assets/cache";
import { resolveVisualAsset } from "@/lib/assets/resolveVisualAssets";
import type { VisualAssetRequest } from "@/lib/assets/types";

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
  it("round-trips a signed grant and rejects tampering", () => {
    const descriptor = createAssetStreamDescriptor(request.boardId, [request], 1_000)!;
    expect(verifyAssetStreamToken(descriptor.token, 2_000).requests).toHaveLength(1);
    expect(() => verifyAssetStreamToken(`${descriptor.token}x`, 2_000)).toThrow("asset_stream_invalid");
    expect(() => verifyAssetStreamToken(descriptor.token, 121_001)).toThrow("asset_stream_expired");
  });
});

describe("web image boundaries", () => {
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
