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

const VAGUE_SUGGESTION_WORDS = new Set([
  "something",
  "anything",
  "that",
  "it",
  "this",
  "there",
  "here",
  "some",
  "any",
  "whatever",
  "whoever",
  "wherever",
  "one",
  "yes",
  "no",
  "maybe",
]);

const SENTENCE_STARTERS = new Set([
  "i",
  "you",
  "we",
  "they",
  "he",
  "she",
  "let's",
  "want",
  "need",
  "would",
  "could",
  "should",
  "please",
  "do",
]);

const URL_PATTERN =
  /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co)(?:\/|$))/iu;
const UNSUPPORTED_SUGGESTION_PATTERN =
  /\b(?:self[- ]?harm|suicide|weapon|porn|sexual|overdose|kill|murder|bomb|explosive|poison|cocaine|meth|heroin)\b/iu;
const UNSUPPORTED_MEDICAL_ADVICE_PATTERN =
  /\b(?:take|use|stop|start|increase|decrease|change|give|skip|share|avoid|call|contact|see|visit|ask|go)\b[^.!?\n]{0,50}\b(?:medicine|medication|pill|pills|dose|dosage|prescription|diagnosis|treatment|therapy|antibiotic|doctor|nurse|hospital|emergency|911)\b/iu;
const SENTENCE_VERB_PATTERN =
  /\b(?:is|are|am|was|were|has|have|had|will|might|must|want|need|like|love|hate|prefer|feel|feels|seem|seems|look|looks|taste|tastes)\b/iu;

const RESPONSE_VAGUE_WORDS = new Set([
  "something",
  "anything",
  "that",
  "it",
  "this",
  "there",
  "here",
  "whatever",
  "whoever",
  "wherever",
]);

const RESPONSE_INSTRUCTION_STARTERS = new Set([
  "please",
  "you",
  "we",
  "they",
  "let's",
  "should",
  "must",
  "click",
  "tell",
  "try",
  "ask",
  "call",
  "check",
  "choose",
  "close",
  "come",
  "contact",
  "drink",
  "eat",
  "follow",
  "get",
  "give",
  "go",
  "help",
  "hold",
  "listen",
  "look",
  "open",
  "pick",
  "put",
  "remember",
  "see",
  "show",
  "sit",
  "stand",
  "stop",
  "take",
  "use",
  "visit",
  "wait",
  "wash",
  "wear",
]);

const SAFE_SHORT_RESPONSE_PHRASES = new Set([
  "all done",
  "go",
  "later",
  "not yet",
  "stay home",
  "stop",
  "wait",
]);

const FIRST_PERSON_RESPONSE_PATTERN =
  /^(?:i|i'd|i'm|i'll|i've|i don't|i do|i want|i need|i feel|i can|i can't)\b/u;

/**
 * Validates model-proposed answers for an open-ended question.
 *
 * These concepts are deliberately not required to occur in the caregiver's
 * utterance. They are still untrusted model output, so the application keeps
 * them short, concrete, and phrase-like before exposing them to the browser or
 * speech layer.
 */
export function validatedSuggestedConcepts(
  candidates: readonly string[],
): { id: string; concept: string; normalized: string }[] {
  const seen = new Set<string>();
  const result: { id: string; concept: string; normalized: string }[] = [];

  for (const candidate of candidates) {
    const concept = candidate.trim().replace(/\s+/gu, " ").replace(/[.!?]+$/u, "");
    const normalized = normalizeConcept(concept);
    const words = normalized ? normalized.split(" ") : [];
    const firstWord = words[0] ?? "";
    const hasVagueWord = words.some((word) => VAGUE_SUGGESTION_WORDS.has(word));
    const sentenceLike =
      SENTENCE_STARTERS.has(firstWord) ||
      /[.!?]/u.test(candidate.trim().slice(0, -1)) ||
      (words.length >= 3 && SENTENCE_VERB_PATTERN.test(normalized));

    if (
      !concept ||
      concept.length > 80 ||
      words.length === 0 ||
      words.length > 6 ||
      !/^[\p{L}\p{N}][\p{L}\p{N} '&/-]*$/u.test(concept) ||
      URL_PATTERN.test(concept) ||
      UNSUPPORTED_SUGGESTION_PATTERN.test(concept) ||
      hasVagueWord ||
      sentenceLike ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    result.push({ id: createDynamicChoiceId(normalized), concept, normalized });
  }

  return result;
}

/**
 * Validates model-proposed replies to a declarative caregiver statement.
 *
 * Unlike open-ended answer concepts, a response may be a short first-person
 * phrase such as "I want to go" or "I need more time". It is still untrusted
 * model output, so it must remain a bounded phrase rather than a sentence,
 * instruction, URL, or unsafe claim.
 */
export function validatedResponseConcepts(
  candidates: readonly string[],
): { id: string; concept: string; normalized: string }[] {
  const seen = new Set<string>();
  const result: { id: string; concept: string; normalized: string }[] = [];

  for (const candidate of candidates) {
    const concept = candidate.trim().replace(/\s+/gu, " ").replace(/[.!?]+$/u, "");
    const normalized = normalizeConcept(concept);
    const words = normalized ? normalized.split(" ") : [];
    const firstWord = words[0] ?? "";
    const firstPerson = FIRST_PERSON_RESPONSE_PATTERN.test(normalized);
    const sentenceLike =
      /[.!?]/u.test(candidate.trim().slice(0, -1)) ||
      (!firstPerson && words.length >= 3 && SENTENCE_VERB_PATTERN.test(normalized));

    if (
      !concept ||
      concept.length > 80 ||
      words.length === 0 ||
      words.length > 6 ||
      !/^[\p{L}\p{N}][\p{L}\p{N} '&/-]*$/u.test(concept) ||
      URL_PATTERN.test(concept) ||
      UNSUPPORTED_SUGGESTION_PATTERN.test(concept) ||
      RESPONSE_VAGUE_WORDS.has(firstWord) ||
      words.some((word) => RESPONSE_VAGUE_WORDS.has(word)) ||
      (RESPONSE_INSTRUCTION_STARTERS.has(firstWord) && !SAFE_SHORT_RESPONSE_PHRASES.has(normalized)) ||
      UNSUPPORTED_MEDICAL_ADVICE_PATTERN.test(concept) ||
      sentenceLike ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    result.push({ id: createDynamicChoiceId(normalized), concept, normalized });
  }

  return result;
}
