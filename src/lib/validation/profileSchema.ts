import { z } from "zod";

/**
 * Validation for settings read back out of browser storage.
 *
 * Stored JSON is an external boundary like any other. It can be stale from an
 * older build, hand-edited, or half-written by a tab that closed mid-save, so
 * it gets parsed rather than trusted.
 */
export const ChildProfileSchema = z.object({
  id: z.string().min(1).max(100),
  maxChoices: z.union([z.literal(2), z.literal(4), z.literal(6)]),
  visuals: z.enum(["photos_first", "mixed", "icons_first"]),
  speechEnabled: z.boolean(),
  quietMode: z.boolean(),
  textLabelsEnabled: z.boolean(),
  historyEnabled: z.boolean(),
});
