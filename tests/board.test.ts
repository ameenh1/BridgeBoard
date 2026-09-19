import { describe, expect, it } from "vitest";
import { buildRenderableBoard } from "@/lib/board/buildRenderableBoard";
import { findExactConceptSpan, validatedDynamicConcepts } from "@/lib/board/dynamicConcepts";
import { DEFAULT_PROFILE } from "@/types/profile";

function classification(overrides: Record<string, unknown> = {}) {
  return {
    questionType: "forced_choice",
    questionText: "untrusted model echo",
    topic: "food",
    candidateVocabularyIds: ["food_waffles"],
    explicitVisualConcepts: ["dragon fruit"],
    supportActions: ["help", "repeat", "something_else", "need_more_time", "full_board"],
    confidence: 0.95,
    requiresFallback: false,
    ...overrides,
  };
}

describe("production board construction", () => {
  it("uses original caregiver text and includes exact novel concepts", async () => {
    const original = "Would you like Waffles or Dragon Fruit?";
    const board = await buildRenderableBoard(classification(), DEFAULT_PROFILE, original);

    expect(board.questionText).toBe(original);
    expect(board.choices.map((choice) => choice.label)).toEqual(["Waffles", "Dragon Fruit"]);
    expect(board.choices.every((choice) => choice.label && choice.iconKey)).toBe(true);
    expect(board.choices.every((choice) => choice.visual.status === "pending")).toBe(true);
  });

  it("rejects model concepts that are not exact caregiver phrases", async () => {
    const board = await buildRenderableBoard(
      classification({ explicitVisualConcepts: ["unicorn", "fruit"] }),
      DEFAULT_PROFILE,
      "Would you like waffles or dragon fruit?",
    );
    expect(board.choices.map((choice) => choice.label)).toEqual(["Waffles", "fruit"]);
  });

  it("deduplicates concepts and respects the profile choice limit", async () => {
    const board = await buildRenderableBoard(
      classification({
        candidateVocabularyIds: ["food_waffles", "food_pancakes"],
        explicitVisualConcepts: ["juice", "juice", "toast"],
      }),
      { ...DEFAULT_PROFILE, maxChoices: 2 },
      "Waffles, pancakes, juice, or toast?",
    );
    expect(board.choices).toHaveLength(2);
  });

  it("maps body needs to its own board type", async () => {
    const board = await buildRenderableBoard(
      classification({
        questionType: "body_needs",
        topic: "body_needs",
        candidateVocabularyIds: ["need_help"],
        explicitVisualConcepts: [],
      }),
      DEFAULT_PROFILE,
      "What does your body need?",
    );
    expect(board.boardType).toBe("body_needs");
  });
});

describe("exact concept spans", () => {
  it("preserves the caregiver's original casing", () => {
    expect(findExactConceptSpan("Try Dragon Fruit today", "dragon fruit")).toBe("Dragon Fruit");
  });

  it("rejects vague and repeated concepts", () => {
    expect(validatedDynamicConcepts("Do you want that or juice?", ["that", "juice", "juice"]))
      .toHaveLength(1);
  });
});
