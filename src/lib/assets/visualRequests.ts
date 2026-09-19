import type { RenderableBoard } from "@/types/board";
import { ASSET_STYLE_VERSION, normalizeConcept } from "./assetKeys";
import type { VisualAssetRequest } from "./types";

export function buildVisualAssetRequests(
  board: RenderableBoard,
  locale = "en",
): VisualAssetRequest[] {
  return board.choices
    .filter((choice) => choice.visual.status === "pending")
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
