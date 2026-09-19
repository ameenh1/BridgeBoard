import type { VocabularyItem } from "@/types/vocabulary";
import { getApprovedVocabularyItem } from "@/lib/vocabulary/vocabularyHelpers";

/**
 * The manual board, as a layout of vocabulary ids.
 *
 * This file decides arrangement and colour only. It deliberately contains no
 * label and no spoken phrase: those live in the approved vocabulary and are
 * looked up at render time, so there is exactly one place a word can be
 * changed and no way for the UI to drift from what the board speaks.
 */
export type DefaultBoardRow = {
  /** Drives the row's colour band; matches the `.aac-row-*` classes. */
  category: "core" | "responses" | "needs" | "emotions";
  /** Accessible name for the row's landmark. */
  label: string;
  ids: string[];
};

export const DEFAULT_BOARD_ROWS: DefaultBoardRow[] = [
  {
    category: "core",
    label: "Core words",
    ids: ["core_i", "core_want", "core_need", "core_like", "core_dont_like", "core_something_else"],
  },
  {
    category: "responses",
    label: "Responses",
    ids: ["core_yes", "core_no", "core_more", "core_all_done", "core_again", "core_wait"],
  },
  {
    category: "needs",
    label: "Needs",
    ids: ["food_eat", "need_water", "need_bathroom", "body_hurt", "core_help", "need_break"],
  },
  {
    category: "emotions",
    label: "Feelings and actions",
    ids: ["emotion_happy", "emotion_sad", "emotion_angry", "emotion_tired", "core_go", "core_stop"],
  },
];

export type ResolvedBoardRow = Omit<DefaultBoardRow, "ids"> & { items: VocabularyItem[] };

/**
 * Resolves the layout against the catalog.
 *
 * An id that is not in the approved vocabulary is dropped rather than rendered
 * as a blank tile. `assertDefaultBoardLayout` turns that into a test failure so
 * it can never quietly ship.
 */
export function resolveDefaultBoard(): ResolvedBoardRow[] {
  return DEFAULT_BOARD_ROWS.map(({ ids, ...row }) => ({
    ...row,
    items: ids
      .map((id) => getApprovedVocabularyItem(id))
      .filter((item): item is VocabularyItem => item !== undefined),
  }));
}

/** Returns the ids the layout names that the catalog does not define. */
export function missingDefaultBoardIds(): string[] {
  return DEFAULT_BOARD_ROWS.flatMap((row) => row.ids).filter(
    (id) => getApprovedVocabularyItem(id) === undefined,
  );
}
