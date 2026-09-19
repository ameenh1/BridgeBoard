import { temporaryMockClassifier } from "./mockClassifier";

/**
 * The single seam between this backend and Person 2's AI module.
 *
 * Step 8 of the build order replaces the body of this function with their
 * `classifyQuestion` and nothing else changes — the validation pipeline
 * downstream is deliberately independent of where the raw response came from.
 *
 * Returns `unknown`: the result is untrusted until `buildRenderableBoard`
 * parses it.
 */
export async function classifyQuestion(questionText: string): Promise<unknown> {
  // TODO(person-2): swap for the real OpenAI classifier once merged.
  return temporaryMockClassifier(questionText);
}

/** Whether a real classifier is configured. Demo mode does not need one. */
export function hasClassifierCredentials(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
