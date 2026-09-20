import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAssetEvent,
  createBoardSessionController,
  mergeCommittedBoard,
} from "@/lib/board/boardSessionController";
import {
  createWelcomeBoard,
  getPersistentAiChoices,
} from "@/lib/board/persistentChoices";
import type { RenderableBoard, RenderableChoice } from "@/types/board";

function choice(id: string, status: "ready" | "pending" = "pending"): RenderableChoice {
  return {
    id,
    choiceKey: id,
    label: id,
    spokenPhrase: id,
    iconKey: "shapes",
    origin: "catalog",
    visual: {
      assetKey: id.padEnd(64, "a").slice(0, 64),
      status,
      ...(status === "ready" ? { source: "generated" as const, url: `https://example.com/${id}` } : {}),
    },
  };
}

function board(id: string, choices: RenderableChoice[], isFallback = false): RenderableBoard {
  return {
    boardId: id,
    title: id,
    boardType: isFallback ? "fallback" : "choice",
    choices,
    actions: ["help", "full_board"],
    isFallback,
    isRefreshing: false,
  };
}

afterEach(() => vi.useRealTimers());

describe("stable board merging", () => {
  it("retains ready images and makes only new choices pending", () => {
    const current = board("00000000-0000-4000-8000-000000000001", [choice("waffles", "ready"), choice("water", "ready")]);
    const incoming = board("00000000-0000-4000-8000-000000000002", [choice("waffles"), choice("water"), choice("juice")]);
    const merged = mergeCommittedBoard(current, incoming);

    // Persistent quick answers first, then the AI suggestions.
    expect(merged.choices.slice(0, 4).map((item) => item.visual.status)).toEqual([
      "ready",
      "ready",
      "ready",
      "ready",
    ]);
    const ai = merged.choices.slice(4);
    expect(ai.map((item) => item.visual.status)).toEqual(["ready", "ready", "pending"]);
    expect(ai[0]?.visual.url).toBe("https://example.com/waffles");
  });

  it("updates only the matching visual and never regresses a ready image", () => {
    const current = board("00000000-0000-4000-8000-000000000001", [choice("waffles", "ready"), choice("juice")]);
    const failed = applyAssetEvent(current, {
      type: "asset.unavailable",
      boardId: current.boardId,
      choiceId: "waffles",
      assetKey: current.choices[0]!.visual.assetKey,
      status: "unavailable",
    });
    expect(failed.choices[0]?.visual.status).toBe("ready");
    expect(failed.choices[1]?.visual.status).toBe("pending");
  });
});

describe("speech coalescing and committed-board retention", () => {
  it("does not classify partial speech and combines final fragments", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { questionText: string };
      return Response.json({ board: board("00000000-0000-4000-8000-000000000003", [choice(payload.questionText)]) });
    });
    const controller = createBoardSessionController({ fetchImpl: fetchImpl as typeof fetch });
    controller.acceptPartialTranscript("Would you like");
    expect(fetchImpl).not.toHaveBeenCalled();

    controller.acceptFinalTranscript("Would you like dragon");
    await vi.advanceTimersByTimeAsync(500);
    controller.acceptFinalTranscript("fruit or juice");
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).questionText)
      .toBe("Would you like dragon fruit or juice");
  });

  it("keeps a committed board when a later classification fails", async () => {
    const good = Response.json({ board: board("00000000-0000-4000-8000-000000000004", [choice("waffles", "ready")]) });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(good)
      .mockRejectedValueOnce(new Error("offline"));
    const controller = createBoardSessionController({ fetchImpl });
    await controller.submitQuestion("first");
    await controller.submitQuestion("second");
    const ids = controller.getState().board?.choices.map((item) => item.id) ?? [];
    expect(ids).toContain("waffles");
    expect(controller.getState().board?.isRefreshing).toBe(false);
  });
});

