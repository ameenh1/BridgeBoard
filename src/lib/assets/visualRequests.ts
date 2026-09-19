import type { ChildProfile } from "@/types/profile";
import type { RenderableBoard, RenderableChoice } from "@/types/board";
import { ASSET_STYLE_VERSION, normalizeConcept } from "./assetKeys";
import type { VisualAssetRequest } from "./types";

/**
 * Which pending visuals the caregiver's visual preference is willing to spend a
 * search or a generation on.
 *
 * - `photos_first` resolves everything that is still missing a picture.
 * - `mixed` keeps the bundled catalog artwork and only resolves concepts the
 *   catalog has never seen, so a familiar board costs nothing.
 * - `icons_first` resolves nothing; every tile shows its symbol immediately.
 */
function wantsResolution(choice: RenderableChoice, visuals: ChildProfile["visuals"]): boolean {
  if (visuals === "icons_first") return false;
  if (visuals === "mixed") return choice.origin === "dynamic";
  return true;
}

export function buildVisualAssetRequests(
  board: RenderableBoard,
  locale = "en",
  visuals: ChildProfile["visuals"] = "photos_first",
): VisualAssetRequest[] {
  return board.choices
    .filter((choice) => choice.visual.status === "pending" && wantsResolution(choice, visuals))
    .slice(0, Math.min(Number(process.env.AI_MAX_VISUAL_ASSETS ?? 6), 6))
    .map((choice) => {
      const concept = normalizeConcept(choice.label);
      return {
        boardId: board.boardId,
        choiceId: choice.id,
        assetKey: choice.visual.assetKey,
        label: choice.label,
        normalizedConcept: concept,
        locale,
        styleVersion: ASSET_STYLE_VERSION,
        webSearchQuery: `${choice.label} clear single-object AAC communication image`,
        generationPrompt: [
          `Create one clear AAC communication symbol for: ${choice.label}.`,
          "Show only the concrete concept, centered and immediately recognizable.",
          "Use a simple uncluttered background, bold shapes, neutral lighting, and no text, logos, watermarks, or extra objects.",
          "Use a friendly flat illustrative style suitable for children and adults.",
        ].join(" "),
      };
    });
}
