import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AIClassificationSchema, type AIClassification } from "@/lib/validation/aiClassification";
import { getAIAllowedVocabulary } from "@/lib/vocabulary/vocabularyHelpers";
import { AAC_CLASSIFIER_SYSTEM_PROMPT, buildClassifierContext } from "./prompts";

/** Classify a completed caregiver turn using server-side structured output. */
export async function classifyQuestion(
  questionText: string,
  options: { client?: OpenAI; signal?: AbortSignal } = {},
): Promise<AIClassification> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!options.client && !apiKey) {
    throw new Error("classifier_unconfigured");
  }

  const client = options.client ?? new OpenAI({ apiKey });
  const timeout = AbortSignal.timeout(15_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await client.responses.parse(
    {
      model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5.6-luna",
      input: [
        { role: "system", content: AAC_CLASSIFIER_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildClassifierContext(questionText, getAIAllowedVocabulary()),
        },
      ],
      text: { format: zodTextFormat(AIClassificationSchema, "aac_classification") },
      store: false,
    },
    { signal },
  );

  const parsed = AIClassificationSchema.safeParse(response.output_parsed);
  if (!parsed.success) {
    throw new Error("classifier_invalid_response");
  }
  return parsed.data;
}

/** Whether the production classifier can accept requests. */
export function hasClassifierCredentials(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
