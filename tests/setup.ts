import { afterEach, vi } from "vitest";

/**
 * Shared setup. Runs for node and jsdom files alike, so everything here is
 * guarded — a node-environment test has no `document` to clean up.
 */
const isBrowserLike = typeof window !== "undefined" && typeof document !== "undefined";

if (isBrowserLike) {
  // DOM matchers (toHaveValue, toBeDisabled, …). Imported only under jsdom so
  // the node-environment suite does not pay for them.
  await import("@testing-library/jest-dom/vitest");
}

if (isBrowserLike) {
  // jsdom implements neither of these, and both are load-bearing for the app.
  class FakeUtterance {
    text: string;
    rate = 1;
    lang = "en-US";
    voice: SpeechSynthesisVoice | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }

  const spoken: string[] = [];
  const synth = {
    speak: (utterance: { text: string }) => void spoken.push(utterance.text),
    cancel: () => undefined,
    getVoices: () => [] as SpeechSynthesisVoice[],
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    /** Test-only view of what was said. */
    __spoken: spoken,
  };

  Object.defineProperty(window, "speechSynthesis", { value: synth, writable: true });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    value: FakeUtterance,
    writable: true,
  });

  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }

  afterEach(() => {
    spoken.length = 0;
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });
}

/** What the app spoke since the last test, in order. */
export function spokenPhrases(): string[] {
  return (window.speechSynthesis as unknown as { __spoken: string[] }).__spoken;
}
