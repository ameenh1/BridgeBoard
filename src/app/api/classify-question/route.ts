import type { ClassifyQuestionResponse } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import { DEFAULT_PROFILE } from "@/types/profile";
import { classifyQuestion } from "@/lib/ai/classifyQuestion";
import { buildRenderableBoard } from "@/lib/board/buildRenderableBoard";
import { createFallbackBoard } from "@/lib/board/createFallbackBoard";
import {
  ClassifyQuestionRequestSchema,
  type ClassifyQuestionRequest,
} from "@/lib/validation/requestSchemas";
import { buildVisualAssetRequests } from "@/lib/assets/visualRequests";
import { createAssetStreamDescriptor } from "@/lib/assets/assetToken";
import { hasAssetProviders } from "@/lib/assets/openaiAssetProviders";

export const runtime = "nodejs";

/**
 * POST /api/classify-question
 *
 * Always responds with `{ board }`. There is no error shape the frontend has
 * to handle specially — if something upstream breaks, the board is simply a
 * fallback. Internal reasons stay in the server log; a communicator never sees
 * "invalid_response".
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ board: createFallbackBoard("invalid_response") }, 400);
  }

  const parsed = ClassifyQuestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    // Bad request from our own UI. Still hand back a usable board.
    return json({ board: createFallbackBoard("invalid_response") }, 400);
  }

  const { questionText } = parsed.data;
  const profile = mergeProfile(parsed.data.profile);

  let raw: unknown;
  try {
    raw = await classifyQuestion(questionText, { signal: request.signal });
  } catch (error) {
    console.error("[classify-question] classifier failure", safeErrorCode(error));
    return json({ board: createFallbackBoard("ai_error") });
  }

  try {
    let board = await buildRenderableBoard(raw, profile, questionText);
    const requests = buildVisualAssetRequests(board, "en", profile.visuals);
    const assetStream =
      requests.length > 0 && hasAssetProviders()
        ? createAssetStreamDescriptor(board.boardId, requests)
        : undefined;

    // Anything still pending that no stream will ever deliver must say so now.
    // A tile that shows its symbol is usable; a tile stuck on a spinner is not.
    const streaming = new Set(assetStream ? requests.map((request) => request.assetKey) : []);
    board = {
      ...board,
      choices: board.choices.map((choice) =>
        choice.visual.status === "pending" && !streaming.has(choice.visual.assetKey)
          ? { ...choice, visual: { ...choice.visual, status: "unavailable" as const } }
          : choice,
      ),
    };
    return json({ board, ...(assetStream ? { assetStream } : {}) });
  } catch (error) {
    // A bug in our own pipeline must not take communication down with it.
    console.error("[classify-question] board construction failure", safeErrorCode(error));
    return json({ board: createFallbackBoard("ai_error") });
  }
}

/** Accepts a partial profile from the client and fills the rest with defaults. */
function mergeProfile(
  partial: ClassifyQuestionRequest["profile"],
): ChildProfile {
  return {
    ...DEFAULT_PROFILE,
    ...(partial?.id ? { id: partial.id } : {}),
    ...(partial?.maxChoices ? { maxChoices: partial.maxChoices } : {}),
    ...(partial?.visuals ? { visuals: partial.visuals } : {}),
  };
}

function json(payload: ClassifyQuestionResponse, status = 200): Response {
  return Response.json(payload, { status });
}

function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  if (error.name === "AbortError" || error.name === "TimeoutError") return "aborted";
  if (/unconfigured/i.test(error.message)) return "unconfigured";
  if (/invalid/i.test(error.message)) return "invalid_response";
  return "upstream_error";
}
