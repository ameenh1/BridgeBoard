// Browser-safe/public surface for the frontend integration.
export {
  AIClassificationSchema,
  ClassifyQuestionRequestSchema,
  QuestionTypeSchema,
  SupportActionSchema,
  TopicSchema
} from "./ai/schemas.js";
export type {
  AIClassification,
  ClassifyQuestionRequest
} from "./ai/schemas.js";
export { APPROVED_VOCABULARY } from "../data/approvedVocabulary.js";
export { IMAGE_MANIFEST } from "../data/imageManifest.js";
export { DEMO_TRANSCRIPTS } from "../data/demoTranscripts.js";
export { buildVisualAssetRequests, buildAACImagePrompt } from "./assets/visualRequests.js";
export { createBrowserAssetCache } from "./assets/browserAssetCache.js";
export { createBrowserSpeechRecognizer } from "./speech/browserSTT.js";
export { createRealtimeTranscriptionController } from "./speech/realtimeTranscription.js";
export type {
  AssetResolution,
  AssetResolutionEvent,
  AssetSearchMode,
  AssetSource,
  AssetStatus,
  VisualAssetRequest
} from "./assets/types.js";
export type {
  RealtimeTranscriptionClientOptions,
  RealtimeTranscriptionController,
  RealtimeTranscriptionError
} from "./speech/realtimeTranscription.js";
export type {
  RealtimeTranscriptionConfig,
  RealtimeTranscriptionDelay,
  RealtimeTranscriptionState,
  RealtimeTranscriptionTurnDetection,
  RealtimeTranscript
} from "./speech/types.js";
