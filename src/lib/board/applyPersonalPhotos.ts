import type { RenderableBoard, RenderableChoice } from "@/types/board";

/**
 * Puts the caregiver's own photos on top of whatever the server chose.
 *
 * The spec's image priority is:
 *
 *   personal photo -> curated local -> cached generated -> icon + text
 *
 * Personal comes first, and this is where that happens. It runs in the
 * browser rather than the server for a reason: the photos are never uploaded,
 * so the server cannot know they exist. A board arrives with generic art and
 * is personalized on the device, which means a photo of someone's home or
 * their medication never crosses the network.
 *
 * A photo always wins, including over a `ready` curated image. If a caregiver
 * has gone to the trouble of photographing this person's actual cup, a stock
 * illustration of a cup is not a better answer.
 */
export function applyPersonalPhotos(
  board: RenderableBoard,
  photos: Map<string, string>,
): RenderableBoard {
  if (photos.size === 0) return board;

  let changed = false;
  const choices = board.choices.map((choice) => {
    const dataUrl = photos.get(choice.id);
    if (!dataUrl || choice.visual.url === dataUrl) return choice;
    changed = true;
    return personalize(choice, dataUrl);
  });

  // Same reference when nothing matched, so React skips the re-render.
  return changed ? { ...board, choices } : board;
}

function personalize(choice: RenderableChoice, dataUrl: string): RenderableChoice {
  return {
    ...choice,
    origin: "personal",
    visual: {
      // The assetKey is kept so the merge and asset-stream machinery still
      // recognise this choice. Resolution for it is pointless now, but a
      // changed key would look like a different concept.
      assetKey: choice.visual.assetKey,
      status: "ready",
      source: "personal",
      url: dataUrl,
    },
  };
}

/** Asset keys that no longer need resolving because a photo already won. */
export function personalizedAssetKeys(
  board: RenderableBoard,
  photos: Map<string, string>,
): string[] {
  if (photos.size === 0) return [];
  return board.choices
    .filter((choice) => photos.has(choice.id))
    .map((choice) => choice.visual.assetKey);
}
