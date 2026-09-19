import type { AIClassification } from "./schemas.js";

export const DEFAULT_SUPPORT_ACTIONS: AIClassification["supportActions"] = [
  "help",
  "repeat",
  "something_else",
  "need_more_time",
  "full_board"
];

function normalizeTranscript(transcript: string): string {
  return transcript
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitCandidates(ids: readonly string[], maxChoices: number): string[] {
  return [...new Set(ids)].slice(0, maxChoices);
}

export function createUnknownClassification(transcript: string, confidence = 0): AIClassification {
  return {
    questionType: "unknown",
    questionText: transcript.trim().slice(0, 300),
    topic: "other",
    candidateVocabularyIds: [],
    explicitVisualConcepts: [],
    supportActions: [...DEFAULT_SUPPORT_ACTIONS],
    confidence,
    requiresFallback: true
  };
}

export function classifyDeterministically(
  transcript: string,
  maxChoices = 4
): AIClassification | null {
  const normalized = normalizeTranscript(transcript);

  if (!normalized) {
    return createUnknownClassification(transcript);
  }

  if (
    normalized.length > 180 ||
    /\b(should we maybe|unless you|medication|medicine|dosage|dose|symptom|diagnos|doctor|prescription|pain)\b/.test(
      normalized
    )
  ) {
    return createUnknownClassification(transcript, 0.2);
  }

  if (normalized.includes("waffle") && normalized.includes("pancake")) {
    return {
      questionType: "forced_choice",
      questionText: transcript.trim().slice(0, 300),
      topic: "food",
      candidateVocabularyIds: limitCandidates(["food_waffles", "food_pancakes"], maxChoices),
      explicitVisualConcepts: [],
      supportActions: [...DEFAULT_SUPPORT_ACTIONS],
      confidence: 0.99,
      requiresFallback: false
    };
  }

  if (/how (are you )?feeling|how do you feel/.test(normalized)) {
    return {
      questionType: "feelings_needs",
      questionText: transcript.trim().slice(0, 300),
      topic: "feelings",
      candidateVocabularyIds: limitCandidates(
        [
          "emotion_happy",
          "emotion_sad",
          "emotion_angry",
          "emotion_worried",
          "emotion_tired",
          "emotion_overwhelmed",
          "need_help",
          "need_break"
        ],
        maxChoices
      ),
      explicitVisualConcepts: [],
      supportActions: [...DEFAULT_SUPPORT_ACTIONS],
      confidence: 0.99,
      requiresFallback: false
    };
  }

  if (normalized.includes("blue cup") && normalized.includes("red cup")) {
    return {
      questionType: "forced_choice",
      questionText: transcript.trim().slice(0, 300),
      topic: "drink",
      candidateVocabularyIds: limitCandidates(
        ["personal_blue_cup", "personal_red_cup"],
        maxChoices
      ),
      explicitVisualConcepts: [],
      supportActions: [...DEFAULT_SUPPORT_ACTIONS],
      confidence: 0.99,
      requiresFallback: false
    };
  }

  if (/\bgo outside\b|\boutside\b/.test(normalized)) {
    return {
      questionType: "yes_no",
      questionText: transcript.trim().slice(0, 300),
      topic: "activities",
      candidateVocabularyIds: limitCandidates(
        ["action_yes", "action_no", "action_later"],
        maxChoices
      ),
      explicitVisualConcepts: [],
      supportActions: [...DEFAULT_SUPPORT_ACTIONS],
      confidence: 0.94,
      requiresFallback: false
    };
  }

  if (/\bbathroom\b|\btoilet\b/.test(normalized)) {
    return {
      questionType: "body_needs",
      questionText: transcript.trim().slice(0, 300),
      topic: "bathroom",
      candidateVocabularyIds: limitCandidates(
        ["need_bathroom", "action_yes", "action_no", "need_help"],
        maxChoices
      ),
      explicitVisualConcepts: [],
      supportActions: [...DEFAULT_SUPPORT_ACTIONS],
      confidence: 0.94,
      requiresFallback: false
    };
  }

  return null;
}

export { normalizeTranscript };
