// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPersonalPhotos,
  loadPersonalPhotos,
  personalPhotoMap,
  removePersonalPhoto,
  savePersonalPhoto,
  PERSONAL_PHOTO_LIMIT,
} from "@/lib/storage/personalPhotos";
import {
  applyPersonalPhotos,
  personalizedAssetKeys,
} from "@/lib/board/applyPersonalPhotos";
import type { RenderableBoard, RenderableChoice } from "@/types/board";

const KEY = "bridgeboard.personalPhotos.v1";
const PHOTO = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

beforeEach(() => window.localStorage.clear());

function choice(id: string, ready: boolean): RenderableChoice {
  return {
    id,
    choiceKey: id,
    label: id,
    spokenPhrase: `I want ${id}.`,
    iconKey: "cup-soda",
    origin: "catalog",
    visual: ready
      ? { assetKey: `${id}-key`, status: "ready", source: "curated", url: `/default-images/${id}.webp` }
      : { assetKey: `${id}-key`, status: "pending" },
  };
}

function board(choices: RenderableChoice[]): RenderableBoard {
  return {
    boardId: "33333333-3333-4333-8333-333333333333",
    title: "Choices",
    boardType: "choice",
    choices,
    actions: ["help"],
    isFallback: false,
    isRefreshing: false,
  };
}

describe("personal photo storage", () => {
  it("round-trips a photo", () => {
    savePersonalPhoto("need_water", PHOTO);
    const stored = loadPersonalPhotos();
    expect(stored).toHaveLength(1);
    expect(stored[0].vocabularyId).toBe("need_water");
    expect(stored[0].dataUrl).toBe(PHOTO);
  });

  it("replaces rather than duplicates a photo for the same word", () => {
    savePersonalPhoto("need_water", PHOTO);
    savePersonalPhoto("need_water", PHOTO);
    expect(loadPersonalPhotos()).toHaveLength(1);
  });

  it("refuses anything that is not an image data URL", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Notably a remote URL: these must never leave the device, so a photo
    // that is really a link somewhere else is not a photo.
    savePersonalPhoto("need_water", "https://example.com/cup.png");
    savePersonalPhoto("food_eat", "data:text/html;base64,PHNjcmlwdD4=");
    expect(loadPersonalPhotos()).toEqual([]);
  });

  it("drops an unreadable store instead of throwing", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(loadPersonalPhotos()).toEqual([]);
  });

  it("survives storage being unavailable", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadPersonalPhotos()).toEqual([]);
    getItem.mockRestore();
  });

  it("keeps existing photos when the quota is hit", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    savePersonalPhoto("need_water", PHOTO);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const after = savePersonalPhoto("food_eat", PHOTO);
    expect(after).toHaveLength(1);
    expect(after[0].vocabularyId).toBe("need_water");
    setItem.mockRestore();
  });

  it("enforces a limit", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (let i = 0; i < PERSONAL_PHOTO_LIMIT + 4; i += 1) {
      savePersonalPhoto(`word_${i}`, PHOTO);
    }
    expect(loadPersonalPhotos()).toHaveLength(PERSONAL_PHOTO_LIMIT);
  });

  it("removes and clears", () => {
    savePersonalPhoto("need_water", PHOTO);
    savePersonalPhoto("food_eat", PHOTO);
    expect(removePersonalPhoto("need_water")).toHaveLength(1);
    clearPersonalPhotos();
    expect(loadPersonalPhotos()).toEqual([]);
  });
});

describe("applying photos to a board", () => {
  it("beats a ready curated image", () => {
    // The whole point: a drawing of a cup is not this person's cup.
    const before = board([choice("need_water", true)]);
    expect(before.choices[0].visual.url).toBe("/default-images/need_water.webp");

    const after = applyPersonalPhotos(before, new Map([["need_water", PHOTO]]));
    expect(after.choices[0].visual.url).toBe(PHOTO);
    expect(after.choices[0].visual.source).toBe("personal");
    expect(after.choices[0].origin).toBe("personal");
    expect(after.choices[0].visual.status).toBe("ready");
  });

  it("resolves a pending visual immediately", () => {
    const after = applyPersonalPhotos(
      board([choice("food_eat", false)]),
      new Map([["food_eat", PHOTO]]),
    );
    expect(after.choices[0].visual.status).toBe("ready");
  });

  it("keeps the assetKey so board merging still recognises the choice", () => {
    const after = applyPersonalPhotos(
      board([choice("need_water", true)]),
      new Map([["need_water", PHOTO]]),
    );
    expect(after.choices[0].visual.assetKey).toBe("need_water-key");
  });

  it("leaves other choices untouched", () => {
    const after = applyPersonalPhotos(
      board([choice("need_water", true), choice("food_eat", true)]),
      new Map([["need_water", PHOTO]]),
    );
    expect(after.choices[1].visual.source).toBe("curated");
    expect(after.choices[1].origin).toBe("catalog");
  });

  it("returns the same board when nothing matches, so React skips a render", () => {
    const before = board([choice("need_water", true)]);
    expect(applyPersonalPhotos(before, new Map())).toBe(before);
    expect(applyPersonalPhotos(before, new Map([["place_home", PHOTO]]))).toBe(before);
  });

  it("names the asset keys that no longer need resolving", () => {
    const current = board([choice("need_water", false), choice("food_eat", false)]);
    expect(personalizedAssetKeys(current, new Map([["need_water", PHOTO]]))).toEqual([
      "need_water-key",
    ]);
  });

  it("builds a lookup keyed by vocabulary id", () => {
    savePersonalPhoto("need_water", PHOTO);
    expect(personalPhotoMap().get("need_water")).toBe(PHOTO);
  });
});
