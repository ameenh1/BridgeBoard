/**
 * The frontend contract.
 *
 * A `RenderableBoard` is the ONLY shape the UI receives. Everything in it is
 * trusted and deterministic: labels and spoken phrases come from our approved
 * vocabulary catalog, never from model output. The AI can propose vocabulary
 * IDs; it can never author a word that a communicator says out loud.
 */

/** Where a choice's presentation came from, after image resolution. */
export type ChoiceSource = "core" | "personal" | "cached_generated" | "curated";

export type RenderableChoice = {
  id: string;
  label: string;
  spokenPhrase: string;

  imageUrl?: string;
  iconKey?: string;

  source: ChoiceSource;
};

/**
 * Persistent support controls. These are always available to the communicator
 * and never depend on the model succeeding.
 */
export type BoardAction =
  | "help"
  | "repeat"
  | "something_else"
  | "not_that"
  | "need_more_time"
  | "full_board";

export type BoardType =
  | "choice"
  | "feelings_needs"
  | "yes_no"
  | "fallback"
  | "full_board";

export type RenderableBoard = {
  boardId: string;
  title: string;

  /** Echoed back so the UI can show what was heard. Optional by design. */
  questionText?: string;

  boardType: BoardType;
  choices: RenderableChoice[];
  actions: BoardAction[];

  isFallback: boolean;
};

/**
 * Why we fell back. Development and logging only — this must never reach the
 * child-facing UI, which is why it is not a field on `RenderableBoard`.
 */
export type FallbackReason =
  | "ai_error"
  | "invalid_response"
  | "low_confidence"
  | "unknown_question"
  | "no_approved_vocabulary"
  | "demo_fallback";
