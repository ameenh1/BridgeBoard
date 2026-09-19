import { hasClassifierCredentials } from "@/lib/ai/classifyQuestion";
import { hasAssetProviders } from "@/lib/assets/openaiAssetProviders";
import { isAssetStreamConfigured } from "@/lib/assets/assetToken";
import { listAvailableImages } from "@/lib/images/imageManifest";
import { getAIAllowedVocabulary } from "@/lib/vocabulary/vocabularyHelpers";

/**
 * GET /api/health
 *
 * Liveness plus the few counts that answer "why isn't my half working?"
 * during integration — is the classifier still mocked, have the image assets
 * landed, how much vocabulary can the model choose from.
 *
 * Deliberately no secrets: no keys, no indication of which keys are set, no
 * environment contents, no stack traces.
 */
export async function GET(): Promise<Response> {
  return Response.json({
    ok: true,
    app: "bridgeboard",
    classifier: hasClassifierCredentials() ? "live" : "unconfigured",
    realtime: process.env.OPENAI_API_KEY ? "configured" : "unconfigured",
    assetProviders: hasAssetProviders() ? "configured" : "unconfigured",
    assetStream: isAssetStreamConfigured() ? "configured" : "unconfigured",
    sharedCache:
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "configured"
        : "optional_unconfigured",
    aiVocabularyCount: getAIAllowedVocabulary().length,
    imageAssetCount: listAvailableImages().length,
  });
}
