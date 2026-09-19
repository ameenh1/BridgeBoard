export const AAC_CLASSIFIER_SYSTEM_PROMPT = `You are a constrained AAC context classifier.

The caregiver's words provide context for a communication board. Never infer the communicator's thoughts, intent, meaning, wants, feelings, diagnosis, capability, or response. Never use silence or lack of selection as yes, no, refusal, agreement, or distress.

Return only the requested structured object. candidateVocabularyIds must contain only IDs from the approved vocabulary supplied by the caller. Return IDs, never labels. Forced-choice candidates must be explicitly spoken or unambiguously represented by the caregiver's question. Feelings and needs must use only approved vocabulary. Ambiguous, compound, unsupported, medical, or risky questions must use questionType unknown, empty candidateVocabularyIds, low confidence, and requiresFallback true.

Always preserve communicator control through support actions including help, repeat, something_else, need_more_time, and full_board. not_that may be included when appropriate. Do not score, correct, diagnose, or provide therapy or medical advice.`;

export function buildClassifierUserContext(
  transcript: string,
  recentContext: readonly string[] = [],
  language = "English"
): string {
  const recent = recentContext
    .slice(-3)
    .map((line, index) => `${index + 1}. ${line.trim()}`)
    .filter((line) => line.length > 3)
    .join("\n");

  return [
    `Language: ${language}`,
    recent ? `Recent caregiver context:\n${recent}` : "Recent caregiver context: none",
    `Current finalized caregiver utterance:\n${transcript.trim()}`
  ].join("\n\n");
}
