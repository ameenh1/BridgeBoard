import { describe, expect, it } from "vitest";
import { MemoryAssetCache } from "../lib/assets/cache.js";
import { validateImageBytes } from "../lib/assets/imageValidation.js";
import { createOpenAIAssetProviders } from "../lib/assets/openaiAssetProviders.js";
import { resolveVisualAssets } from "../lib/assets/resolveVisualAssets.js";
import { buildVisualAssetRequests } from "../lib/assets/visualRequests.js";
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
  it("builds hashed requests for explicit concepts outside the approved vocabulary", () => {
    const requests = buildVisualAssetRequests({
      questionType: "forced_choice",
      questionText: "Would you like a guitar or piano?",
      topic: "other",
      candidateVocabularyIds: [],
      explicitVisualConcepts: ["guitar", "piano"],
      supportActions: ["help", "repeat", "something_else", "need_more_time", "full_board"],
      confidence: 0.9,
      requiresFallback: false
    });

    expect(requests.map((request) => request.displayLabel)).toEqual(["Guitar", "Piano"]);
    expect(requests.every((request) => request.kind === "explicit")).toBe(true);
    expect(requests.every((request) => !request.cacheKey.includes("guitar") && !request.cacheKey.includes("piano"))).toBe(true);
  });

  it("resolves explicit unapproved concepts through the real provider contract", async () => {
    const fakeClient = {
      responses: {
        parse: async () => ({
          output_parsed: {
            questionType: "forced_choice",
            questionText: "Would you like a guitar or piano?",
            topic: "other",
            candidateVocabularyIds: [],
            explicitVisualConcepts: ["guitar", "piano"],
            supportActions: ["help", "repeat", "something_else", "need_more_time", "full_board"],
            confidence: 0.86,
            requiresFallback: false
          }
        })
      }
    };
    const readyIds: string[] = [];
    const result = await resolveVisualAssets({
      transcript: "Would you like a guitar or piano?",
      classifyOptions: { allowLiveAI: true, openAIClient: fakeClient as never },
      providers: {
        discoverWebImage: async () => null,
        generateImage: async () => candidate("generated")
      },
      onEvent: (event) => {
        if (event.type === "ready") readyIds.push(event.resolution.label ?? event.resolution.vocabularyId);
      }
    });

    await result.pending;
    expect(result.requests.map((request) => request.displayLabel)).toEqual(["Guitar", "Piano"]);
    expect(readyIds).toEqual(["Guitar", "Piano"]);
  });

  it("emits fallback immediately and then the first valid asset", async () => {
    const events: string[] = [];
    const fallbackUrls: string[] = [];
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
      assetSearchMode: "parallel",
      onEvent: (event) => {
        events.push(`${event.type}:${event.resolution.source}`);
        if (event.type === "fallback") fallbackUrls.push(event.resolution.assetUrl);
      }
    });

    expect(events[0]).toBe("fallback:local");
    expect(fallbackUrls).toEqual([
      "/default-images/waffles.svg",
      "/default-images/pancakes.svg"
    ]);
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
    expect(events).toEqual(["ready:generated", "ready:generated"]);
    expect(calls).toBe(0);
  });

  it("serves the verified bathroom response board locally without provider calls", async () => {
    let calls = 0;
    const ready: string[] = [];
    const result = await resolveVisualAssets({
      transcript: "Do you want to go to the bathroom?",
      providers: {
        discoverWebImage: async () => {
          calls += 1;
          return null;
        },
        generateImage: async () => {
          calls += 1;
          return null;
        }
      },
      onEvent: (event) => {
        if (event.type === "ready") {
          ready.push(`${event.resolution.label}:${event.resolution.source}`);
        }
      }
    });

    await result.pending;
    expect(result.requests.map((request) => request.vocabularyId)).toEqual([
      "need_bathroom",
      "action_yes",
      "action_no",
      "need_help"
    ]);
    expect(ready).toEqual([
      "Bathroom:local",
      "Yes:local",
      "No:local",
      "Help:local"
    ]);
    expect(calls).toBe(0);
  });

  it("uses generation first to avoid web search when generation succeeds", async () => {
    let webCalls = 0;
    let generationCalls = 0;
    const events: string[] = [];
    const result = await resolveVisualAssets({
      transcript: "Do you want waffles or pancakes?",
      providers: {
        discoverWebImage: async () => {
          webCalls += 1;
          return candidate("web");
        },
        generateImage: async () => {
          generationCalls += 1;
          return candidate("generated");
        }
      },
      assetSearchMode: "generation_first",
      onEvent: (event) => events.push(`${event.type}:${event.resolution.source}`)
    });

    await result.pending;
    expect(generationCalls).toBe(2);
    expect(webCalls).toBe(0);
    expect(events).toContain("ready:generated");
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
    let acceptHeader = "";
    const provider = createOpenAIAssetProviders({
      openAIClient: fakeClient as never,
      allowedImageDomains: ["images.example"],
      fetchImpl: (async (_url, init) => {
        acceptHeader = new Headers(init?.headers).get("accept") ?? "";
        return new Response(PNG_BYTES, {
          status: 200,
          headers: { "content-type": "image/png" }
        });
      }) as typeof fetch
    });

    const result = await provider.discoverWebImage({
      vocabularyId: "food_waffles",
      displayLabel: "Waffles",
      kind: "approved",
      normalizedConcept: "waffles",
      cacheKey: "aac:food_waffles:en-US:aac-flat-v1",
      webSearchQuery: "waffles",
      imageGenerationPrompt: "waffles",
      styleVersion: "aac-flat-v1",
      locale: "en-US"
    });

    expect(result?.source).toBe("web");
    expect(result?.sourceUrl).toBe("https://images.example/waffles.png");
    expect(acceptHeader).not.toContain("image/avif");
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
      displayLabel: "Waffles",
      kind: "approved",
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
