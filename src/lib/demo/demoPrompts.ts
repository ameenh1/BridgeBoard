/**
 * The scripted demo prompts.
 *
 * Single source of truth on purpose. The UI renders its demo chips from this
 * list and the matcher recognises the same strings, so a chip can never drift
 * out of sync with the deterministic path it is supposed to trigger — a chip
 * whose text no longer matches would quietly fall through to the live
 * classifier, which is exactly what the chips exist to avoid.
 */
export type DemoPrompt = {
  id: "breakfast" | "feelings" | "personal-cups" | "uncertain";
  label: string;
  text: string;
};

export const DEMO_PROMPTS: DemoPrompt[] = [
  {
    id: "breakfast",
    label: "Breakfast demo",
    text: "Do you want waffles or pancakes?",
  },
  {
    id: "feelings",
    label: "Feelings demo",
    text: "How are you feeling?",
  },
  {
    id: "personal-cups",
    label: "Personalization demo",
    text: "Do you want your blue cup or red cup?",
  },
  {
    id: "uncertain",
    label: "Uncertainty demo",
    text: "Should we maybe go after you finish that unless you want something different?",
  },
];

export function getDemoPrompt(id: DemoPrompt["id"]): DemoPrompt | undefined {
  return DEMO_PROMPTS.find((prompt) => prompt.id === id);
}
