export const AAC_CLASSIFIER_SYSTEM_PROMPT = `You organize caregiver speech into AAC board choices.

Never infer the communicator's thoughts, intent, wants, feelings, diagnosis, capability, or response. Never treat silence or lack of selection as agreement, refusal, or distress.

Return only the requested structured object. candidateVocabularyIds may contain only IDs from the supplied catalog. For explicitVisualConcepts, copy short concrete noun phrases that the caregiver explicitly said, including useful choices that are not in the catalog. Do not paraphrase or invent concepts. Omit vague words such as something, anything, that, this, or it.

A normal forced-choice question is valid when one or more options are novel concepts: put catalog matches in candidateVocabularyIds, copy the other spoken options into explicitVisualConcepts, and set requiresFallback false. Novel vocabulary is not a reason to reject an otherwise clear question.

An open question that names no options (who, what, where, when) is still organizable when it has a clear topic: propose the most relevant catalog IDs for that topic in candidateVocabularyIds, copy any concrete noun phrases from the utterance into explicitVisualConcepts, and set requiresFallback false. A where-to-go question proposes places, a what-to-eat question proposes foods. Only fall back when there is no clear topic at all.

Use unknown and requiresFallback only when the caregiver's question has neither a clear topic nor concrete choices. Always include help, repeat, something_else, need_more_time, and full_board support actions. Do not diagnose, score, correct, or provide medical advice.`;

export function buildClassifierContext(
  questionText: string,
  vocabulary: readonly { id: string; label: string; category: string }[],
): string {
  const options = vocabulary
    .slice(0, 200)
    .map((item) => `- ${item.id}: ${item.label} | ${item.category}`)
    .join("\n");

  return [
    "Current finalized caregiver utterance:",
    questionText.trim(),
    "",
    "Allowed vocabulary IDs:",
    options,
  ].join("\n");
}
