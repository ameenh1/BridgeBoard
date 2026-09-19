import type { AIVocabularyOption, VocabularyItem } from "@/types/vocabulary";
import { approvedVocabulary } from "./approvedVocabulary";

const byId = new Map<string, VocabularyItem>(
  approvedVocabulary.map((item) => [item.id, item]),
);

// A duplicate id would silently shadow an earlier entry and could swap the
// phrase we speak. Cheap to catch here, painful to debug later.
if (byId.size !== approvedVocabulary.length && process.env.NODE_ENV !== "production") {
  const seen = new Set<string>();
  const duplicates = approvedVocabulary
    .map((item) => item.id)
    .filter((id) => !seen.add(id));
  console.error("[vocabulary] duplicate ids in approvedVocabulary:", duplicates);
}

/** The allowlist check. Anything failing this never reaches a board. */
export function isApprovedVocabulary(id: string): boolean {
  return byId.has(id);
}

/**
 * The stricter check used on classifier output.
 *
 * Existing in the catalog is not enough — the item must also be one we offer
 * the model. Otherwise a model that ignored the supplied list could put a
 * grammar word like "want" on a board as if it were a standalone answer.
 */
export function isAIAllowedVocabulary(id: string): boolean {
  return byId.get(id)?.allowedForAI === true;
}

export function getApprovedVocabularyItem(id: string): VocabularyItem | undefined {
  return byId.get(id);
}

/**
 * The restricted catalog the classifier is allowed to see.
 *
 * Only items flagged `allowedForAI`, and only `id`/`label`/`category` —
 * `spokenPhrase` is withheld so the model cannot be nudged into rewriting
 * what a communicator says.
 */
export function getAIAllowedVocabulary(): AIVocabularyOption[] {
  return approvedVocabulary
    .filter((item) => item.allowedForAI)
    .map(({ id, label, category }) => ({ id, label, category }));
}

/** Core items for the manual Full Board, grouped for display. */
export function getCoreVocabulary(): VocabularyItem[] {
  return approvedVocabulary.filter((item) => item.isCore);
}

export function getVocabularyByCategory(category: string): VocabularyItem[] {
  return approvedVocabulary.filter((item) => item.category === category);
}
