// Server-only module: it calls OpenAI and fetches remote image candidates.
import "../serverEnv.js";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { buildAACImagePrompt } from "./visualRequests.js";
import { isAllowedImageUrl, validateImageBytes } from "./imageValidation.js";
import type { AssetProviders, ImageCandidate, VisualAssetRequest } from "./types.js";

const WebImageSearchSchema = z
  .object({
    candidates: z
      .array(
        z
          .object({
            url: z.string().max(2_000),
            title: z.string().max(300),
            attribution: z.string().max(500)
          })
          .strict()
      )
      .max(5)
  })
  .strict();

type OpenAIAssetProviderOptions = {
  openAIClient?: OpenAI;
  searchModel?: string;
  imageModel?: string;
  allowedImageDomains?: readonly string[];
  fetchImpl?: typeof fetch;
};

const DEFAULT_ALLOWED_DOMAINS = [
  "images.unsplash.com",
  "images.pexels.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "www.pexels.com",
  "unsplash.com"
];

function getAllowedDomains(domains?: readonly string[]): readonly string[] {
  if (domains && domains.length > 0) {
    return domains;
  }

  const configured = process.env.AI_ALLOWED_IMAGE_DOMAINS
    ?.split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_DOMAINS;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function extractMetaImageUrl(html: string, baseUrl: string): string | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const property = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (property !== "og:image" && property !== "twitter:image") {
      continue;
    }

    const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
    if (content) {
      return new URL(decodeHtmlEntities(content), baseUrl).toString();
    }
  }

  return null;
}

async function fetchImageCandidate(
  urlString: string,
  allowedDomains: readonly string[],
  fetchImpl: typeof fetch
): Promise<ImageCandidate | null> {
  if (!isAllowedImageUrl(urlString, allowedDomains)) {
    return null;
  }

  const response = await fetchImpl(urlString, {
    method: "GET",
    redirect: "follow",
    // Keep AVIF out of negotiation because the shared cache and validator use
    // the portable PNG/JPEG/WebP set. Some CDNs otherwise return AVIF even
    // when the URL contains a JPEG format hint.
    headers: { accept: "image/jpeg,image/png,image/webp,text/html;q=0.8" }
  });

  if (!response.ok) {
    return null;
  }

  const finalUrl = response.url || urlString;
  if (!isAllowedImageUrl(finalUrl, allowedDomains)) {
    return null;
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase();
  if (contentType?.startsWith("image/")) {
    const data = new Uint8Array(await response.arrayBuffer());
    const validated = validateImageBytes(data, contentType);
    return validated
      ? { source: "web", data: validated.data, mimeType: validated.mimeType, sourceUrl: finalUrl }
      : null;
  }

  if (contentType === "text/html" || contentType === "application/xhtml+xml") {
    const html = (await response.text()).slice(0, 2_000_000);
    const imageUrl = extractMetaImageUrl(html, finalUrl);
    return imageUrl
      ? fetchImageCandidate(imageUrl, allowedDomains, fetchImpl)
      : null;
  }

  return null;
}

function extractBase64Image(value: string | undefined): Uint8Array | null {
  if (!value) {
    return null;
  }

  return Uint8Array.from(Buffer.from(value, "base64"));
}

export function createOpenAIAssetProviders(
  options: OpenAIAssetProviderOptions = {}
): AssetProviders {
  const apiKey = process.env.OPENAI_API_KEY;
  const openAI = options.openAIClient ?? (apiKey ? new OpenAI({ apiKey }) : null);
  const searchModel = options.searchModel ?? process.env.OPENAI_SEARCH_MODEL ?? "gpt-5.6-luna";
  const imageModel = options.imageModel ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare";
  const allowedDomains = getAllowedDomains(options.allowedImageDomains);
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async discoverWebImage(request) {
      if (!openAI || process.env.AI_ASSET_SEARCH_ENABLED === "false") {
        return null;
      }

      try {
        const response = await openAI.responses.parse({
          model: searchModel,
          input: [
            {
              role: "system",
              content:
                "Find suitable existing image sources for an AAC visual. Do not invent URLs. Prefer simple, clear, non-graphic images from the approved domains. Return candidate page or direct-image URLs only."
            },
            {
              role: "user",
              content: `${request.webSearchQuery}\nAllowed domains: ${allowedDomains.join(", ")}`
            }
          ],
          tools: [
            {
              type: "web_search",
              search_context_size: "low",
              search_content_types: ["image", "text"],
              image_settings: { max_results: 3 },
              filters: { allowed_domains: [...allowedDomains] }
            }
          ],
          text: { format: zodTextFormat(WebImageSearchSchema, "web_image_search") },
          include: ["web_search_call.action.sources"],
          store: false
        });

        const parsed = response.output_parsed as z.infer<typeof WebImageSearchSchema> | null | undefined;
        const candidates = parsed?.candidates ?? [];
        for (const candidate of candidates) {
          const image = await fetchImageCandidate(candidate.url, allowedDomains, fetchImpl);
          if (image) {
            return { ...image, attribution: candidate.attribution || candidate.title };
          }
        }
      } catch (error) {
        console.error("Web image discovery failed; trying generation.", error);
      }

      return null;
    },

    async generateImage(request) {
      if (!openAI || process.env.AI_IMAGE_GENERATION_ENABLED === "false") {
        return null;
      }

      try {
        const response = await openAI.images.generate({
          model: imageModel,
          prompt: request.imageGenerationPrompt || buildAACImagePrompt(request.normalizedConcept),
          size: "1024x1024",
          output_format: "png",
          moderation: "auto",
          n: 1
        });
        const data = extractBase64Image(response.data?.[0]?.b64_json);
        const validated = data ? validateImageBytes(data, "image/png") : null;
        return validated
          ? { source: "generated", data: validated.data, mimeType: validated.mimeType }
          : null;
      } catch (error) {
        console.error("Image generation failed; keeping fallback asset.", error);
        return null;
      }
    }
  };
}
