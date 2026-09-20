import { describe, expect, it } from "vitest";
import { getFullBoardCategories, ungroupedCategories } from "@/lib/board/fullBoard";
import { approvedVocabulary } from "@/lib/vocabulary/approvedVocabulary";
import { DEFAULT_BOARD_ROWS } from "@/lib/board/defaultBoardLayout";

describe("full board", () => {
  it("reaches every approved word", () => {
    // The point of this board. A word that is approved but appears nowhere
    // manually can only be said if the classifier proposes it, which makes
    // the AI the gatekeeper for part of someone's vocabulary.
    const onBoard = new Set(
      getFullBoardCategories().flatMap((group) => group.choices.map((c) => c.id)),
    );
    const missing = approvedVocabulary.filter((item) => !onBoard.has(item.id));
    expect(missing.map((item) => item.id)).toEqual([]);
  });

  it("leaves no catalog category ungrouped", () => {
    // body_needs was ungrouped, which silently dropped `body_hurt`.
    expect(ungroupedCategories()).toEqual([]);
  });

  it("covers the words the default board cannot reach", () => {
    const quickBoard = new Set(DEFAULT_BOARD_ROWS.flatMap((row) => row.ids));
    const beyondQuickBoard = approvedVocabulary.filter((item) => !quickBoard.has(item.id));
    const full = new Set(
      getFullBoardCategories().flatMap((group) => group.choices.map((c) => c.id)),
    );

    // Mom, Dad, Home, School, Play, Worried and the rest.
    expect(beyondQuickBoard.length).toBeGreaterThan(0);
    for (const item of beyondQuickBoard) {
      expect(full.has(item.id), `${item.id} is unreachable without the AI`).toBe(true);
    }
  });

  it("never repeats a word between groups", () => {
    const ids = getFullBoardCategories().flatMap((group) => group.choices.map((c) => c.id));
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("gives every tile a label, a phrase and a symbol", () => {
    for (const group of getFullBoardCategories()) {
      expect(group.choices.length, `${group.key} is empty`).toBeGreaterThan(0);
      for (const choice of group.choices) {
        expect(choice.label.length).toBeGreaterThan(0);
        expect(choice.spokenPhrase.length).toBeGreaterThan(0);
        // Usable before any image work, which is the whole contract here.
        expect(choice.iconKey.length).toBeGreaterThan(0);
      }
    }
  });

  it("speaks only catalog-authored phrases", () => {
    const authored = new Set(approvedVocabulary.map((item) => item.spokenPhrase));
    for (const group of getFullBoardCategories()) {
      for (const choice of group.choices) {
        expect(authored.has(choice.spokenPhrase)).toBe(true);
      }
    }
  });
});
