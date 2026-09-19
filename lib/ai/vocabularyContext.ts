import {
  getAllowedVocabulary,
  type ApprovedVocabularyItem
} from "../../data/approvedVocabulary.js";

export function buildVocabularyContext(
  vocabulary: readonly ApprovedVocabularyItem[] = [],
  maxItems = 200
): string {
  const allowed = getAllowedVocabulary(vocabulary).slice(0, maxItems);

  return allowed
    .map((item) => `- ${item.id}: ${item.label} | category: ${item.category} | tags: ${item.tags.join(", ")}`)
    .join("\n");
}
