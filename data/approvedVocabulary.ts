export type VocabularyCategory =
  | "food"
  | "drink"
  | "feelings"
  | "body_needs"
  | "activities"
  | "personal_items"
  | "support";

export type ApprovedVocabularyItem = {
  id: string;
  label: string;
  category: VocabularyCategory;
  tags: readonly string[];
  allowedForAI?: boolean;
  imagePath?: string;
};

export const BATHROOM_SPEECH_ALIASES = [
  "bathroom",
  "bath room",
  "restroom",
  "rest room",
  "toilet",
  "potty",
  "washroom"
] as const;

/**
 * The initial allowlist is deliberately small. The classifier may return IDs
 * from this list, but never invent labels or arbitrary URLs for the board.
 */
export const APPROVED_VOCABULARY = [
  { id: "food_waffles", label: "Waffles", category: "food", tags: ["breakfast", "food"] },
  { id: "food_pancakes", label: "Pancakes", category: "food", tags: ["breakfast", "food"] },
  { id: "emotion_happy", label: "Happy", category: "feelings", tags: ["emotion", "feeling"] },
  { id: "emotion_sad", label: "Sad", category: "feelings", tags: ["emotion", "feeling"] },
  { id: "emotion_angry", label: "Angry", category: "feelings", tags: ["emotion", "feeling"] },
  { id: "emotion_worried", label: "Worried", category: "feelings", tags: ["emotion", "feeling"] },
  { id: "emotion_tired", label: "Tired", category: "feelings", tags: ["emotion", "feeling"] },
  { id: "emotion_overwhelmed", label: "Overwhelmed", category: "feelings", tags: ["emotion", "feeling"] },
  { id: "need_help", label: "Help", category: "support", tags: ["support", "help"] },
  { id: "need_break", label: "Break", category: "support", tags: ["support", "break"] },
  { id: "need_bathroom", label: "Bathroom", category: "body_needs", tags: ["bathroom", "toilet"] },
  { id: "personal_blue_cup", label: "Blue cup", category: "personal_items", tags: ["cup", "drink", "blue"] },
  { id: "personal_red_cup", label: "Red cup", category: "personal_items", tags: ["cup", "drink", "red"] },
  { id: "action_yes", label: "Yes", category: "support", tags: ["yes", "choice"] },
  { id: "action_no", label: "No", category: "support", tags: ["no", "choice"] },
  { id: "action_later", label: "Later", category: "support", tags: ["later", "choice"] },
  { id: "action_more", label: "More", category: "support", tags: ["more", "support"] },
  { id: "action_stop", label: "Stop", category: "support", tags: ["stop", "support"] },
  { id: "action_outside", label: "Outside", category: "activities", tags: ["outside", "activity"] },
  { id: "action_play", label: "Play", category: "activities", tags: ["play", "activity"] },
  { id: "food_eat", label: "Eat", category: "food", tags: ["eat", "food"] },
  { id: "drink_water", label: "Water", category: "drink", tags: ["drink", "water"] }
] as const satisfies readonly ApprovedVocabularyItem[];

export function getApprovedVocabularyItem(
  vocabularyId: string,
  vocabulary: readonly ApprovedVocabularyItem[] = APPROVED_VOCABULARY
): ApprovedVocabularyItem | undefined {
  return vocabulary.find((item) => item.id === vocabularyId);
}

export function getAllowedVocabulary(
  vocabulary: readonly ApprovedVocabularyItem[] = APPROVED_VOCABULARY
): readonly ApprovedVocabularyItem[] {
  return vocabulary.filter((item) => item.allowedForAI !== false);
}

export function getApprovedVocabularySpeechKeywords(
  vocabulary: readonly ApprovedVocabularyItem[] = APPROVED_VOCABULARY
): string[] {
  const values = getAllowedVocabulary(vocabulary).flatMap((item) => [item.label, ...item.tags]);
  return [...new Set([...values, ...BATHROOM_SPEECH_ALIASES]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0 && !/[<>\r\n]/u.test(value))
  )].slice(0, 64);
}
