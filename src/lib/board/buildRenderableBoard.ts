import type { BoardAction, RenderableBoard } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import {
  AIClassificationSchema,
  type AIClassification,
  MIN_AI_CONFIDENCE,
} from "@/lib/validation/aiClassification";
import {
  getApprovedVocabularyItem,
  isAIAllowedVocabulary,
} from "@/lib/vocabulary/vocabularyHelpers";
import { normalizeVocabularyId } from "@/lib/vocabulary/vocabularyAliases";
import { createAssetKey, normalizeConcept } from "@/lib/assets/assetKeys";
import { toRenderableChoice, iconForCategory } from "./renderableChoice";
import {
  validatedDynamicConcepts,
  validatedResponseConcepts,
  validatedSuggestedConcepts,
} from "./dynamicConcepts";
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

const OPEN_ENDED_FALLBACK_IDS: Partial<Record<AIClassification["topic"], readonly string[]>> = {
  food: ["food_waffles", "food_pancakes"],
  food_places: [
    "food_place_restaurant",
    "food_place_cafe",
    "food_place_fast_food",
    "food_place_picnic",
    "food_place_home",
  ],
  drink: ["need_water"],
  feelings: ["emotion_happy", "emotion_sad", "emotion_tired", "emotion_worried"],
  activities: ["activity_play", "activity_music", "activity_read", "activity_walk"],
  people: ["person_mom", "person_dad", "person_teacher", "person_friend"],
  places: ["place_home", "place_school", "place_outside"],
  bathroom: ["need_bathroom"],
  body_needs: ["body_hurt", "need_help"],
};

const OPEN_ENDED_EXCLUDED_IDS = new Set(["food_eat", "place_car"]);

/** Catalog entries that are safe, complete responses to a caregiver statement. */
const STATEMENT_RESPONSE_CATALOG_IDS = new Set([
  "core_yes",
  "core_no",
  "core_more",
  "core_all_done",
  "core_wait",
  "core_later",
  "core_stop",
  "core_go",
  "core_again",
]);

/** Statements add a small response set so they do not consume the gallery. */
const MAX_STATEMENT_RESPONSES = 4;

const OPEN_ENDED_SUGGESTION_EXCLUSIONS: Partial<
  Record<AIClassification["topic"], ReadonlySet<string>>
> = {
  food_places: new Set(["car", "school", "outside"]),
  food: new Set(["car", "school", "outside", "home", "restaurant", "cafe", "café"]),
  places: new Set(["restaurant", "cafe", "café", "fast food", "picnic"]),
};

function isTopicCompatible(
  item: NonNullable<ReturnType<typeof getApprovedVocabularyItem>>,
  questionType: string,
  topic: string,
): boolean {
  if (questionType === "statement") return STATEMENT_RESPONSE_CATALOG_IDS.has(item.id);
  if (questionType !== "open_ended") return true;
  if (OPEN_ENDED_EXCLUDED_IDS.has(item.id)) return false;
  return item.category === topic;
}

function isSuggestedConceptCompatible(normalized: string, topic: AIClassification["topic"]): boolean {
  const exclusions = OPEN_ENDED_SUGGESTION_EXCLUSIONS[topic];
  if (!exclusions) return true;
  return !normalized.split(" ").some((word) => exclusions.has(word));
}

function resolveQuestionContext(
  result: AIClassification,
  questionText: string,
): {
  questionType: AIClassification["questionType"];
  topic: AIClassification["topic"];
  openEnded: boolean;
  statement: boolean;
} {
  const trimmed = questionText.trim();
  const startsWithOpenWord = /^(?:who|what|where|when)\b/iu.test(trimmed);
  const hasChoiceLanguage = /\b(?:or|either|between)\b/iu.test(trimmed);
  const statement = result.questionType === "statement";
  const openEnded =
    !statement &&
    (result.questionType === "open_ended" ||
      (result.questionType === "forced_choice" && startsWithOpenWord && !hasChoiceLanguage));
  let topic = result.topic;

  // Older classifier responses used `places` for this question because the
  // food_places topic did not exist yet. Keep the server-side behavior safe
  // while those responses age out of caches and deployed model prompts.
  if (openEnded && /\b(?:where|place)\b.*\b(?:eat|food|meal|lunch|dinner|breakfast)\b/iu.test(trimmed)) {
    topic = "food_places";
  }

  return {
    questionType: openEnded ? "open_ended" : result.questionType,
    topic,
    openEnded,
    statement,
  };
}

function openEndedFallbackChoices(
  topic: AIClassification["topic"],
  maxChoices: ChildProfile["maxChoices"],
) {
  return (OPEN_ENDED_FALLBACK_IDS[topic] ?? [])
    .map(getApprovedVocabularyItem)
    .filter((item) => item !== undefined)
    .slice(0, maxChoices)
    .map((item) => toRenderableChoice(item));
}

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

  const questionText = originalQuestionText?.trim() || result.questionText.trim();
  const context = resolveQuestionContext(result, questionText);

  // Gate 5: the allowlist. Ids are first normalized across branch naming
  // schemes, then checked against what we actually offer the model — existing
  // in the catalog is not enough. Invented ids are dropped silently; a partial
  // board of real vocabulary is still usable.
  const approvedItems = result.candidateVocabularyIds
    .map(normalizeVocabularyId)
    .filter(isAIAllowedVocabulary)
    .map(getApprovedVocabularyItem)
    .filter((item) => item !== undefined)
    .filter((item) => isTopicCompatible(item, context.questionType, context.topic));

  const catalogLabels = new Set(approvedItems.map((item) => normalizeConcept(item.label)));
  const dynamicConcepts = [
    ...(context.statement ? [] : validatedDynamicConcepts(questionText, result.explicitVisualConcepts)),
    ...(context.openEnded
      ? validatedSuggestedConcepts(result.suggestedAnswerConcepts).filter((item) =>
          isSuggestedConceptCompatible(item.normalized, context.topic),
        )
      : context.statement
        ? validatedResponseConcepts(result.suggestedResponseConcepts)
        : []),
  ];
  const seenDynamicConcepts = new Set<string>();
  const dynamicItems = dynamicConcepts
    .filter((item) => {
      if (catalogLabels.has(item.normalized) || seenDynamicConcepts.has(item.normalized)) return false;
      seenDynamicConcepts.add(item.normalized);
      return true;
    })
    .map((item) => ({
      id: item.id,
      choiceKey: item.id,
      label: item.concept,
      spokenPhrase: item.concept,
      iconKey: iconForCategory(context.topic),
      origin: "dynamic" as const,
      visual: {
        assetKey: createAssetKey(item.normalized),
        status: "pending" as const,
      },
    }));

  const choiceLimit = context.statement
    ? Math.min(profile.maxChoices, MAX_STATEMENT_RESPONSES)
    : profile.maxChoices;
  let choices = [
    ...approvedItems.map((item) => toRenderableChoice(item)),
    ...dynamicItems,
  ].slice(0, choiceLimit);

  if (choices.length === 0 && context.openEnded) {
    choices = openEndedFallbackChoices(context.topic, profile.maxChoices);
  }

  if (choices.length === 0) {
    // A statement with no valid AI response must not replace a usable board.
    // The session controller keeps the committed board and persistent quick
    // responses in this case.
    return createFallbackBoard("no_approved_vocabulary");
  }

  return {
    boardId: crypto.randomUUID(),
    title: getBoardTitle(context.questionType, context.topic),
    questionText,
    boardType: mapQuestionType(context.questionType),
    choices,
    actions: STANDARD_ACTIONS,
    isFallback: false,
    isRefreshing: false,
  };
}
