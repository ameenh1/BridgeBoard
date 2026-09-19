import type { VocabularyItem } from "@/types/vocabulary";

export type PersonalVocabularyRecord = {
  profileId: string;
  vocabularyId: string;
  imageUrl: string;
};

/**
 * Caregiver-supplied photos, keyed by profile.
 *
 * A static map for the MVP — enough to demonstrate that a personal photo takes
 * priority over a generic illustration, without building an upload pipeline.
 * Phase 2 can swap the lookup for Supabase without touching the resolver.
 */
const PERSONAL_VOCABULARY: PersonalVocabularyRecord[] = [
  {
    profileId: "demo-profile",
    vocabularyId: "personal_blue_cup",
    imageUrl: "/demo-photos/blue-cup.png",
  },
  {
    profileId: "demo-profile",
    vocabularyId: "personal_red_cup",
    imageUrl: "/demo-photos/red-cup.png",
  },
];

/**
 * Async by design: this becomes a real lookup later, and callers should
 * already be written to await it.
 */
export async function findPersonalVocabularyImage(
  profileId: string,
  vocabularyId: string,
): Promise<PersonalVocabularyRecord | undefined> {
  return PERSONAL_VOCABULARY.find(
    (record) => record.profileId === profileId && record.vocabularyId === vocabularyId,
  );
}

/** True when a catalog item has a caregiver photo for this profile. */
export async function hasPersonalImage(
  profileId: string,
  item: VocabularyItem,
): Promise<boolean> {
  return Boolean(await findPersonalVocabularyImage(profileId, item.id));
}
