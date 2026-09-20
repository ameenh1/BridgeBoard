// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSettings,
  hasStoredSettings,
  loadSettings,
  saveSettings,
  updateSettings,
} from "@/lib/storage/settings";
import { DEFAULT_PROFILE } from "@/types/profile";

const PROFILE_KEY = "bridgeboard.profile.v1";

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

