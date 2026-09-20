import type { RenderableChoice } from "@/types/board";
import type { VocabularyItem } from "@/types/vocabulary";
import { createAssetKey } from "@/lib/assets/assetKeys";
import { imageExists } from "@/lib/images/imageManifest";

/**
 * Turn a trusted catalog entry into something the UI can render.
 *
 * Synchronous and dependency-free on purpose: fallback and manual boards must
 * build with no network and no filesystem. The richer async resolver (personal
 * photos, cached generated images) wraps this later rather than replacing it.
 *
 * An `imageUrl` is only emitted when the file actually exists at build time.
 * The catalog names assets that may not have been produced yet, and a tile
 * showing a broken-image box is worse than one showing an icon.
 */
export function toRenderableChoice(
  item: VocabularyItem,
): RenderableChoice {
  const imageUrl = item.imageUrl && imageExists(item.imageUrl) ? item.imageUrl : undefined;
  const assetKey = createAssetKey(item.label);

  return {
    id: item.id,
    choiceKey: item.id,
    label: item.label,
    spokenPhrase: item.spokenPhrase,
    iconKey: item.iconKey ?? iconForCategory(item.category),
    origin: item.id.startsWith("personal_") ? "personal" : "catalog",
    visual: imageUrl
      ? {
          assetKey,
          status: "ready",
          source: item.id.startsWith("personal_") ? "personal" : "curated",
          url: imageUrl,
        }
      : { assetKey, status: "pending" },
  };
}

export function iconForCategory(category: string): string {
  return ({
    food: "utensils",
    food_places: "utensils",
    drink: "cup-soda",
    feelings: "smile",
    needs: "life-buoy",
    body_needs: "heart-pulse",
    bathroom: "door-open",
    activities: "blocks",
    people: "user",
    places: "map-pin",
    sensory: "waves",
    transitions: "arrow-right-left",
    core: "message-circle",
  } as Record<string, string>)[category] ?? "shapes";
}
