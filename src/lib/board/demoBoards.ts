import type { BoardAction, BoardType, RenderableBoard } from "@/types/board";
import { getApprovedVocabularyItem } from "@/lib/vocabulary/vocabularyHelpers";
import type { DemoPrompt } from "@/lib/demo/demoPrompts";
import { createFallbackBoard } from "./createFallbackBoard";
import { toRenderableChoice } from "./renderableChoice";

/**
 * Deterministic boards for the demo script.
 *
 * These are not a shortcut around the real pipeline — they are the reliability
 * floor. Conference wifi dies, API keys expire, and rate limits happen during
 * the one five-minute window that matters. Every one of these builds with no
 * network and no OpenAI key.
 */

const STANDARD_ACTIONS: BoardAction[] = [
  "help",
  "repeat",
  "something_else",
  "need_more_time",
  "full_board",
];

function buildBoard(params: {
  title: string;
  questionText: string;
  boardType: BoardType;
  vocabularyIds: string[];
}): RenderableBoard {
  const choices = params.vocabularyIds
    .map(getApprovedVocabularyItem)
    .filter((item) => item !== undefined)
    .map((item) => toRenderableChoice(item));

  return {
    boardId: crypto.randomUUID(),
    title: params.title,
    questionText: params.questionText,
    boardType: params.boardType,
    choices,
    actions: STANDARD_ACTIONS,
    isFallback: false,
  };
}

export function getBreakfastDemoBoard(): RenderableBoard {
  return buildBoard({
    title: "What would you like to eat?",
    questionText: "Do you want waffles or pancakes?",
    boardType: "choice",
    vocabularyIds: ["food_waffles", "food_pancakes"],
  });
}

export function getFeelingsDemoBoard(): RenderableBoard {
  return buildBoard({
    title: "How are you feeling?",
    questionText: "How are you feeling?",
    boardType: "feelings_needs",
    vocabularyIds: [
      "emotion_happy",
      "emotion_sad",
      "emotion_tired",
      "emotion_overwhelmed",
    ],
  });
}

export function getPersonalCupsDemoBoard(): RenderableBoard {
  return buildBoard({
    title: "What would you like to drink?",
    questionText: "Do you want your blue cup or red cup?",
    boardType: "choice",
    vocabularyIds: ["personal_blue_cup", "personal_red_cup"],
  });
}

/**
 * Demo prompts, matched loosely.
 *
 * Speech recognition rarely returns the scripted sentence verbatim, so each
 * matcher keys off the few words that carry the meaning rather than the whole
 * phrase. Matching is still narrow enough that an unrelated question falls
 * through to the classifier instead of being forced onto a scripted board.
 */
const DEMO_MATCHERS: { id: DemoPrompt["id"]; match: (q: string) => boolean }[] = [
  {
    id: "personal-cups",
    // Checked before breakfast: "blue cup or red cup" is more specific, and a
    // caregiver could plausibly mention a cup alongside food.
    match: (q) => q.includes("blue cup") || q.includes("red cup"),
  },
  {
    id: "breakfast",
    match: (q) => q.includes("waffle") || q.includes("pancake"),
  },
  {
    id: "feelings",
    match: (q) =>
      q.includes("how are you feeling") ||
      q.includes("how do you feel") ||
      q.includes("how're you feeling") ||
      q.includes("how you feeling"),
  },
  {
    id: "uncertain",
    // The scripted confusing question must reach the fallback board even when
    // a live classifier is wired in. Without this it goes to the model, and a
    // model that returns a confident answer breaks the one demo whose entire
    // point is that we refuse to guess.
    match: (q) =>
      (q.includes("unless you want something different") ||
        (q.includes("after you finish") && q.includes("maybe"))),
  },
];

const BUILDERS: Record<DemoPrompt["id"], () => RenderableBoard> = {
  breakfast: getBreakfastDemoBoard,
  feelings: getFeelingsDemoBoard,
  "personal-cups": getPersonalCupsDemoBoard,
  uncertain: () => createFallbackBoard("demo_fallback"),
};

/**
 * Returns a scripted board for a known demo prompt, or `null` when the
 * question isn't one we recognize. Returning `null` rather than guessing keeps
 * the caller in charge of falling back.
 */
export function getDemoBoardForQuestion(questionText: string): RenderableBoard | null {
  const normalized = questionText.toLowerCase().trim();
  const matcher = DEMO_MATCHERS.find((candidate) => candidate.match(normalized));
  return matcher ? BUILDERS[matcher.id]() : null;
}

/** The scripted "confusing question" demo. */
export function getUncertaintyDemoBoard(): RenderableBoard {
  return createFallbackBoard("demo_fallback");
}
