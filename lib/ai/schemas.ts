import { z } from "zod";

export const QuestionTypeSchema = z.enum([
  "forced_choice",
  "feelings_needs",
  "yes_no",
  "body_needs",
  "unknown"
]);

export const TopicSchema = z.enum([
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
  "other"
]);

export const SupportActionSchema = z.enum([
  "help",
  "repeat",
  "something_else",
  "not_that",
  "need_more_time",
  "full_board"
]);

export const AIClassificationSchema = z
  .object({
    questionType: QuestionTypeSchema,
    // Empty is valid for an empty transcript and must lead to fallback.
    questionText: z.string().max(300),
    topic: TopicSchema,
    candidateVocabularyIds: z.array(z.string().min(1)).max(8),
    supportActions: z.array(SupportActionSchema).max(6),
    confidence: z.number().min(0).max(1),
    requiresFallback: z.boolean()
  })
  .strict();

export type AIClassification = z.infer<typeof AIClassificationSchema>;

export const ClassifyQuestionRequestSchema = z
  .object({
    transcript: z.string().max(2_000),
    recentContext: z.array(z.string().max(300)).max(3).optional(),
    language: z.string().max(40).optional(),
    maxChoices: z.number().int().min(1).max(8).optional(),
    forceLiveAI: z.boolean().optional()
  })
  .strict();

export type ClassifyQuestionRequest = z.infer<typeof ClassifyQuestionRequestSchema>;
