import type { RenderableBoard, RenderableChoice } from "@/types/board";
import { getApprovedVocabularyItem } from "@/lib/vocabulary/vocabularyHelpers";
import { toRenderableChoice } from "./renderableChoice";

/**
 * Core answers that are always on the AI board, just like the manual board.
 *
 * All four have bundled artwork so they render `ready` with zero image work,
 * and all four are `allowedForAI` so when a later AI board also proposes one,
 * `mergeChoice` keeps the already-loaded picture by stable `assetKey`.
 */
export const PERSISTENT_AI_CHOICE_IDS = [
  "core_yes",
  "core_no",
  "core_want",
  "core_more",
] as const;

const PERSISTENT_KEYS = new Set<string>(PERSISTENT_AI_CHOICE_IDS);

/** The always-there quick answers, resolved against the approved catalog. */
export function getPersistentAiChoices(): RenderableChoice[] {
  return PERSISTENT_AI_CHOICE_IDS.map(getApprovedVocabularyItem)
    .filter((item) => item !== undefined)
    .map((item) => toRenderableChoice(item));
}

export function isPersistentAiChoice(choice: RenderableChoice): boolean {
  return PERSISTENT_KEYS.has(choice.choiceKey) || PERSISTENT_KEYS.has(choice.id);
}

/**
 * Persistent quick answers first, then the AI suggestions with any duplicates
 * removed. Ready pictures are never touched here — retention happens in
 * `mergeCommittedBoard` / `applyAssetEvent` by `assetKey`.
 */
export function withPersistentChoices(choices: RenderableChoice[]): RenderableChoice[] {
  const seen = new Set<string>();
  const merged: RenderableChoice[] = [];
  for (const choice of [...getPersistentAiChoices(), ...choices]) {
    const key = choice.choiceKey;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(choice);
  }
  return merged;
}

/**
 * The board the AI view shows before the first question: four usable,
 * speakable tiles with bundled pictures — never an empty "No question yet".
 */
export function createWelcomeBoard(): RenderableBoard {
  return {
    boardId: crypto.randomUUID(),
    title: "Start here — ask a question",
    boardType: "choice",
    choices: getPersistentAiChoices(),
    actions: ["help", "repeat", "something_else", "need_more_time", "full_board"],
    isFallback: false,
    isRefreshing: false,
  };
}
