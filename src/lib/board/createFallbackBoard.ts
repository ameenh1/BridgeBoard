import type { FallbackReason, RenderableBoard } from "@/types/board";
import { getApprovedVocabularyItem } from "@/lib/vocabulary/vocabularyHelpers";
import { toRenderableChoice } from "./renderableChoice";

/**
 * The board we show when anything goes wrong.
 *
 * Deliberately has no dependency on OpenAI, the network, image resolution, or
 * storage — it is the floor beneath every other code path. If this can't
 * build, the app has no business running.
 *
 * `reason` is for logs only. It is intentionally not returned: a communicator
 * should never be shown "low_confidence" or "invalid_response".
 */
export function createFallbackBoard(reason: FallbackReason): RenderableBoard {
  void reason;

  // Yes and No stay available as real choices so a conversation can continue
  // even when we could not organize the question.
  const choices = ["core_yes", "core_no"]
    .map(getApprovedVocabularyItem)
    .filter((item) => item !== undefined)
    .map((item) => toRenderableChoice(item));

  return {
    boardId: crypto.randomUUID(),
    title: "I'm not sure how to organize that question.",
    boardType: "fallback",
    choices,
    actions: ["repeat", "help", "need_more_time", "full_board"],
    isFallback: true,
    isRefreshing: false,
  };
}
