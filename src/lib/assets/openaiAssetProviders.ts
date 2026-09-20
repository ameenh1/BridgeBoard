import "server-only";
import OpenAI from "openai";
import type { ResponseCreateParams } from "openai/resources/responses/responses";
import { isAllowedImageUrl, normalizeImageCandidate, readBoundedBody } from "./imageValidation";
import type { AssetProviders, ImageCandidate } from "./types";

type Options = {
  client?: OpenAI;
  fetchImpl?: typeof fetch;
  allowedDomains?: readonly string[];
};

const DEFAULT_DOMAINS = [
  "images.unsplash.com",
  "images.pexels.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
];

function allowedDomains(configured?: readonly string[]): readonly string[] {
  if (configured?.length) return configured;
  const env = process.env.AI_ALLOWED_IMAGE_DOMAINS?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return env?.length ? env : DEFAULT_DOMAINS;
}

async function fetchAllowedImage(
  initialUrl: string,
  domains: readonly string[],
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<ImageCandidate | null> {
  let url = initialUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!isAllowedImageUrl(url, domains)) return null;
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal,
      headers: { accept: "image/webp,image/png,image/jpeg" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return null;
      url = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) return null;
    const mime = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase();
    if (mime !== "image/png" && mime !== "image/jpeg" && mime !== "image/webp") return null;
    const data = await readBoundedBody(response);
    if (!data) return null;
    return normalizeImageCandidate({ source: "web", data, mimeType: mime, sourceUrl: url });
  }
  return null;
}

function rawImageResults(response: unknown): Array<{
  imageUrl: string;
  sourceUrl?: string;
  caption?: string;
}> {
  if (!response || typeof response !== "object") return [];
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return [];
  const results: Array<{ imageUrl: string; sourceUrl?: string; caption?: string }> = [];
  for (const item of output) {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "web_search_call") {
      continue;
    }
    const raw = (item as { results?: unknown }).results;
    if (!Array.isArray(raw)) continue;
    for (const result of raw) {
      if (!result || typeof result !== "object") continue;
      const imageUrl = (result as { image_url?: unknown }).image_url;
      if (typeof imageUrl !== "string") continue;
      const sourceUrl = (result as { source_website_url?: unknown }).source_website_url;
      const caption = (result as { caption?: unknown }).caption;
      results.push({
        imageUrl,
        sourceUrl: typeof sourceUrl === "string" ? sourceUrl : undefined,
        caption: typeof caption === "string" ? caption : undefined,
      });
    }
  }
  return results;
}

export function createOpenAIAssetProviders(options: Options = {}): AssetProviders {
  const apiKey = process.env.OPENAI_API_KEY;
  const client = options.client ?? (apiKey ? new OpenAI({ apiKey }) : null);
  const fetchImpl = options.fetchImpl ?? fetch;
  const domains = allowedDomains(options.allowedDomains);

  return {
    async discoverWebImage(request, signal) {
      // Web search is an explicitly paid capability. Keep it opt-in so a
      // missing environment variable can never silently enable it.
      if (!client || process.env.AI_ASSET_SEARCH_ENABLED !== "true") return null;
      // The documented image-search fields landed before the stable SDK type.
      // Keep the compatibility cast isolated to this exact wire object.
      const tool = {
        type: "web_search",
        search_content_types: ["image"],
        image_settings: { max_results: 3, caption: true },
        filters: { allowed_domains: [...domains] },
      } as unknown as NonNullable<ResponseCreateParams["tools"]>[number];
      const response = await client.responses.create(
        {
          model: process.env.OPENAI_SEARCH_MODEL ?? "gpt-5.6-luna",
          input: request.webSearchQuery,
          tools: [tool],
          tool_choice: "required",
          include: ["web_search_call.results"],
          store: false,
        },
        { signal },
      );
      for (const result of rawImageResults(response)) {
        const image = await fetchAllowedImage(result.imageUrl, domains, fetchImpl, signal);
        if (image) {
          return {
            ...image,
            sourceUrl: result.sourceUrl ?? image.sourceUrl,
            attribution: result.caption,
          };
        }
      }
      return null;
    },

    async generateImage(request, signal) {
      if (!client || process.env.AI_IMAGE_GENERATION_ENABLED === "false") return null;
      const response = await client.images.generate(
        {
          model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare",
          prompt: request.generationPrompt,
          size: "1024x1024",
          quality: "low",
          output_format: "webp",
          output_compression: 82,
          moderation: "auto",
          n: 1,
        },
        { signal },
      );
      const encoded = response.data?.[0]?.b64_json;
      if (!encoded) return null;
      return normalizeImageCandidate({
        source: "generated",
        data: new Uint8Array(Buffer.from(encoded, "base64")),
        mimeType: "image/webp",
      });
    },
  };
}

export function hasAssetProviders(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY &&
      (process.env.AI_ASSET_SEARCH_ENABLED === "true" ||
        process.env.AI_IMAGE_GENERATION_ENABLED !== "false"),
  );
}

export { rawImageResults };
