import { describe, expect, it } from "vitest";
import { MemoryAssetCache } from "../lib/assets/cache.js";
import { validateImageBytes } from "../lib/assets/imageValidation.js";
import { createOpenAIAssetProviders } from "../lib/assets/openaiAssetProviders.js";
import { resolveVisualAssets } from "../lib/assets/resolveVisualAssets.js";
import type { AssetProviders, ImageCandidate, SharedAssetCache } from "../lib/assets/types.js";

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x00
]);

function candidate(source: ImageCandidate["source"]): ImageCandidate {
  return { source, data: PNG_BYTES, mimeType: "image/png" };
}

function createSharedCache(): SharedAssetCache {
  const memory = new MemoryAssetCache();
  return {
    async get(key) {
      return memory.get(key);
    },
    async put(record) {
      return memory.put(record);
    },
    async saveCandidate(request, image) {
      const record = {
        cacheKey: request.cacheKey,
        vocabularyId: request.vocabularyId,
        source: image.source,
        assetUrl: `https://storage.example/${request.cacheKey}`,
        sourceUrl: image.sourceUrl,
        attribution: image.attribution,
        promptVersion: request.styleVersion,
        mimeType: image.mimeType,
        byteSize: image.data.byteLength
      } as const;
      await memory.put(record);
      return record;
    }
  };
}

describe("visual asset resolution", () => {
  it("emits fallback immediately and then the first valid asset", async () => {
    const events: string[] = [];
    let webStarted = false;
    let generationStarted = false;
    const providers: AssetProviders = {
      discoverWebImage: async () => {
        webStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 25));
        return candidate("web");
      },
      generateImage: async () => {
        generationStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return candidate("generated");
      }
    };

    const result = await resolveVisualAssets({
      transcript: "Do you want waffles or pancakes?",
      providers,
      sharedCache: createSharedCache(),
      onEvent: (event) => events.push(`${event.type}:${event.resolution.source}`)
    });

    expect(events[0]).toBe("fallback:placeholder");
    expect(webStarted).toBe(true);
    expect(generationStarted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 12));
    expect(events).toContain("ready:generated");
    await result.pending;
    expect(events).toContain("ready:generated");
  });

  it("uses a local cache hit without starting providers", async () => {
    const localCache = new MemoryAssetCache();
    await localCache.put({
      cacheKey: "aac:food_waffles:en-US:aac-flat-v1",
      vocabularyId: "food_waffles",
      source: "generated",
      assetUrl: "https://local.example/waffles.png",
      promptVersion: "aac-flat-v1",
      mimeType: "image/png"
    });
    await localCache.put({
      cacheKey: "aac:food_pancakes:en-US:aac-flat-v1",
      vocabularyId: "food_pancakes",
      source: "generated",
      assetUrl: "https://local.example/pancakes.png",
      promptVersion: "aac-flat-v1",
      mimeType: "image/png"
    });
    let calls = 0;
    const providers: AssetProviders = {
      discoverWebImage: async () => {
        calls += 1;
        return null;
      },
      generateImage: async () => {
        calls += 1;
        return null;
      }
    };
    const events: string[] = [];

    const result = await resolveVisualAssets({
      transcript: "Do you want waffles or pancakes?",
      localCache,
      providers,
      onEvent: (event) => events.push(`${event.type}:${event.resolution.source}`)
    });

    await result.pending;
    expect(events).toEqual(["ready:local", "ready:local"]);
    expect(calls).toBe(0);
  });
});

describe("image validation", () => {
  it("accepts known PNG bytes and rejects arbitrary HTML", () => {
    expect(validateImageBytes(PNG_BYTES, "image/png")?.mimeType).toBe("image/png");
    expect(validateImageBytes(new TextEncoder().encode("<html></html>"), "text/html")).toBeNull();
  });
});

describe("OpenAI asset providers", () => {
  it("fetches and validates an image discovered through web search", async () => {
    const fakeClient = {
      responses: {
        parse: async () => ({
          output_parsed: {
            candidates: [
              { url: "https://images.example/waffles.png", title: "Waffles", attribution: "Example" }
            ]
          }
        })
      }
    };
    const provider = createOpenAIAssetProviders({
      openAIClient: fakeClient as never,
      allowedImageDomains: ["images.example"],
      fetchImpl: (async () =>
        new Response(PNG_BYTES, {
          status: 200,
          headers: { "content-type": "image/png" }
        })) as typeof fetch
    });

    const result = await provider.discoverWebImage({
      vocabularyId: "food_waffles",
      normalizedConcept: "waffles",
      cacheKey: "aac:food_waffles:en-US:aac-flat-v1",
      webSearchQuery: "waffles",
      imageGenerationPrompt: "waffles",
      styleVersion: "aac-flat-v1",
      locale: "en-US"
    });

    expect(result?.source).toBe("web");
    expect(result?.sourceUrl).toBe("https://images.example/waffles.png");
  });

  it("decodes and validates a generated base64 image", async () => {
    const fakeClient = {
      images: {
        generate: async () => ({ data: [{ b64_json: Buffer.from(PNG_BYTES).toString("base64") }] })
      }
    };
    const provider = createOpenAIAssetProviders({ openAIClient: fakeClient as never });

    const result = await provider.generateImage({
      vocabularyId: "food_waffles",
      normalizedConcept: "waffles",
      cacheKey: "aac:food_waffles:en-US:aac-flat-v1",
      webSearchQuery: "waffles",
      imageGenerationPrompt: "waffles",
      styleVersion: "aac-flat-v1",
      locale: "en-US"
    });

    expect(result?.source).toBe("generated");
    expect(result?.mimeType).toBe("image/png");
  });
});
