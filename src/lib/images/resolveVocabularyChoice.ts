import type { RenderableChoice } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import type { VocabularyItem } from "@/types/vocabulary";
import { findPersonalVocabularyImage } from "@/lib/storage/personalVocabulary";

/**
 * Resolve the visual for one approved vocabulary item.
 *
 * Priority: personal photo → curated local image → cached generated →
 * icon + text. The last rung always succeeds, which is the point: a missing
 * image degrades the presentation, never the ability to communicate.
 *
 * Nothing here waits on image generation. If we don't have a picture now, the
 * board ships with an icon now.
 */
export async function resolveVocabularyChoice(
  item: VocabularyItem,
  profile: ChildProfile,
): Promise<RenderableChoice> {
  const base = {
    id: item.id,
    label: item.label,
    spokenPhrase: item.spokenPhrase,
    iconKey: item.iconKey,
  };

  // 1. A caregiver's own photo beats anything generic.
  try {
    const personal = await findPersonalVocabularyImage(profile.id, item.id);
    if (personal) {
      return { ...base, imageUrl: personal.imageUrl, source: "personal" };
    }
  } catch (error) {
    // A storage failure must not cost the communicator a choice.
    console.error("[images] personal lookup failed for", item.id, error);
  }

  // 2. Curated illustration shipped with the app.
  if (item.imageUrl) {
    return { ...base, imageUrl: item.imageUrl, source: "curated" };
  }

  // 3. Cached generated images slot in here (Phase 3). Deliberately absent
  //    rather than stubbed, so no dead code pretends to be a cache.

  // 4. Text and icon. Always available, never blocks.
  return { ...base, source: "core" };
}
