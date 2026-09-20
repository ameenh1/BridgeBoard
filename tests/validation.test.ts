import { describe, expect, it } from "vitest";
import { AIClassificationSchema } from "@/lib/validation/aiClassification";

const statementClassification = {
  questionType: "statement" as const,
  questionText: "Dinner is ready",
  topic: "other" as const,
  candidateVocabularyIds: [],
  explicitVisualConcepts: [],
  suggestedAnswerConcepts: [],
  suggestedResponseConcepts: ["Yes", "No", "Not yet", "I need more time"],
  supportActions: ["help", "repeat", "something_else", "need_more_time", "full_board"] as const,
  confidence: 0.95,
  requiresFallback: false,
};

describe("AI classification contract", () => {
  it("accepts statements and caps response concepts at four", () => {
    const parsed = AIClassificationSchema.safeParse(statementClassification);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.questionType).toBe("statement");
      expect(parsed.data.suggestedResponseConcepts).toHaveLength(4);
    }

    expect(
      AIClassificationSchema.safeParse({
        ...statementClassification,
        suggestedResponseConcepts: ["Yes", "No", "Not yet", "Later", "Stay home"],
      }).success,
    ).toBe(false);
  });

  it("keeps open-ended answer capacity at eight", () => {
    const parsed = AIClassificationSchema.safeParse({
      ...statementClassification,
      questionType: "open_ended",
      topic: "food",
      suggestedAnswerConcepts: ["Pizza", "Pasta", "Fruit", "Rice", "Soup", "Toast", "Salad", "Yogurt"],
      suggestedResponseConcepts: [],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.suggestedAnswerConcepts).toHaveLength(8);
  });
});
