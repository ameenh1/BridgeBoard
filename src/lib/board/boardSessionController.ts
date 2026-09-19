"use client";

import type {
  AssetStreamDescriptor,
  ClassifyQuestionResponse,
  RenderableBoard,
  RenderableChoice,
} from "@/types/board";
import type { AssetStreamEvent } from "@/lib/assets/types";

export type BoardSessionState = {
  board: RenderableBoard | null;
  isRefreshing: boolean;
  partialTranscript: string;
  lastError?: "classification" | "asset_stream";
};

export type BoardSessionController = {
  getState(): BoardSessionState;
  acceptPartialTranscript(transcript: string): void;
  acceptFinalTranscript(transcript: string): void;
  submitQuestion(questionText: string): Promise<void>;
  flushFinalTranscript(): Promise<void>;
  destroy(): void;
};

type Options = {
  classifyEndpoint?: string;
  fetchImpl?: typeof fetch;
  continuationWindowMs?: number;
  profile?: { id?: string; maxChoices?: 2 | 4 | 6 };
  onStateChange?: (state: BoardSessionState) => void;
};

type RunningStream = {
  controller: AbortController;
  assetKeys: Set<string>;
};

function mergeChoice(previous: RenderableChoice | undefined, next: RenderableChoice): RenderableChoice {
  if (!previous || previous.visual.assetKey !== next.visual.assetKey) return next;
  if (previous.visual.status === "ready" && next.visual.status !== "ready") {
    return { ...next, visual: previous.visual };
  }
  return next;
}

export function mergeCommittedBoard(
  previous: RenderableBoard | null,
  next: RenderableBoard,
): RenderableBoard {
  if (!previous) return { ...next, isRefreshing: false };
  const oldByKey = new Map(previous.choices.map((choice) => [choice.choiceKey, choice]));
  return {
    ...next,
    choices: next.choices.map((choice) => mergeChoice(oldByKey.get(choice.choiceKey), choice)),
    isRefreshing: false,
  };
}

export function applyAssetEvent(
  board: RenderableBoard,
  event: AssetStreamEvent,
): RenderableBoard {
  if (event.type === "complete") return board;
  let changed = false;
  const choices = board.choices.map((choice) => {
    if (choice.visual.assetKey !== event.assetKey) return choice;
    if (choice.visual.status === "ready") return choice;
    changed = true;
    if (event.type === "asset.ready" && event.url && event.source) {
      return {
        ...choice,
        visual: {
          assetKey: choice.visual.assetKey,
          status: "ready" as const,
          source: event.source,
          url: event.url,
          sourceUrl: event.sourceUrl,
          attribution: event.attribution,
        },
      };
    }
    return {
      ...choice,
      visual: { assetKey: choice.visual.assetKey, status: "unavailable" as const },
    };
  });
  return changed ? { ...board, choices } : board;
}

function usableResponse(value: unknown): value is ClassifyQuestionResponse {
  if (!value || typeof value !== "object") return false;
  const board = (value as { board?: unknown }).board;
  return Boolean(
    board &&
      typeof board === "object" &&
      typeof (board as { boardId?: unknown }).boardId === "string" &&
      Array.isArray((board as { choices?: unknown }).choices),
  );
}

function assetEvent(value: unknown): AssetStreamEvent | null {
  if (!value || typeof value !== "object") return null;
  const type = (value as { type?: unknown }).type;
  if (type === "complete" && typeof (value as { boardId?: unknown }).boardId === "string") {
    return value as AssetStreamEvent;
  }
  if (
    (type === "asset.ready" || type === "asset.unavailable") &&
    typeof (value as { assetKey?: unknown }).assetKey === "string" &&
    typeof (value as { choiceId?: unknown }).choiceId === "string"
  ) {
    return value as AssetStreamEvent;
  }
  return null;
}

