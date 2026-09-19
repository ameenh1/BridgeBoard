import type { RenderableBoard } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import { DEFAULT_PROFILE } from "@/types/profile";
import { classifyQuestion } from "@/lib/ai/classifyQuestion";
import { buildRenderableBoard } from "@/lib/board/buildRenderableBoard";
import { createFallbackBoard } from "@/lib/board/createFallbackBoard";
import { getDemoBoardForQuestion } from "@/lib/board/demoBoards";
import { limitChoices } from "@/lib/board/limitChoices";
import { isDemoMode } from "@/lib/demo/demoMode";
import { ClassifyQuestionRequestSchema } from "@/lib/validation/requestSchemas";

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

  // Known demo prompts never touch the network. They still obey the profile —
  // a scripted board is not an excuse to ignore board complexity.
  if (isDemoMode()) {
    const demoBoard = getDemoBoardForQuestion(questionText);
    if (demoBoard) {
      return json({ board: limitChoices(demoBoard, profile) });
    }
  }

  let raw: unknown;
  try {
    raw = await classifyQuestion(questionText);
  } catch (error) {
    console.error("[classify-question] classifier failure", error);
    return json({ board: createFallbackBoard("ai_error") });
  }

  try {
    const board = await buildRenderableBoard(raw, profile);
    return json({ board });
  } catch (error) {
    // A bug in our own pipeline must not take communication down with it.
    console.error("[classify-question] board construction failure", error);
    return json({ board: createFallbackBoard("ai_error") });
  }
}

/** Accepts a partial profile from the client and fills the rest with defaults. */
function mergeProfile(partial: { id?: string; maxChoices?: 2 | 4 | 6 } | undefined): ChildProfile {
  return {
    ...DEFAULT_PROFILE,
    ...(partial?.id ? { id: partial.id } : {}),
    ...(partial?.maxChoices ? { maxChoices: partial.maxChoices } : {}),
  };
}

function json(payload: { board: RenderableBoard }, status = 200): Response {
  return Response.json(payload, { status });
}
