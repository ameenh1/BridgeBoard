// Server-only module: do not import this file from browser code.
import "../serverEnv.js";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  APPROVED_VOCABULARY,
  type ApprovedVocabularyItem
} from "../../data/approvedVocabulary.js";
import { classifyDeterministically, createUnknownClassification } from "./deterministicClassifier.js";
import { AAC_CLASSIFIER_SYSTEM_PROMPT, buildClassifierUserContext } from "./prompts.js";
import { AIClassificationSchema, type AIClassification } from "./schemas.js";
import { validateClassification } from "./validation.js";
import { buildVocabularyContext } from "./vocabularyContext.js";

export type ClassifyQuestionOptions = {
  approvedVocabulary?: readonly ApprovedVocabularyItem[];
  recentContext?: readonly string[];
  language?: string;
  maxChoices?: number;
  forceLiveAI?: boolean;
  allowLiveAI?: boolean;
  openAIClient?: OpenAI;
};

function isLiveClassifierEnabled(options: ClassifyQuestionOptions): boolean {
  if (options.allowLiveAI !== undefined) {
    return options.allowLiveAI;
  }

  return process.env.AI_LIVE_CLASSIFIER_ENABLED !== "false";
}

export async function classifyQuestion(
  transcript: string,
  options: ClassifyQuestionOptions = {}
): Promise<AIClassification> {
  const vocabulary = options.approvedVocabulary ?? APPROVED_VOCABULARY;
  const maxChoices = options.maxChoices ?? 4;
  const deterministic = classifyDeterministically(transcript, maxChoices);

  if (deterministic && !options.forceLiveAI) {
    return validateClassification(deterministic, vocabulary, maxChoices);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if ((!apiKey && !options.openAIClient) || (!isLiveClassifierEnabled(options) && !options.forceLiveAI)) {
    return validateClassification(
      deterministic ?? createUnknownClassification(transcript),
      vocabulary,
      maxChoices
    );
  }

  const openAI = options.openAIClient ?? new OpenAI({ apiKey: apiKey as string });

  try {
    const response = await openAI.responses.parse({
      model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5.6-luna",
      input: [
        { role: "system", content: AAC_CLASSIFIER_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            buildClassifierUserContext(
              transcript,
              options.recentContext ?? [],
              options.language ?? "English"
            ),
            "Approved vocabulary IDs:\n" + buildVocabularyContext(vocabulary)
          ].join("\n\n")
        }
      ],
      text: {
        format: zodTextFormat(AIClassificationSchema, "ai_classification")
      },
      store: false
    });

    return validateClassification(response.output_parsed, vocabulary, maxChoices);
  } catch (error) {
    console.error("AI classification failed; using safe fallback.", error);
    return createUnknownClassification(transcript, 0.1);
  }
}
