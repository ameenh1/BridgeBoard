import { getAppMode } from "@/lib/demo/demoMode";
import { isUsingMockClassifier } from "@/lib/ai/classifyQuestion";
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
    mode: getAppMode(),
    classifier: isUsingMockClassifier() ? "mock" : "live",
    aiVocabularyCount: getAIAllowedVocabulary().length,
    imageAssetCount: listAvailableImages().length,
  });
}
