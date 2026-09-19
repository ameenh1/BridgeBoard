import { getApprovedVocabularyItem, APPROVED_VOCABULARY, type ApprovedVocabularyItem } from "../../data/approvedVocabulary.js";
import type { AIClassification } from "../ai/schemas.js";
import type { BuildVisualRequestOptions, VisualAssetRequest } from "./types.js";

const DEFAULT_STYLE_VERSION = "aac-flat-v1";
const DEFAULT_MAX_VISUAL_ASSETS = 8;

function normalizeConcept(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableConceptHash(value: string): string {
  let hash = 14695981039346656037n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash.toString(16).padStart(16, "0");
}

function displayLabel(value: string): string {
  return value.replace(/(^|\s)(\p{L})/gu, (_match, prefix: string, character: string) =>
    `${prefix}${character.toUpperCase()}`
  );
}

export function buildVisualAssetRequests(
  classification: AIClassification,
  options: BuildVisualRequestOptions = {}
): VisualAssetRequest[] {
  const vocabulary = options.vocabulary ?? APPROVED_VOCABULARY;
  const locale = options.locale ?? "en-US";
  const styleVersion = options.styleVersion ?? DEFAULT_STYLE_VERSION;
  const configuredMaxVisualAssets = options.maxVisualAssets ?? DEFAULT_MAX_VISUAL_ASSETS;
  const maxVisualAssets = Number.isInteger(configuredMaxVisualAssets) && configuredMaxVisualAssets > 0
    ? Math.min(configuredMaxVisualAssets, 12)
    : DEFAULT_MAX_VISUAL_ASSETS;

  const requests: VisualAssetRequest[] = classification.candidateVocabularyIds
    .map((vocabularyId) => getApprovedVocabularyItem(vocabularyId, vocabulary))
    .filter((item): item is ApprovedVocabularyItem => Boolean(item))
    .map((item) => {
      const concept = item.label.trim().toLowerCase();
      return {
        vocabularyId: item.id,
        displayLabel: item.label,
        kind: "approved" as const,
        normalizedConcept: concept,
        cacheKey: `aac:${item.id}:${locale}:${styleVersion}`,
        webSearchQuery: `${item.label} simple high contrast AAC visual, plain background, no text, no logos`,
        imageGenerationPrompt: buildAACImagePrompt(item.label),
        styleVersion,
        locale
      };
    });

  const existingConcepts = new Set(requests.map((request) => request.normalizedConcept));
  for (const rawConcept of classification.explicitVisualConcepts ?? []) {
    const concept = normalizeConcept(rawConcept);
    if (!concept || existingConcepts.has(concept)) {
      continue;
    }

    const conceptHash = stableConceptHash(`${locale}:${styleVersion}:${concept}`);
    requests.push({
      vocabularyId: `concept_${conceptHash}`,
      displayLabel: displayLabel(concept),
      kind: "explicit",
      normalizedConcept: concept,
      cacheKey: `aac:concept:${conceptHash}:${locale}:${styleVersion}`,
      webSearchQuery: `${concept} simple high contrast AAC visual, plain background, no text, no logos`,
      imageGenerationPrompt: buildAACImagePrompt(concept),
      styleVersion,
      locale
    });
    existingConcepts.add(concept);

    if (requests.length >= maxVisualAssets) {
      break;
    }
  }

  return requests.slice(0, maxVisualAssets);
}

export function buildAACImagePrompt(concept: string): string {
  return [
    `Create a simple high-contrast AAC communication-board illustration of: ${concept}.`,
    "Use one clear central subject, a plain uncluttered background, friendly neutral lighting, bold recognizable shapes, and no written words, letters, logos, watermarks, or extra objects.",
    "Use a consistent flat illustrative style suitable for a child or adult who communicates with visual symbols."
  ].join(" ");
}
