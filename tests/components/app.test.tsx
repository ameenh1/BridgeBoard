// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BridgeBoardApp } from "@/components/BridgeBoardApp";
import { getApprovedVocabularyItem } from "@/lib/vocabulary/vocabularyHelpers";
import { DEFAULT_BOARD_ROWS, missingDefaultBoardIds } from "@/lib/board/defaultBoardLayout";
import { DEFAULT_PROFILE } from "@/types/profile";
import type { RenderableBoard, RenderableChoice } from "@/types/board";

const cloudState = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  signInUser: null as { id: string; email: string } | null,
  profile: null as typeof DEFAULT_PROFILE | null,
  history: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/storage/cloud", () => ({
  getCurrentUser: vi.fn(async () => cloudState.user),
  loadCloudProfile: vi.fn(async () => cloudState.profile),
  loadCloudHistory: vi.fn(async () => cloudState.history),
  saveCloudProfile: vi.fn(async (_userId: string, profile: typeof DEFAULT_PROFILE) => {
    cloudState.profile = profile;
    return profile;
  }),
  saveCloudHistory: vi.fn(async (_userId: string, _profileId: string | undefined, entry: Record<string, unknown>) => {
    cloudState.history.push(entry);
  }),
  clearCloudHistory: vi.fn(async () => undefined),
  signOutCloud: vi.fn(async () => {
    cloudState.user = null;
  }),
  signInWithPassword: vi.fn(async () => cloudState.signInUser
    ? (cloudState.user = cloudState.signInUser, { user: cloudState.signInUser, error: null, needsEmailConfirmation: false })
    : { user: null, error: new Error("invalid login credentials"), needsEmailConfirmation: false }),
  signUpWithPassword: vi.fn(async () => ({
    user: null,
    error: null,
    needsEmailConfirmation: true,
  })),
}));

const BOARD_ID = "22222222-2222-4222-8222-222222222222";

function choice(key: string, assetKey: string, ready = false): RenderableChoice {
  return {
    id: key,
    choiceKey: key,
    label: key,
    spokenPhrase: `I want ${key}.`,
    iconKey: "shapes",
    origin: "catalog",
    visual: ready
      ? { assetKey, status: "ready", source: "generated", url: `data:image/webp;base64,${assetKey}AAA` }
      : { assetKey, status: "pending" },
  };
}

function board(choices: RenderableChoice[], questionText?: string): RenderableBoard {
  return {
    boardId: BOARD_ID,
    title: "Choices",
    questionText,
    boardType: "choice",
    choices,
    actions: ["help", "repeat", "full_board"],
    isFallback: false,
    isRefreshing: false,
  };
}

/**
 * What /api/auth/* returns for a test. Overridden per test via `authResult`
 * when a signed-in session is what is being exercised.
 */
let authResponse: (url: string) => unknown = () => ({ status: "anonymous" });

function setAuthResponse(next: (url: string) => unknown) {
  authResponse = next;
}

