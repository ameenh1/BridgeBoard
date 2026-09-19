import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import {
  APPROVED_VOCABULARY,
  getApprovedVocabularySpeechKeywords
} from "../data/approvedVocabulary.js";
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

  it("recognizes common bathroom speech aliases", () => {
    for (const transcript of [
      "Do you need the bath room?",
      "Do you want to use the restroom?",
      "Do you need to go to the rest room?",
      "Do you need the toilet?",
      "Do you need to go potty?",
      "Do you need the washroom?"
    ]) {
      expect(classifyDeterministically(transcript)?.candidateVocabularyIds).toEqual([
        "need_bathroom",
        "action_yes",
        "action_no",
        "need_help"
      ]);
    }
  });

  it("falls back for uncertain and medical questions", () => {
    expect(classifyDeterministically("Should we maybe go after you finish that unless you want something different?")?.requiresFallback).toBe(true);
    expect(classifyDeterministically("Should we change the medication dose?")?.requiresFallback).toBe(true);
    expect(classifyDeterministically("")?.questionText).toBe("");
  });
});

describe("classification safety boundary", () => {
  it("joins only a fresh split bathroom word supplied as recent context", async () => {
    const result = await classifyQuestion("room", {
      recentContext: ["Do you want to go to the bath"],
      allowLiveAI: false
    });
    expect(result.candidateVocabularyIds).toEqual([
      "need_bathroom",
      "action_yes",
      "action_no",
      "need_help"
    ]);

    const isolated = await classifyQuestion("room", { allowLiveAI: false });
    expect(isolated.candidateVocabularyIds).toEqual([]);
    expect(isolated.requiresFallback).toBe(true);
  });

  it("builds sanitized Realtime keywords from approved vocabulary and aliases", () => {
    const keywords = getApprovedVocabularySpeechKeywords();
    expect(keywords).toContain("bathroom");
    expect(keywords).toContain("bath room");
    expect(keywords).toContain("restroom");
    expect(keywords).toContain("potty");
    expect(keywords.every((keyword) => !/[<>\r\n]/u.test(keyword))).toBe(true);
  });

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

  it("keeps explicit unapproved visual concepts separate from approved IDs", async () => {
    const parse = async () => ({
      output_parsed: {
        questionType: "forced_choice",
        questionText: "Would you like a guitar or piano?",
        topic: "other",
        candidateVocabularyIds: [],
        explicitVisualConcepts: ["guitar", "Piano"],
        supportActions: ["help", "repeat", "something_else", "need_more_time", "full_board"],
        confidence: 0.86,
        requiresFallback: false
      }
    });
    const fakeClient = { responses: { parse } } as unknown as OpenAI;

    const result = await classifyQuestion("Would you like a guitar or piano?", {
      allowLiveAI: true,
      openAIClient: fakeClient
    });

    expect(result.candidateVocabularyIds).toEqual([]);
    expect(result.explicitVisualConcepts).toEqual(["guitar", "piano"]);
    expect(result.requiresFallback).toBe(false);
  });
});