describe("persistent quick answers", () => {
  it("shows four ready bundled choices before the first question", () => {
    const welcome = createWelcomeBoard();
    expect(welcome.choices).toHaveLength(4);
    expect(welcome.choices.every((item) => item.visual.status === "ready")).toBe(true);
    expect(getPersistentAiChoices().map((item) => item.id)).toEqual([
      "core_yes",
      "core_no",
      "core_more",
      "core_all_done",
    ]);
  });

  it("starts the session on the welcome board and keeps quick answers on every commit", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        board: board("00000000-0000-4000-8000-000000000005", [choice("waffles", "ready")]),
      }),
    );
    const controller = createBoardSessionController({ fetchImpl });
    expect(controller.getState().board?.choices.map((item) => item.id)).toEqual([
      "core_yes",
      "core_no",
      "core_more",
      "core_all_done",
    ]);
    await controller.submitQuestion("Would you like waffles?");
    const ids = controller.getState().board?.choices.map((item) => item.id) ?? [];
    expect(ids.slice(0, 4)).toEqual(["core_yes", "core_no", "core_more", "core_all_done"]);
    expect(ids).toContain("waffles");
  });

  it("resets generated choices without removing the default answers", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        board: board("00000000-0000-4000-8000-000000000006", [choice("waffles", "ready")]),
      }),
    );
    const controller = createBoardSessionController({ fetchImpl });
    await controller.submitQuestion("Waffles?");
    controller.resetAiChoices();
    expect(controller.getState().board?.choices.map((item) => item.id)).toEqual([
      "core_yes",
      "core_no",
      "core_more",
      "core_all_done",
    ]);
  });
});

describe("ai gallery", () => {
  it("keeps earlier answers below the new ones with pictures intact", () => {
    const first = board("00000000-0000-4000-8000-000000000010", [
      choice("bathroom", "ready"),
      choice("drink", "ready"),
    ]);
    const second = board("00000000-0000-4000-8000-000000000011", [choice("snack")]);
    const merged = mergeCommittedBoard(first, second);

    expect(merged.choices.map((item) => item.id)).toEqual([
      "core_yes",
      "core_no",
      "core_more",
      "core_all_done",
      "snack",
      "bathroom",
      "drink",
    ]);
    expect(merged.choices.slice(4).map((item) => item.visual.status)).toEqual([
      "pending",
      "ready",
      "ready",
    ]);
    expect(merged.choices[5]?.visual.url).toBe("https://example.com/bathroom");
  });

  it("dedupes a repeated answer into its newest position", () => {
    const first = board("00000000-0000-4000-8000-000000000012", [
      choice("waffles", "ready"),
      choice("water", "ready"),
    ]);
    const second = board("00000000-0000-4000-8000-000000000013", [
      choice("water"),
      choice("juice"),
    ]);
    const merged = mergeCommittedBoard(first, second);
    const ai = merged.choices.slice(4).map((item) => item.id);

    expect(ai).toEqual(["water", "juice", "waffles"]);
    expect(merged.choices[4]?.visual.status).toBe("ready");
  });

  it("caps the gallery at eight ai tiles, dropping the oldest", () => {
    const olds = Array.from({ length: 8 }, (_, index) => choice(`old${index}`, "ready"));
    const first = board("00000000-0000-4000-8000-000000000014", olds);
    const second = board("00000000-0000-4000-8000-000000000015", [choice("fresh")]);
    const merged = mergeCommittedBoard(first, second);
    const ai = merged.choices.slice(4).map((item) => item.id);

    expect(ai).toHaveLength(8);
    expect(ai[0]).toBe("fresh");
    expect(ai).toContain("old0");
    expect(ai).not.toContain("old7");
  });

  it("keeps statement responses to four new tiles while retaining gallery history", () => {
    const olds = Array.from({ length: 5 }, (_, index) => choice(`old${index}`, "ready"));
    const responses = ["yes", "no", "not-yet", "more-time"].map((id) => choice(id));
    const first = board("00000000-0000-4000-8000-000000000016", olds);
    const second = board("00000000-0000-4000-8000-000000000017", responses);
    const merged = mergeCommittedBoard(first, second);
    const ai = merged.choices.slice(4).map((item) => item.id);

    expect(ai).toHaveLength(8);
    expect(ai.slice(0, 4)).toEqual(["yes", "no", "not-yet", "more-time"]);
    expect(ai).toContain("old0");
    expect(ai).not.toContain("old4");
  });
});
