import { createDynamicChoiceId, normalizeConcept } from "@/lib/assets/assetKeys";

type Token = { normalized: string; start: number; end: number };

function tokenize(value: string): Token[] {
  const tokens: Token[] = [];
  for (const match of value.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)) {
    if (match.index === undefined) continue;
    tokens.push({
      normalized: normalizeConcept(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

/** Returns the exact caregiver-authored span or null when the model paraphrased it. */
export function findExactConceptSpan(questionText: string, candidate: string): string | null {
  const questionTokens = tokenize(questionText);
  const conceptTokens = tokenize(candidate).map((token) => token.normalized);
  if (conceptTokens.length === 0 || conceptTokens.length > 6) return null;

  for (let index = 0; index <= questionTokens.length - conceptTokens.length; index += 1) {
    const matches = conceptTokens.every(
      (token, offset) => questionTokens[index + offset]?.normalized === token,
    );
    if (!matches) continue;

    const first = questionTokens[index];
    const last = questionTokens[index + conceptTokens.length - 1];
    if (first && last) return questionText.slice(first.start, last.end);
  }
  return null;
}

export function validatedDynamicConcepts(
  questionText: string,
  candidates: readonly string[],
): { id: string; concept: string; normalized: string }[] {
  const seen = new Set<string>();
  const result: { id: string; concept: string; normalized: string }[] = [];

  for (const candidate of candidates) {
    const concept = findExactConceptSpan(questionText, candidate);
    const normalized = concept ? normalizeConcept(concept) : "";
    if (!concept || !normalized || seen.has(normalized)) continue;
    if (/^(something|anything|that|it|this|there|here|yes|no|maybe)$/u.test(normalized)) continue;
    seen.add(normalized);
    result.push({ id: createDynamicChoiceId(normalized), concept, normalized });
  }

  return result;
}
