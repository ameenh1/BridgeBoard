import type { BoardType } from "@/types/board";

/** Question types the classifier may report. Mirrors the agreed AI contract. */
export type QuestionType =
  | "forced_choice"
  | "feelings_needs"
  | "yes_no"
  | "body_needs"
  | "unknown";

const TITLES: Record<QuestionType, string> = {
  forced_choice: "You can pick one",
  feelings_needs: "How are you feeling?",
  yes_no: "Yes or no?",
  body_needs: "What do you need?",
  unknown: "I'm not sure how to organize that question.",
};

const TOPIC_TITLES: Partial<Record<string, string>> = {
  food: "What would you like to eat?",
  drink: "What would you like to drink?",
  bathroom: "What do you need?",
};

/**
 * A short, neutral prompt for the board. Phrased as an invitation, never as a
 * question with a correct answer.
 */
export function getBoardTitle(questionType: QuestionType, topic: string): string {
  if (questionType === "forced_choice") {
    return TOPIC_TITLES[topic] ?? TITLES.forced_choice;
  }
  return TITLES[questionType];
}

export function mapQuestionType(questionType: QuestionType): BoardType {
  switch (questionType) {
    case "forced_choice":
      return "choice";
    case "feelings_needs":
      return "feelings_needs";
    case "yes_no":
      return "yes_no";
    case "body_needs":
      return "feelings_needs";
    case "unknown":
      return "fallback";
  }
}
