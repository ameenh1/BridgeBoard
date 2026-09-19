// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSettings,
  hasStoredSettings,
  loadSettings,
  saveSettings,
  updateSettings,
} from "@/lib/storage/settings";
import { appendHistory, clearHistory, loadHistory } from "@/lib/storage/history";
import { DEFAULT_PROFILE } from "@/types/profile";

const PROFILE_KEY = "bridgeboard.profile.v1";
const HISTORY_KEY = "bridgeboard.history.v1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("settings", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_PROFILE);
    expect(hasStoredSettings()).toBe(false);
  });

  it("round-trips the new fields", () => {
    saveSettings({
      ...DEFAULT_PROFILE,
      displayName: "Cha",
      buttonSize: "standard",
      speechRate: 1.2,
      voiceURI: "urn:voice:test",
    });

    const loaded = loadSettings();
    expect(loaded.displayName).toBe("Cha");
    expect(loaded.buttonSize).toBe("standard");
    expect(loaded.speechRate).toBe(1.2);
    expect(loaded.voiceURI).toBe("urn:voice:test");
    expect(hasStoredSettings()).toBe(true);
  });

  it("migrates a profile stored by the previous build instead of resetting it", () => {
    // The shape before displayName / buttonSize / speechRate existed.
    window.localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        id: "demo-profile",
        maxChoices: 6,
        visuals: "mixed",
        speechEnabled: false,
        quietMode: true,
        textLabelsEnabled: false,
        historyEnabled: false,
      }),
    );

    const loaded = loadSettings();
    // Everything the caregiver had actually chosen survives...
    expect(loaded.id).toBe("demo-profile");
    expect(loaded.maxChoices).toBe(6);
    expect(loaded.visuals).toBe("mixed");
    expect(loaded.speechEnabled).toBe(false);
    expect(loaded.quietMode).toBe(true);
    expect(loaded.historyEnabled).toBe(false);
    // ...and the new fields arrive with defaults rather than wiping the rest.
    expect(loaded.displayName).toBe("");
    expect(loaded.buttonSize).toBe("large");
    expect(loaded.speechRate).toBe(0.9);
    expect(hasStoredSettings()).toBe(true);
  });

  it("falls back to defaults on corrupt storage", () => {
    window.localStorage.setItem(PROFILE_KEY, "{not json");
    expect(loadSettings()).toEqual(DEFAULT_PROFILE);
    expect(hasStoredSettings()).toBe(false);
  });

  it("falls back to defaults when the stored shape is wrong", () => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ id: 7, maxChoices: 5 }));
    expect(loadSettings()).toEqual(DEFAULT_PROFILE);
  });

  it("refuses to persist an out-of-range speech rate", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    saveSettings({ ...DEFAULT_PROFILE, speechRate: 4 });
    expect(window.localStorage.getItem(PROFILE_KEY)).toBeNull();
    expect(error).toHaveBeenCalled();
  });

  it("refuses to persist an unknown button size", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    saveSettings({
      ...DEFAULT_PROFILE,
      buttonSize: "gigantic" as unknown as "large",
    });
    expect(window.localStorage.getItem(PROFILE_KEY)).toBeNull();
  });

  it("clears", () => {
    saveSettings({ ...DEFAULT_PROFILE, displayName: "Cha" });
    clearSettings();
    expect(hasStoredSettings()).toBe(false);
  });

  it("updates in place", () => {
    updateSettings({ displayName: "Cha" });
    expect(updateSettings({ quietMode: true }).displayName).toBe("Cha");
  });
});

describe("history", () => {
  it("stores and reads a body_needs entry", () => {
    // This is the regression: body_needs was missing from the schema enum, so
    // one such entry made the next read discard the whole log.
    appendHistory({ boardType: "choice", selectedLabel: "Waffles" }, true);
    appendHistory({ boardType: "body_needs", selectedLabel: "Hurt" }, true);

    const entries = loadHistory();
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.selectedLabel)).toEqual(["Waffles", "Hurt"]);
  });

  it("does nothing when history is disabled", () => {
    appendHistory({ boardType: "choice", selectedLabel: "Waffles" }, false);
    expect(loadHistory()).toEqual([]);
  });

  it("keeps at most 50 entries, newest kept", () => {
    for (let index = 0; index < 60; index += 1) {
      appendHistory({ boardType: "choice", selectedLabel: `word-${index}` }, true);
    }
    const entries = loadHistory();
    expect(entries).toHaveLength(50);
    expect(entries[0].selectedLabel).toBe("word-10");
    expect(entries.at(-1)?.selectedLabel).toBe("word-59");
  });

  it("records the originating question", () => {
    appendHistory(
      { boardType: "choice", questionText: "Waffles or pancakes?", selectedLabel: "Waffles" },
      true,
    );
    expect(loadHistory()[0].questionText).toBe("Waffles or pancakes?");
  });

  it("drops an unreadable log rather than rendering half of it", () => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([{ id: 1 }]));
    expect(loadHistory()).toEqual([]);
  });

  it("clears", () => {
    appendHistory({ boardType: "choice", selectedLabel: "Waffles" }, true);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
