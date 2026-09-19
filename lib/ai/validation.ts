import {
  getAllowedVocabulary,
  type ApprovedVocabularyItem
} from "../../data/approvedVocabulary.js";
import { createUnknownClassification } from "./deterministicClassifier.js";
import { AIClassificationSchema, type AIClassification } from "./schemas.js";

function maxExplicitVisualConcepts(): number {
  const configured = Number(process.env.AI_MAX_EXPLICIT_VISUAL_CONCEPTS ?? 6);
  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 8)
    : 6;
}

function normalizeExplicitVisualConcept(value: string): string | null {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length > 80 || normalized.split(" ").length > 6) {
    return null;
  }

  if (/^(something|anything|that|it|this|there|here|yes|no|maybe)$/u.test(normalized)) {
    return null;
  }

  return normalized;
}

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
  const explicitVisualConcepts = [
    ...new Set(
      classification.explicitVisualConcepts
        .map(normalizeExplicitVisualConcept)
        .filter((concept): concept is string => Boolean(concept))
    )
  ].slice(0, maxExplicitVisualConcepts());
  const requiresFallback =
    classification.requiresFallback || (uniqueIds.length === 0 && explicitVisualConcepts.length === 0);

  return {
    ...classification,
    candidateVocabularyIds: uniqueIds,
    explicitVisualConcepts,
    requiresFallback
  };
}

export { normalizeExplicitVisualConcept };