/** A fetch stub that answers /api/health and /api/auth/*, and queues classify responses. */
function stubFetch(queue: Array<() => Promise<Response>>) {
  const calls: Array<{ url: string; body?: unknown }> = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes("/api/health")) {
      return new Response(
        JSON.stringify({ classifier: "live", sharedCache: "optional_unconfigured" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/api/speech")) {
      return new Response(new Blob(["test-audio"]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      });
    }
    /**
     * Answered here rather than from the queue: the shell probes for an
     * existing session on mount, and letting that probe consume a queued
     * board response would desynchronise every test after it. Default is
     * signed-out, which is the state these tests describe.
     */
    if (url.includes("/api/auth/")) {
      return new Response(JSON.stringify(authResponse(url)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const next = queue.shift();
    if (next) return next();
    return new Response("{}", { status: 500 });
  });
  vi.stubGlobal("fetch", impl);
  return calls;
}

/** Phrases the app sent to /api/speech since the test started, in order. */
function speechTexts(): string[] {
  return vi.mocked(fetch).mock.calls
    .map(([input, init]) => ({ url: String(input), body: (init as RequestInit | undefined)?.body }))
    .filter((call) => call.url.includes("/api/speech"))
    .map((call) => (JSON.parse(String(call.body)) as { text: string }).text);
}

function jsonBoard(next: RenderableBoard) {
  return async () =>
    new Response(JSON.stringify({ board: next }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  cloudState.user = null;
  cloudState.signInUser = null;
  cloudState.profile = null;
  cloudState.history = [];
  setAuthResponse(() => ({ status: "anonymous" }));
  stubFetch([]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Gets past login + setup into the app, with the given stored profile. */
async function enterApp(user: ReturnType<typeof userEvent.setup>) {
  cloudState.user = { id: "u1", email: "caregiver@example.com" };
  cloudState.profile = { ...DEFAULT_PROFILE, id: "11111111-1111-4111-8111-111111111111", displayName: "Cha" };
  render(<BridgeBoardApp />);
  await screen.findByRole("heading", { name: /who is communicating today/i });
  await user.click(screen.getByRole("button", { name: /cha/i }));
  await screen.findByRole("navigation", { name: /main/i });
  return user;
}

describe("login", () => {
  it("requires an account before entering the board", async () => {
    const user = userEvent.setup();
    render(<BridgeBoardApp />);

    expect(await screen.findByLabelText("Email")).toHaveValue("");
    expect(screen.queryByRole("button", { name: /continue without an account/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByRole("alert")).toBeDefined();
  });

  it("creates an account and asks for email confirmation", async () => {
    const user = userEvent.setup();
    render(<BridgeBoardApp />);

    await user.click(await screen.findByRole("button", { name: /sign up/i }));
    await user.type(screen.getByLabelText("Email"), "someone@example.com");
    await user.type(screen.getByLabelText("Password"), "a secure password");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/check your email/i);
  });

  it("offers sign-up after a failed sign-in", async () => {
    const user = userEvent.setup();
    render(<BridgeBoardApp />);

    await user.type(await screen.findByLabelText("Email"), "someone@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByText(/account not found/i)).toBeDefined();
    await user.click(screen.getByRole("button", { name: /create an account/i }));
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeDefined();
  });

  it("signs in and enters the app", async () => {
    const user = userEvent.setup();
    cloudState.signInUser = { id: "u1", email: "caregiver@example.com" };
    cloudState.profile = { ...DEFAULT_PROFILE, id: "11111111-1111-4111-8111-111111111111", displayName: "Cha" };
    render(<BridgeBoardApp />);

    await user.type(await screen.findByLabelText("Email"), "caregiver@example.com");
    await user.type(screen.getByLabelText("Password"), "a good password");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByRole("heading", { name: /who is communicating today/i });
    await user.click(screen.getByRole("button", { name: /cha/i }));
    expect(await screen.findByRole("navigation", { name: /main/i })).toBeDefined();
  });
});

describe("default board", () => {
  it("takes every label from the approved vocabulary", async () => {
    const user = userEvent.setup();
    await enterApp(user);

    expect(missingDefaultBoardIds()).toEqual([]);
    for (const row of DEFAULT_BOARD_ROWS) {
      const section = screen.getByRole("region", { name: row.label });
      for (const id of row.ids) {
        const item = getApprovedVocabularyItem(id);
        expect(item, `catalog is missing ${id}`).toBeDefined();
        // The tile text is the catalog's label, not a string in the layout.
        expect(within(section).getByText(item!.label)).toBeDefined();
      }
    }
  });

  it("composes, speaks, backspaces and clears", async () => {
    const user = userEvent.setup();
    await enterApp(user);

    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^I$/ }));
    await user.click(within(core).getByRole("button", { name: /^want$/ }));

    // Tapping a tile speaks that tile's authored phrase.
    await waitFor(() => expect(speechTexts()).toEqual(["I", "want"]));
    expect(screen.getByText("2 words")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /speak/i }));
    await waitFor(() => expect(speechTexts().at(-1)).toBe("I want"));

    await user.click(screen.getByRole("button", { name: /delete last word/i }));
    expect(screen.getByText("1 word")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(screen.getByText("Tap a picture to build a sentence")).toBeDefined();
  });
});

describe("ai board", () => {
  async function askFirstQuestion(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /ai aac/i }));
    await user.type(
      screen.getByLabelText(/caregiver question/i),
      "Would you like waffles or dragon fruit?",
    );
    await user.click(screen.getByRole("button", { name: /^ask$/i }));
  }

  it("shows an empty AI row above the default answers before the first question", async () => {
    const user = userEvent.setup();
    await enterApp(user);
    await user.click(screen.getByRole("button", { name: /ai aac/i }));
    expect(await screen.findAllByText(/waiting for a question/i)).toHaveLength(4);
    for (const label of ["Yes", "No", "more", "all done"]) {
      expect(screen.getByText(label, { selector: "strong" })).toBeDefined();
    }
  });

  it("keeps the committed board usable while the next question is pending", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    stubFetch([
      jsonBoard(board([choice("waffles", "a", true), choice("dragon fruit", "b", true)])),
      async () => {
        await gate;
        return new Response(
          JSON.stringify({ board: board([choice("waffles", "a"), choice("pancakes", "c")]) }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    ]);

    await enterApp(user);
    await askFirstQuestion(user);
    await screen.findByRole("button", { name: /waffles/i });

    // Select waffles, then ask the follow-up.
    await user.click(screen.getByRole("button", { name: /waffles/i }));
    await user.clear(screen.getByLabelText(/caregiver question/i));
    await user.type(
      screen.getByLabelText(/caregiver question/i),
      "Would you like waffles or pancakes?",
    );
    await user.click(screen.getByRole("button", { name: /^ask$/i }));

    // Mid-classification: both old choices are still on screen and clickable,
    // the selection is still held, and support actions still work.
    await screen.findByText(/updating choices/i);
    const waffles = screen.getByRole("button", { name: /waffles/i });
    const dragon = screen.getByRole("button", { name: /dragon fruit/i });
    expect(waffles).not.toBeDisabled();
    expect(dragon).not.toBeDisabled();
    expect(waffles.getAttribute("aria-pressed")).toBe("true");

    const before = speechTexts().length;
    await user.click(screen.getByRole("button", { name: /^help$/i }));
    await waitFor(() => expect(speechTexts().length).toBe(before + 1));

    release?.();

    // After commit: waffles keeps its ready image and its selection, pancakes
    // is the only pending tile, and dragon fruit stays on as gallery history.
    const committedDragon = await screen.findByRole("button", { name: /dragon fruit/i });
    expect(committedDragon).not.toBeDisabled();
    const committedWaffles = screen.getByRole("button", { name: /waffles/i });
    expect(committedWaffles.getAttribute("aria-pressed")).toBe("true");
    expect(
      committedWaffles.querySelector(".choice-visual")?.getAttribute("data-status"),
    ).toBe("ready");
    expect(
      screen
        .getByRole("button", { name: /pancakes/i })
        .querySelector(".choice-visual")
        ?.getAttribute("data-status"),
    ).toBe("pending");
  });

  it("keeps the committed board when the next classification fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stubFetch([
      jsonBoard(board([choice("waffles", "a", true)])),
      async () => new Response("nope", { status: 500 }),
    ]);

    await enterApp(user);
    await askFirstQuestion(user);
    await screen.findByRole("button", { name: /waffles/i });

    await user.clear(screen.getByLabelText(/caregiver question/i));
    await user.type(screen.getByLabelText(/caregiver question/i), "Something unanswerable?");
    await user.click(screen.getByRole("button", { name: /^ask$/i }));

    await screen.findByText(/previous choices are still available/i);
    expect(screen.getByRole("button", { name: /waffles/i })).not.toBeDisabled();
  });


  it("switches to the full board without waiting for the AI", async () => {
    const user = userEvent.setup();
    await enterApp(user);
    await user.click(screen.getByRole("button", { name: /ai aac/i }));

    // Scoped to the support actions: "Full board" is also a nav tab now.
    const actions = document.querySelector(".action-rail") as HTMLElement;
    await user.click(within(actions).getByRole("button", { name: /full board/i }));
    expect(await screen.findByRole("region", { name: "People" })).toBeDefined();
  });
});

describe("settings and history", () => {
  it("persists settings across a remount", async () => {
    const user = userEvent.setup();
    await enterApp(user);

    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /open settings/i }));
    await user.selectOptions(await screen.findByLabelText(/button size/i), "standard");

    cleanup();
    render(<BridgeBoardApp />);
    await screen.findByRole("heading", { name: /who is communicating today/i });
    await user.click(screen.getByRole("button", { name: /cha/i }));
    await screen.findByRole("navigation", { name: /main/i });
    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /open settings/i }));
    expect(await screen.findByLabelText(/button size/i)).toHaveValue("standard");
  });



  it("silences speech in quiet mode", async () => {
    const user = userEvent.setup();
    cloudState.user = { id: "u1", email: "caregiver@example.com" };
    cloudState.profile = { ...DEFAULT_PROFILE, id: "11111111-1111-4111-8111-111111111111", displayName: "Cha", quietMode: true };
    render(<BridgeBoardApp />);
    await screen.findByRole("heading", { name: /who is communicating today/i });
    await user.click(screen.getByRole("button", { name: /cha/i }));
    await screen.findByRole("navigation", { name: /main/i });

    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^want$/ }));
    expect(speechTexts()).toEqual([]);
  });
});

describe("microphone", () => {
  it("leaves typed input usable when the microphone is unavailable", async () => {
    const user = userEvent.setup();
    // jsdom has no getUserMedia, which is exactly the not_supported path.
    stubFetch([jsonBoard(board([choice("waffles", "a", true)]))]);
    await enterApp(user);
    await user.click(screen.getByRole("button", { name: /ai aac/i }));

    await user.click(screen.getByRole("button", { name: /listen/i }));
    expect(await screen.findByRole("alert")).toBeDefined();

    // The question box still works.
    await user.type(screen.getByLabelText(/caregiver question/i), "Waffles?");
    await user.click(screen.getByRole("button", { name: /^ask$/i }));
    expect(await screen.findByRole("button", { name: /waffles/i })).toBeDefined();
  });

  it("does not listen before Listen is pressed", async () => {
    const user = userEvent.setup();
    await enterApp(user);
    await user.click(screen.getByRole("button", { name: /ai aac/i }));
    // No listening indicator takes a row until Listen is actually pressed.
    expect(screen.queryByText(/listening for a complete question/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /listen for a spoken question/i }),
    ).toBeDefined();
  });
});
