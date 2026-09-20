import type { RenderableBoard } from "@/types/board";
import type { ChildProfile } from "@/types/profile";

/**
 * Enforce the caregiver's board-complexity setting.
 *
 * Applies to every board leaving the API.
 * Board complexity is an accessibility setting, not a cosmetic one — a
 * communicator configured for two choices should never be handed eight.
 *
 * Fallback boards are exempt: their Yes/No pair is the floor, not a list of
 * suggestions to trim.
 */
export function limitChoices(
  board: RenderableBoard,
  profile: ChildProfile,
): RenderableBoard {
  if (board.isFallback || board.choices.length <= profile.maxChoices) {
    return board;
  }

  return { ...board, choices: board.choices.slice(0, profile.maxChoices) };
}
