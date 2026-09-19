import type { ChoiceSource, RenderableChoice } from "@/types/board";
import type { VocabularyItem } from "@/types/vocabulary";
import { imageExists } from "@/lib/images/imageManifest";

/**
 * Turn a trusted catalog entry into something the UI can render.
 *
 * Synchronous and dependency-free on purpose: fallback and demo boards must
 * build with no network and no filesystem. The richer async resolver (personal
 * photos, cached generated images) wraps this later rather than replacing it.
 *
 * An `imageUrl` is only emitted when the file actually exists at build time.
 * The catalog names assets that may not have been produced yet, and a tile
 * showing a broken-image box is worse than one showing an icon.
 */
export function toRenderableChoice(
  item: VocabularyItem,
  source?: ChoiceSource,
): RenderableChoice {
  const imageUrl = item.imageUrl && imageExists(item.imageUrl) ? item.imageUrl : undefined;

  return {
    id: item.id,
    label: item.label,
    spokenPhrase: item.spokenPhrase,
    imageUrl,
    iconKey: item.iconKey,
    source: source ?? inferSource(item, imageUrl),
  };
}

function inferSource(item: VocabularyItem, resolvedImage: string | undefined): ChoiceSource {
  // Without a real image the tile is text and an icon, whatever the catalog
  // intended it to be — reporting "curated" would misdescribe what shipped.
  if (!resolvedImage) return "core";
  if (item.id.startsWith("personal_")) return "personal";
  return "curated";
}
