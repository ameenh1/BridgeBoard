/**
 * Cross-branch vocabulary id aliases.
 *
 * Person 2's classifier was built against its own catalog and emits ids that
 * name the same concepts under a different scheme (`action_yes` for our
 * `core_yes`). The team split assigns catalog ownership here, so rather than
 * ask them to rewrite a working classifier, we translate at our boundary.
 *
 * This is a compatibility shim, not a second catalog. If the two catalogs are
 * ever reconciled properly, delete this file and nothing else changes.
 */
const ALIASES: Record<string, string> = {
  action_yes: "core_yes",
  action_no: "core_no",
  action_later: "core_later",
  action_more: "core_more",
  action_stop: "core_stop",
  action_outside: "place_outside",
  action_play: "activity_play",
  drink_water: "need_water",
};

/**
 * Maps a foreign id onto ours. Unknown ids pass through unchanged so the
 * allowlist still rejects genuinely invented vocabulary.
 */
export function normalizeVocabularyId(id: string): string {
  return ALIASES[id] ?? id;
}

/** Exposed for tests and for auditing what we accept from other branches. */
export function getVocabularyAliases(): Readonly<Record<string, string>> {
  return ALIASES;
}
