import { describe, expect, it, vi } from "vitest";
import {
  applyAssetEvent,
  createBoardSessionController,
} from "@/lib/board/boardSessionController";
import type { RenderableBoard, RenderableChoice } from "@/types/board";

const BOARD_ID = "11111111-1111-4111-8111-111111111111";

function choice(key: string, assetKey: string, ready = false): RenderableChoice {
  return {
    id: key,
    choiceKey: key,
    label: key,
    spokenPhrase: `I want ${key}.`,
    iconKey: "shapes",
    origin: "catalog",
    visual: ready
      ? { assetKey, status: "ready", source: "curated", url: `/default-images/${key}.webp` }
      : { assetKey, status: "pending" },
  };
}

function board(choices: RenderableChoice[]): RenderableBoard {
  return {
    boardId: BOARD_ID,
    title: "Choices",
    boardType: "choice",
    choices,
    actions: ["help", "full_board"],
    isFallback: false,
    isRefreshing: false,
  };
}

function respondWith(next: RenderableBoard) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ board: next }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("selected choice", () => {
  it("survives classification and a commit that keeps the choice", async () => {
    const first = board([choice("waffles", "a", true), choice("dragon-fruit", "b", true)]);
    const second = board([choice("waffles", "a"), choice("pancakes", "c")]);

    const controller = createBoardSessionController({
      fetchImpl: respondWith(first),
    });
    await controller.submitQuestion("Waffles or dragon fruit?");
    controller.selectChoice("waffles");
    expect(controller.getState().selectedChoiceKey).toBe("waffles");

    // A second question with a controller pointed at the replacement board.
    const next = createBoardSessionController({ fetchImpl: respondWith(second) });
    next.selectChoice("waffles");
    await next.submitQuestion("Waffles or pancakes?");

    const state = next.getState();
    expect(state.selectedChoiceKey).toBe("waffles");
    expect(state.board?.choices.map((item) => item.choiceKey)).toEqual(["waffles", "pancakes"]);
  });

  it("clears only when a committed board drops the choice", async () => {
    const replacement = board([choice("pancakes", "c")]);
    const controller = createBoardSessionController({ fetchImpl: respondWith(replacement) });

    controller.selectChoice("dragon-fruit");
    expect(controller.getState().selectedChoiceKey).toBe("dragon-fruit");

    await controller.submitQuestion("Pancakes?");
    expect(controller.getState().selectedChoiceKey).toBeUndefined();
  });

  it("holds the selection while a classification is still in flight", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = vi.fn(async () => {
      await gate;
      return new Response(JSON.stringify({ board: board([choice("waffles", "a")]) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const controller = createBoardSessionController({ fetchImpl: slow });
    controller.selectChoice("waffles");
    const pending = controller.submitQuestion("Still waffles?");

    expect(controller.getState().isRefreshing).toBe(true);
    expect(controller.getState().selectedChoiceKey).toBe("waffles");

    release?.();
    await pending;
    expect(controller.getState().selectedChoiceKey).toBe("waffles");
  });

  it("is never touched by an asset event", () => {
    const current = board([choice("waffles", "a")]);
    const updated = applyAssetEvent(current, {
      type: "asset.ready",
      boardId: BOARD_ID,
      choiceId: "waffles",
      assetKey: "a",
      status: "ready",
      source: "generated",
      url: "data:image/webp;base64,AAAA",
    });

    // applyAssetEvent works on the board alone; selection lives on the state.
    expect(updated.choices[0].visual.status).toBe("ready");
    expect(Object.keys(updated)).not.toContain("selectedChoiceKey");
  });

  it("ignores an asset event for a key the board no longer shows", () => {
    const current = board([choice("waffles", "a")]);
    const updated = applyAssetEvent(current, {
      type: "asset.ready",
      boardId: BOARD_ID,
      choiceId: "dragon-fruit",
      assetKey: "stale-key",
      status: "ready",
      source: "generated",
      url: "data:image/webp;base64,AAAA",
    });
    // Same object back: nothing matched, so nothing re-renders.
    expect(updated).toBe(current);
  });
});
