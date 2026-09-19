import { z } from "zod";

/**
 * Incoming request validation. The browser is an external boundary like any
 * other — a caregiver's tablet is not a trusted client.
 */
export const ClassifyQuestionRequestSchema = z.object({
  questionText: z.string().trim().min(1).max(300),

  profile: z
    .object({
      id: z.string().min(1).max(100),
      maxChoices: z.union([z.literal(2), z.literal(4), z.literal(6)]),
    })
    .partial()
    .optional(),
});

export type ClassifyQuestionRequest = z.infer<typeof ClassifyQuestionRequestSchema>;
