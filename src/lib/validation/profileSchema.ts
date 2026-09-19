import { z } from "zod";
import { MAX_SPEECH_RATE, MIN_SPEECH_RATE } from "@/types/profile";

/**
 * Validation for settings read back out of browser storage.
 *
 * Stored JSON is an external boundary like any other. It can be stale from an
 * older build, hand-edited, or half-written by a tab that closed mid-save, so
 * it gets parsed rather than trusted.
 *
 * Fields added after the first release carry defaults so a profile stored by
 * an older build migrates forward instead of being thrown away — losing a
 * caregiver's settings is worse than carrying a default.
 */
export const ChildProfileSchema = z.object({
  id: z.string().min(1).max(100),
  displayName: z.string().max(60).default(""),
  maxChoices: z.union([z.literal(2), z.literal(4), z.literal(6)]),
  visuals: z.enum(["photos_first", "mixed", "icons_first"]),
  speechEnabled: z.boolean(),
  quietMode: z.boolean(),
  textLabelsEnabled: z.boolean(),
  historyEnabled: z.boolean(),
  buttonSize: z.enum(["standard", "large"]).default("large"),
  speechRate: z.number().min(MIN_SPEECH_RATE).max(MAX_SPEECH_RATE).default(0.9),
  voiceURI: z.string().max(300).optional(),
});
