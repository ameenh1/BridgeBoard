import { describe, expect, it } from "vitest";
import { buildRenderableBoard } from "@/lib/board/buildRenderableBoard";
import {
  findExactConceptSpan,
  validatedDynamicConcepts,
  validatedResponseConcepts,
  validatedSuggestedConcepts,
} from "@/lib/board/dynamicConcepts";
import { DEFAULT_PROFILE } from "@/types/profile";

function classification(overrides: Record<string, unknown> = {}) {
  return {
    questionType: "forced_choice",
    questionText: "untrusted model echo",
    topic: "food",
    candidateVocabularyIds: ["food_waffles"],
    explicitVisualConcepts: ["dragon fruit"],
    suggestedResponseConcepts: [],
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

  it("organizes an open where-question into catalog destinations instead of falling back", async () => {
    const board = await buildRenderableBoard(
      classification({
        candidateVocabularyIds: ["place_home", "place_school", "place_outside", "place_car"],
        explicitVisualConcepts: [],
        topic: "places",
      }),
      DEFAULT_PROFILE,
      "Where do you want to go?",
    );
    expect(board.isFallback).toBe(false);
    expect(board.choices.map((choice) => choice.label)).toEqual([
      "Home",
      "School",
      "Outside",
    ]);
  });

  it("corrects a legacy places classification for where-to-eat", async () => {
    const board = await buildRenderableBoard(
      classification({
        questionType: "forced_choice",
        candidateVocabularyIds: ["place_home", "place_school", "place_outside", "place_car"],
        explicitVisualConcepts: [],
        topic: "places",
      }),
      { ...DEFAULT_PROFILE, maxChoices: 8 },
      "Where do you want to eat?",
    );

    expect(board.choices.map((choice) => choice.label)).toEqual([
      "Restaurant",
      "Café",
      "Fast food",
      "Picnic",
      "Home",
    ]);
  });

  it("offers food-place answers for an open eating-location question", async () => {
    const board = await buildRenderableBoard(
      classification({
        questionType: "open_ended",
        candidateVocabularyIds: ["place_car", "place_school", "food_place_restaurant"],
        explicitVisualConcepts: [],
        suggestedAnswerConcepts: ["Café", "Fast food", "Picnic", "School", "I want pizza", "something"],
        topic: "food_places",
      }),
      { ...DEFAULT_PROFILE, maxChoices: 8 },
      "Where do you want to eat?",
    );

    expect(board.isFallback).toBe(false);
    expect(board.choices.map((choice) => choice.label)).toEqual([
      "Restaurant",
      "Café",
      "Fast food",
      "Picnic",
    ]);
    expect(board.choices.map((choice) => choice.label)).not.toContain("Car");
    expect(board.choices.map((choice) => choice.label)).not.toContain("School");
  });

  it("uses model-proposed food answers for a general open question", async () => {
    const board = await buildRenderableBoard(
      classification({
        questionType: "open_ended",
        candidateVocabularyIds: ["food_eat"],
        explicitVisualConcepts: [],
        suggestedAnswerConcepts: ["Pizza", "Pasta", "Fruit"],
        topic: "food",
      }),
      { ...DEFAULT_PROFILE, maxChoices: 8 },
      "What do you want to eat?",
    );

    expect(board.choices.map((choice) => choice.label)).toEqual(["Pizza", "Pasta", "Fruit"]);
    expect(board.choices.every((choice) => choice.spokenPhrase === choice.label)).toBe(true);
  });

  it("builds contextual response choices for a caregiver statement", async () => {
    const board = await buildRenderableBoard(
      classification({
        questionType: "statement",
        topic: "other",
        candidateVocabularyIds: [],
        explicitVisualConcepts: [],
        suggestedResponseConcepts: ["Yes", "No", "Not yet", "I need more time"],
      }),
      { ...DEFAULT_PROFILE, maxChoices: 8 },
      "Dinner is ready",
    );

    expect(board.isFallback).toBe(false);
    expect(board.title).toBe("Choose a response");
    expect(board.boardType).toBe("choice");
    expect(board.choices.map((choice) => choice.label)).toEqual([
      "Yes",
      "No",
      "Not yet",
      "I need more time",
    ]);
    expect(board.choices.every((choice) => choice.spokenPhrase === choice.label)).toBe(true);
  });

  it("keeps statement responses contextual instead of rendering destination nouns", async () => {
    const board = await buildRenderableBoard(
      classification({
        questionType: "statement",
        topic: "places",
        candidateVocabularyIds: ["place_school", "place_car", "core_yes"],
        explicitVisualConcepts: [],
        suggestedResponseConcepts: ["I want to go", "I don't want to go", "Later", "Stay home"],
      }),
      { ...DEFAULT_PROFILE, maxChoices: 8 },
      "We're going to school",
    );

    expect(board.isFallback).toBe(false);
    expect(board.choices.map((choice) => choice.label)).not.toContain("School");
    expect(board.choices.map((choice) => choice.label)).not.toContain("Car");
    expect(board.choices.map((choice) => choice.label)).toContain("I want to go");
  });

  it("limits statement responses to four and honors smaller profiles", async () => {
    const board = await buildRenderableBoard(
      classification({
        questionType: "statement",
        candidateVocabularyIds: [],
        explicitVisualConcepts: [],
        suggestedResponseConcepts: ["Yes", "No", "Not yet", "Later"],
      }),
      { ...DEFAULT_PROFILE, maxChoices: 2 },
      "Dinner is ready",
    );

    expect(board.choices).toHaveLength(2);
  });

  it("uses useful topic fallbacks when open-ended suggestions are invalid", async () => {
    const board = await buildRenderableBoard(
      classification({
        questionType: "open_ended",
        candidateVocabularyIds: [],
        explicitVisualConcepts: [],
        suggestedAnswerConcepts: ["something", "I want pizza", "https://example.com"],
        topic: "food_places",
      }),
      { ...DEFAULT_PROFILE, maxChoices: 8 },
      "Where do you want to eat?",
    );

    expect(board.isFallback).toBe(false);
    expect(board.choices.map((choice) => choice.label)).toEqual([
      "Restaurant",
      "Café",
      "Fast food",
      "Picnic",
      "Home",
    ]);
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

  it("rejects vague, sentence-like, and unsafe model suggestions", () => {
    expect(
      validatedSuggestedConcepts([
        "restaurant",
        "Restaurant",
        "something",
        "that place",
        "I want pizza",
        "https://example.com",
        "example.com",
        "Pizza is delicious",
        "self-harm",
      ]).map((item) => item.concept),
    ).toEqual(["restaurant"]);
  });

  it("allows short first-person statement responses and rejects unsafe or vague replies", () => {
    expect(
      validatedResponseConcepts([
        "Yes",
        "No",
        "Not yet",
        "I need more time",
        "I want to go",
        "I don't want to go",
        "Stay home",
        "something",
        "Please go",
        "Go now",
        "Take medicine",
        "Call 911",
        "You should rest",
        "Pizza is delicious",
        "https://example.com",
        "self-harm",
        "I want to go",
      ]).map((item) => item.concept),
    ).toEqual([
      "Yes",
      "No",
      "Not yet",
      "I need more time",
      "I want to go",
      "I don't want to go",
      "Stay home",
    ]);
  });
});
