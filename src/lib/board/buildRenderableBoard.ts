import type { BoardAction, RenderableBoard } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import {
  AIClassificationSchema,
  MIN_AI_CONFIDENCE,
} from "@/lib/validation/aiClassification";
import {
  getApprovedVocabularyItem,
  isAIAllowedVocabulary,
} from "@/lib/vocabulary/vocabularyHelpers";
import { normalizeVocabularyId } from "@/lib/vocabulary/vocabularyAliases";
import { createAssetKey } from "@/lib/assets/assetKeys";
import { toRenderableChoice, iconForCategory } from "./renderableChoice";
import { validatedDynamicConcepts } from "./dynamicConcepts";
import { getBoardTitle, mapQuestionType } from "./boardTitles";
import { createFallbackBoard } from "./createFallbackBoard";

/** Agency controls present on every non-fallback board. */
const STANDARD_ACTIONS: BoardAction[] = [
  "help",
  "repeat",
  "something_else",
  "need_more_time",
  "full_board",
];

/**
 * Turn an untrusted classifier response into a board that is safe to show.
 *
 * Every gate below is deterministic application code. We never ask the model
 * whether to trust the model. If any gate rejects, we fall back rather than
 * guess — an unhelpful board is recoverable, a board that puts words in
 * someone's mouth is not.
 */
export async function buildRenderableBoard(
  rawResponse: unknown,
  profile: ChildProfile,
  originalQuestionText?: string,
): Promise<RenderableBoard> {
  // Gate 1: shape. Malformed or non-JSON output dies here.
  const parsed = AIClassificationSchema.safeParse(rawResponse);
  if (!parsed.success) {
    return createFallbackBoard("invalid_response");
  }

  const result = parsed.data;

  // Gate 2: the model's own admission of uncertainty.
  if (result.requiresFallback) {
    return createFallbackBoard("low_confidence");
  }

  // Gate 3: our threshold, not the model's opinion of itself.
  if (result.confidence < MIN_AI_CONFIDENCE) {
    return createFallbackBoard("low_confidence");
  }

  // Gate 4: an unsupported question type is not something to improvise around.
  if (result.questionType === "unknown") {
    return createFallbackBoard("unknown_question");
  }

  // Gate 5: the allowlist. Ids are first normalized across branch naming
  // schemes, then checked against what we actually offer the model — existing
  // in the catalog is not enough. Invented ids are dropped silently; a partial
  // board of real vocabulary is still usable.
  const approvedItems = result.candidateVocabularyIds
    .map(normalizeVocabularyId)
    .filter(isAIAllowedVocabulary)
    .map(getApprovedVocabularyItem)
    .filter((item) => item !== undefined);

  const questionText = originalQuestionText?.trim() || result.questionText.trim();
  const catalogLabels = new Set(approvedItems.map((item) => item.label.toLowerCase()));
  const dynamicItems = validatedDynamicConcepts(questionText, result.explicitVisualConcepts)
    .filter((item) => !catalogLabels.has(item.normalized))
    .map((item) => ({
      id: item.id,
      choiceKey: item.id,
      label: item.concept,
      spokenPhrase: item.concept,
      iconKey: iconForCategory(result.topic),
      origin: "dynamic" as const,
      visual: {
        assetKey: createAssetKey(item.normalized),
        status: "pending" as const,
      },
    }));

  const choices = [
    ...approvedItems.map((item) => toRenderableChoice(item)),
    ...dynamicItems,
  ].slice(0, profile.maxChoices);

  if (choices.length === 0) {
    return createFallbackBoard("no_approved_vocabulary");
  }

  return {
    boardId: crypto.randomUUID(),
    title: getBoardTitle(result.questionType, result.topic),
    questionText,
    boardType: mapQuestionType(result.questionType),
    choices,
    actions: STANDARD_ACTIONS,
    isFallback: false,
    isRefreshing: false,
  };
}
