import type { ChoiceSource, RenderableChoice } from "@/types/board";
import type { VocabularyItem } from "@/types/vocabulary";

/**
 * Turn a trusted catalog entry into something the UI can render.
 *
 * Synchronous and dependency-free on purpose: fallback and demo boards must
 * build with no network and no filesystem. The richer async resolver (personal
 * photos, cached generated images) wraps this later rather than replacing it.
 */
export function toRenderableChoice(
  item: VocabularyItem,
  source?: ChoiceSource,
): RenderableChoice {
  return {
    id: item.id,
    label: item.label,
    spokenPhrase: item.spokenPhrase,
    imageUrl: item.imageUrl,
    iconKey: item.iconKey,
    source: source ?? inferSource(item),
  };
}

function inferSource(item: VocabularyItem): ChoiceSource {
  if (item.id.startsWith("personal_")) return "personal";
  if (item.imageUrl) return "curated";
  return "core";
}
