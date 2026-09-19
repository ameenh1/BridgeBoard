import { z } from "zod";

/**
 * The shape we require from the classifier.
 *
 * Shared contract with Person 2 — do not change it unilaterally. Valid JSON is
 * not the same as trustworthy output, so this schema is only the first gate;
 * the allowlist in `buildRenderableBoard` is what actually keeps invented
 * vocabulary off a board.
 */
export const AIClassificationSchema = z.object({
  questionType: z.enum([
    "forced_choice",
    "feelings_needs",
    "yes_no",
    "body_needs",
    "unknown",
  ]),

  questionText: z.string().min(1).max(300),

  topic: z.enum([
    "food",
    "drink",
    "feelings",
    "body_needs",
    "activities",
    "people",
    "places",
    "sensory",
    "bathroom",
    "transitions",
    "other",
  ]),

  // The team doc says 6, but Person 2's classifier emits up to 8. Rejecting an
  // otherwise-good classification over a length we are about to slice anyway
  // is the wrong failure: it discards real vocabulary and shows a fallback.
  // Permissive on input, strict on output — `profile.maxChoices` is what
  // actually bounds the board.
  candidateVocabularyIds: z.array(z.string().min(1)).max(8),

  supportActions: z
    .array(
      z.enum([
        "help",
        "repeat",
        "something_else",
        "not_that",
        "need_more_time",
        "full_board",
      ]),
    )
    .max(6),

  confidence: z.number().min(0).max(1),

  requiresFallback: z.boolean(),
});

export type AIClassification = z.infer<typeof AIClassificationSchema>;

/**
 * Below this, we do not trust the classification enough to build a contextual
 * board. Prototype value — tune it against real transcripts, but keep the
 * decision here in application code rather than delegating it to the model.
 */
export const MIN_AI_CONFIDENCE = 0.78;
