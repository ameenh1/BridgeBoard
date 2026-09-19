import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAssetEvent,
  createBoardSessionController,
  mergeCommittedBoard,
} from "@/lib/board/boardSessionController";
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

    expect(merged.choices.map((item) => item.visual.status)).toEqual(["ready", "ready", "pending"]);
    expect(merged.choices[0]?.visual.url).toBe("https://example.com/waffles");
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
    expect(controller.getState().board?.choices[0]?.id).toBe("waffles");
    expect(controller.getState().board?.isRefreshing).toBe(false);
  });
});
