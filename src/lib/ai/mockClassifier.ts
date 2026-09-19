/**
 * Stand-in for Person 2's classifier so the pipeline can be built and tested
 * before the real model lands.
 *
 * Returns `unknown` on purpose — identical to the real contract — so the
 * validation layer downstream is exercised exactly as it will be in
 * production. Swapping the implementation must not change a single gate.
 */
export async function temporaryMockClassifier(questionText: string): Promise<unknown> {
  const q = questionText.toLowerCase();

  const base = {
    questionText,
    supportActions: [
      "help",
      "repeat",
      "something_else",
      "need_more_time",
      "full_board",
    ],
    requiresFallback: false,
  };

  if (q.includes("waffle") || q.includes("pancake")) {
    return {
      ...base,
      questionType: "forced_choice",
      topic: "food",
      candidateVocabularyIds: ["food_waffles", "food_pancakes"],
      confidence: 0.96,
    };
  }

  if (q.includes("blue cup") || q.includes("red cup")) {
    return {
      ...base,
      questionType: "forced_choice",
      topic: "drink",
      candidateVocabularyIds: ["personal_blue_cup", "personal_red_cup"],
      confidence: 0.94,
    };
  }

  if (q.includes("how are you feeling") || q.includes("how do you feel")) {
    return {
      ...base,
      questionType: "feelings_needs",
      topic: "feelings",
      candidateVocabularyIds: [
        "emotion_happy",
        "emotion_sad",
        "emotion_tired",
        "emotion_overwhelmed",
      ],
      confidence: 0.93,
    };
  }

  if (q.includes("bathroom")) {
    return {
      ...base,
      questionType: "body_needs",
      topic: "bathroom",
      candidateVocabularyIds: ["need_bathroom", "core_no"],
      confidence: 0.9,
    };
  }

  if (q.includes("water") || q.includes("outside")) {
    return {
      ...base,
      questionType: "yes_no",
      topic: q.includes("water") ? "drink" : "activities",
      candidateVocabularyIds: ["core_yes", "core_no"],
      confidence: 0.91,
    };
  }

  // Anything we do not recognize is uncertainty, not a guess.
  return {
    questionText,
    questionType: "unknown",
    topic: "other",
    candidateVocabularyIds: [],
    supportActions: ["help", "repeat", "need_more_time", "full_board"],
    confidence: 0.28,
    requiresFallback: true,
  };
}
