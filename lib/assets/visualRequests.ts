import { getApprovedVocabularyItem, APPROVED_VOCABULARY, type ApprovedVocabularyItem } from "../../data/approvedVocabulary.js";
import type { AIClassification } from "../ai/schemas.js";
import type { BuildVisualRequestOptions, VisualAssetRequest } from "./types.js";

const DEFAULT_STYLE_VERSION = "aac-flat-v1";

export function buildVisualAssetRequests(
  classification: AIClassification,
  options: BuildVisualRequestOptions = {}
): VisualAssetRequest[] {
  const vocabulary = options.vocabulary ?? APPROVED_VOCABULARY;
  const locale = options.locale ?? "en-US";
  const styleVersion = options.styleVersion ?? DEFAULT_STYLE_VERSION;

  return classification.candidateVocabularyIds
    .map((vocabularyId) => getApprovedVocabularyItem(vocabularyId, vocabulary))
    .filter((item): item is ApprovedVocabularyItem => Boolean(item))
    .map((item) => {
      const concept = item.label.trim().toLowerCase();
      return {
        vocabularyId: item.id,
        normalizedConcept: concept,
        cacheKey: `aac:${item.id}:${locale}:${styleVersion}`,
        webSearchQuery: `${item.label} simple high contrast AAC visual, no text`,
        imageGenerationPrompt: buildAACImagePrompt(item.label),
        styleVersion,
        locale
      };
    });
}

export function buildAACImagePrompt(concept: string): string {
  return [
    `Create a simple high-contrast AAC communication-board illustration of: ${concept}.`,
    "Use one clear central subject, a plain uncluttered background, friendly neutral lighting, bold recognizable shapes, and no written words, letters, logos, watermarks, or extra objects.",
    "Use a consistent flat illustrative style suitable for a child or adult who communicates with visual symbols."
  ].join(" ");
}
