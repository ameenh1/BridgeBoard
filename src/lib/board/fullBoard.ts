import type { RenderableChoice } from "@/types/board";
import { approvedVocabulary } from "@/lib/vocabulary/approvedVocabulary";
import { toRenderableChoice } from "./renderableChoice";

/**
 * The manual Full Board.
 *
 * Person 1 owns how this looks; this module owns what is in it. It never
 * touches the classifier, the network, or images — it is the board a
 * communicator can always reach, including when everything else is broken.
 */

export type FullBoardCategory = {
  key: string;
  label: string;
  choices: RenderableChoice[];
};

/**
 * Display groups, in tab order. Catalog categories stay granular (drink,
 * bathroom) while the board presents the seven groups from the spec, so a
 * new vocabulary category does not force a UI change.
 */
const CATEGORY_GROUPS: { key: string; label: string; categories: string[] }[] = [
  { key: "core", label: "Core", categories: ["core"] },
  { key: "needs", label: "Needs", categories: ["needs", "bathroom", "body_needs"] },
  { key: "feelings", label: "Feelings", categories: ["feelings"] },
  { key: "food", label: "Food", categories: ["food", "food_places", "drink"] },
  { key: "people", label: "People", categories: ["people"] },
  { key: "places", label: "Places", categories: ["places"] },
  { key: "activities", label: "Activities", categories: ["activities"] },
];

export function getFullBoardCategories(): FullBoardCategory[] {
  return CATEGORY_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    choices: approvedVocabulary
      .filter((item) => group.categories.includes(item.category))
      .map((item) => toRenderableChoice(item)),
  }));
}

/**
 * Catalog categories no display group claims.
 *
 * A word that is approved but grouped nowhere is unreachable without the AI,
 * which defeats the point of a manual board. `body_needs` was in exactly that
 * state until it was added above, so this is asserted in the tests rather
 * than left to be noticed.
 */
export function ungroupedCategories(): string[] {
  const grouped = new Set(CATEGORY_GROUPS.flatMap((group) => group.categories));
  return [...new Set(approvedVocabulary.map((item) => item.category))].filter(
    (category) => !grouped.has(category),
  );
}
