/**
 * An entry in the approved vocabulary catalog.
 *
 * This is the trust boundary. The model may only reference these by `id`;
 * `label` and `spokenPhrase` are authored by us and are the only text that
 * ever reaches a communicator.
 */
export type VocabularyItem = {
  id: string;
  label: string;
  spokenPhrase: string;
  category: string;

  imageUrl?: string;
  iconKey?: string;

  /** Whether the classifier is allowed to propose this item at all. */
  allowedForAI: boolean;

  /** Core items appear on the manual Full Board, independent of any AI. */
  isCore: boolean;
};

/**
 * The restricted view handed to the classifier. Note the absence of
 * `spokenPhrase` — the model never sees the words we will speak, so it cannot
 * be steered into rewriting them.
 */
export type AIVocabularyOption = {
  id: string;
  label: string;
  category: string;
};