export function createBoardSessionController(options: Options = {}): BoardSessionController {
  const fetchImpl = options.fetchImpl ?? fetch;
  let state: BoardSessionState = {
    board: null,
    isRefreshing: false,
    partialTranscript: "",
  };
  let fragments: string[] = [];
  let continuationTimer: ReturnType<typeof setTimeout> | undefined;
  let classificationController: AbortController | undefined;
  const streams = new Set<RunningStream>();

  const publish = (next: BoardSessionState) => {
    state = next;
    options.onStateChange?.(next);
  };
  const setRefreshing = (refreshing: boolean, error?: BoardSessionState["lastError"]) => {
    publish({
      ...state,
      isRefreshing: refreshing,
      board: state.board ? { ...state.board, isRefreshing: refreshing } : null,
      ...(error ? { lastError: error } : { lastError: undefined }),
    });
  };

  const stopIrrelevantStreams = (board: RenderableBoard) => {
    const active = new Set(board.choices.map((choice) => choice.visual.assetKey));
    for (const running of streams) {
      if (![...running.assetKeys].some((key) => active.has(key))) running.controller.abort();
    }
  };

  const markUnavailable = (assetKeys: Set<string>) => {
    if (!state.board) return;
    let board = state.board;
    for (const assetKey of assetKeys) {
      board = applyAssetEvent(board, {
        type: "asset.unavailable",
        boardId: board.boardId,
        choiceId: "unknown",
        assetKey,
        status: "unavailable",
      });
    }
    publish({ ...state, board, lastError: "asset_stream" });
  };

  const startAssetStream = (descriptor: AssetStreamDescriptor, responseBoard: RenderableBoard) => {
    const assetKeys = new Set(
      responseBoard.choices
        .filter((choice) => choice.visual.status === "pending")
        .map((choice) => choice.visual.assetKey),
    );
    if (assetKeys.size === 0) return;
    const skipAssetKeys = state.board?.choices
      .filter((choice) => choice.visual.status === "ready" && assetKeys.has(choice.visual.assetKey))
      .map((choice) => choice.visual.assetKey) ?? [];
    const running: RunningStream = { controller: new AbortController(), assetKeys };
    streams.add(running);

    void fetchImpl(descriptor.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: descriptor.token, skipAssetKeys }),
      signal: running.controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) throw new Error("asset_stream_unavailable");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let parsed: unknown;
            try {
              parsed = JSON.parse(line);
            } catch {
              continue;
            }
            const event = assetEvent(parsed);
            if (!event || !state.board) continue;
            const board = applyAssetEvent(state.board, event);
            if (board !== state.board) publish({ ...state, board, lastError: undefined });
          }
        }
      })
      .catch((error) => {
        if (!running.controller.signal.aborted) {
          markUnavailable(assetKeys);
          console.warn("[board-session] asset stream failed", error instanceof Error ? error.message : "unknown");
        }
      })
      .finally(() => streams.delete(running));
  };

  const submitQuestion = async (questionText: string): Promise<void> => {
    const question = questionText.trim();
    if (!question) return;
    classificationController?.abort();
    const controller = new AbortController();
    classificationController = controller;
    setRefreshing(true);

    try {
      const response = await fetchImpl(options.classifyEndpoint ?? "/api/classify-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText: question, ...(options.profile ? { profile: options.profile } : {}) }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok || !usableResponse(payload)) throw new Error("classification_unavailable");

      if (payload.board.isFallback && state.board && !state.board.isFallback) {
        setRefreshing(false, "classification");
        return;
      }
      const board = mergeCommittedBoard(state.board, payload.board);
      publish({ ...state, board, isRefreshing: false, partialTranscript: "", lastError: undefined });
      stopIrrelevantStreams(board);
      if (payload.assetStream) startAssetStream(payload.assetStream, payload.board);
    } catch (error) {
      if (!controller.signal.aborted) {
        setRefreshing(false, "classification");
        console.warn("[board-session] classification failed", error instanceof Error ? error.message : "unknown");
      }
    } finally {
      if (classificationController === controller) classificationController = undefined;
    }
  };

  const flushFinalTranscript = async () => {
    if (continuationTimer) clearTimeout(continuationTimer);
    continuationTimer = undefined;
    const question = fragments.join(" ").replace(/\s+/g, " ").trim();
    fragments = [];
    await submitQuestion(question);
  };

  return {
    getState: () => state,
    acceptPartialTranscript(transcript) {
      publish({ ...state, partialTranscript: transcript });
    },
    acceptFinalTranscript(transcript) {
      const fragment = transcript.trim();
      if (!fragment) return;
      fragments.push(fragment);
      publish({ ...state, partialTranscript: "" });
      if (continuationTimer) clearTimeout(continuationTimer);
      continuationTimer = setTimeout(
        () => void flushFinalTranscript(),
        options.continuationWindowMs ?? 1_000,
      );
    },
    submitQuestion,
    flushFinalTranscript,
    destroy() {
      if (continuationTimer) clearTimeout(continuationTimer);
      classificationController?.abort();
      for (const running of streams) running.controller.abort();
      streams.clear();
      fragments = [];
    },
  };
}
