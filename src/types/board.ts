/** Browser-safe visual state. Image work never controls whether a choice works. */
export type ChoiceOrigin = "catalog" | "personal" | "dynamic";
export type VisualStatus = "ready" | "pending" | "unavailable";
export type VisualSource = "curated" | "personal" | "cache" | "web" | "generated";

export type ChoiceVisual = {
  assetKey: string;
  status: VisualStatus;
  source?: VisualSource;
  url?: string;
  sourceUrl?: string;
  attribution?: string;
};

export type RenderableChoice = {
  id: string;
  /** Stable across board revisions for the same concept. */
  choiceKey: string;
  label: string;
  spokenPhrase: string;
  iconKey: string;
  origin: ChoiceOrigin;
  visual: ChoiceVisual;
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
  | "body_needs"
  | "yes_no"
  | "fallback"
  | "full_board";

export type RenderableBoard = {
  boardId: string;
  title: string;

  /** Echoed caregiver utterance so the UI can show what was heard. */
  questionText?: string;

  boardType: BoardType;
  choices: RenderableChoice[];
  actions: BoardAction[];

  isFallback: boolean;
  /** Non-blocking hint. It must never disable the board or its actions. */
  isRefreshing: boolean;
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
  | "no_approved_vocabulary";

export type AssetStreamDescriptor = {
  endpoint: "/api/resolve-assets";
  token: string;
  expiresAt: string;
};

export type ClassifyQuestionResponse = {
  board: RenderableBoard;
  assetStream?: AssetStreamDescriptor;
};
