import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { APPROVED_VOCABULARY } from "../data/approvedVocabulary.js";
import {
  classifyDeterministically,
  createUnknownClassification
} from "../lib/ai/deterministicClassifier.js";
import { classifyQuestion } from "../lib/ai/classifyQuestion.js";
import { validateClassification } from "../lib/ai/validation.js";

describe("deterministic AAC classifier", () => {
  it("recognizes the breakfast forced choice", () => {
    const result = classifyDeterministically("Do you want waffles or pancakes?");
    expect(result?.questionType).toBe("forced_choice");
    expect(result?.candidateVocabularyIds).toEqual(["food_waffles", "food_pancakes"]);
    expect(result?.requiresFallback).toBe(false);
  });

  it("recognizes feelings without inferring a feeling", () => {
    const result = classifyDeterministically("How are you feeling?", 8);
    expect(result?.topic).toBe("feelings");
    expect(result?.candidateVocabularyIds).toContain("emotion_happy");
    expect(result?.candidateVocabularyIds).toContain("emotion_tired");
  });

  it("recognizes personal cup choices", () => {
    const result = classifyDeterministically("Do you want your blue cup or red cup?");
    expect(result?.candidateVocabularyIds).toEqual([
      "personal_blue_cup",
      "personal_red_cup"
    ]);
  });

  it("recognizes yes/no outside and bathroom contexts", () => {
    expect(classifyDeterministically("Do you want to go outside?")?.candidateVocabularyIds).toEqual([
      "action_yes",
      "action_no",
      "action_later"
    ]);
    expect(classifyDeterministically("Do you need the bathroom?")?.candidateVocabularyIds).toEqual([
      "need_bathroom",
      "action_yes",
      "action_no",
      "need_help"
    ]);
  });

  it("falls back for uncertain and medical questions", () => {
    expect(classifyDeterministically("Should we maybe go after you finish that unless you want something different?")?.requiresFallback).toBe(true);
    expect(classifyDeterministically("Should we change the medication dose?")?.requiresFallback).toBe(true);
    expect(classifyDeterministically("")?.questionText).toBe("");
  });
});

describe("classification safety boundary", () => {
  it("rejects an invented vocabulary ID instead of partially trusting it", () => {
    const result = validateClassification(
      {
        ...createUnknownClassification("Do you want a dragon?"),
        questionType: "forced_choice",
        topic: "other",
        candidateVocabularyIds: ["invented_id"],
        confidence: 0.95,
        requiresFallback: false
      },
      APPROVED_VOCABULARY
    );

    expect(result.requiresFallback).toBe(true);
    expect(result.candidateVocabularyIds).toEqual([]);
  });

  it("uses the injected structured model result only for unmatched text", async () => {
    const parse = async () => ({
      output_parsed: {
        questionType: "forced_choice",
        questionText: "Do you want tea or water?",
        topic: "drink",
        candidateVocabularyIds: ["drink_water"],
        supportActions: ["help", "repeat", "something_else", "need_more_time", "full_board"],
        confidence: 0.8,
        requiresFallback: false
      }
    });
    const fakeClient = { responses: { parse } } as unknown as OpenAI;

    const result = await classifyQuestion("Would you like a different drink?", {
      allowLiveAI: true,
      openAIClient: fakeClient
    });

    expect(result.candidateVocabularyIds).toEqual(["drink_water"]);
    expect(result.requiresFallback).toBe(false);
  });
});
