import {
  getAllowedVocabulary,
  type ApprovedVocabularyItem
} from "../../data/approvedVocabulary.js";
import { createUnknownClassification } from "./deterministicClassifier.js";
import { AIClassificationSchema, type AIClassification } from "./schemas.js";

export function validateClassification(
  candidate: unknown,
  vocabulary: readonly ApprovedVocabularyItem[],
  maxChoices = 4
): AIClassification {
  const parsed = AIClassificationSchema.safeParse(candidate);
  if (!parsed.success) {
    return createUnknownClassification("");
  }

  const classification = parsed.data;
  const allowedIds = new Set(getAllowedVocabulary(vocabulary).map((item) => item.id));
  const candidateIds = classification.candidateVocabularyIds;

  // Do not partially trust a response that contains even one invented ID.
  if (candidateIds.some((id) => !allowedIds.has(id))) {
    return createUnknownClassification(classification.questionText, 0.1);
  }

  const uniqueIds = [...new Set(candidateIds)].slice(0, maxChoices);
  const requiresFallback = classification.requiresFallback || uniqueIds.length === 0;

  return {
    ...classification,
    candidateVocabularyIds: uniqueIds,
    requiresFallback
  };
}
