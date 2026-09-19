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

/**
 * Flip this to false in the same commit that wires up the real classifier.
 * Surfaced by /api/health so nobody spends integration time wondering whether
 * they are looking at live model output or the mock.
 */
const USING_MOCK = true;

export function isUsingMockClassifier(): boolean {
  return USING_MOCK;
}
