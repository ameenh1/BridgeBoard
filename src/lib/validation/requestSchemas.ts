import { z } from "zod";

/**
 * Incoming request validation. The browser is an external boundary like any
 * other — a caregiver's tablet is not a trusted client.
 */
export const ClassifyQuestionRequestSchema = z.object({
  questionText: z.string().trim().min(1).max(300),

  /**
   * Only the fields that change what the server builds. Display-only prefs
   * (speech rate, button size, the child's name) never leave the device.
   */
  profile: z
    .object({
      id: z.string().min(1).max(100),
      maxChoices: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
      visuals: z.enum(["photos_first", "mixed", "icons_first"]),
    })
    .partial()
    .optional(),
});

export type ClassifyQuestionRequest = z.infer<typeof ClassifyQuestionRequestSchema>;
