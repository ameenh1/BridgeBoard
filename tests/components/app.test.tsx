// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BridgeBoardApp } from "@/components/BridgeBoardApp";
import { getApprovedVocabularyItem } from "@/lib/vocabulary/vocabularyHelpers";
import { DEFAULT_BOARD_ROWS, missingDefaultBoardIds } from "@/lib/board/defaultBoardLayout";
import { DEFAULT_PROFILE } from "@/types/profile";
import type { RenderableBoard, RenderableChoice } from "@/types/board";
import { spokenPhrases } from "../setup";

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

/** A fetch stub that answers /api/health and queues classify responses. */
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
    const next = queue.shift();
    if (next) return next();
    return new Response("{}", { status: 500 });
  });
  vi.stubGlobal("fetch", impl);
  return calls;
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
  stubFetch([]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Gets past login + setup into the app, with the given stored profile. */
async function enterApp(user: ReturnType<typeof userEvent.setup>) {
  window.localStorage.setItem(
    "bridgeboard.profile.v1",
    JSON.stringify({ ...DEFAULT_PROFILE, displayName: "Cha" }),
  );
  window.sessionStorage.setItem("bridgeboard.localSession", "1");
  render(<BridgeBoardApp />);
  await screen.findByRole("navigation", { name: /main/i });
  return user;
}

describe("login", () => {
  it("continues locally with both fields blank and transmits nothing", async () => {
    const user = userEvent.setup();
    const calls = stubFetch([]);
    render(<BridgeBoardApp />);

    expect(await screen.findByLabelText("Email")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: /continue locally/i }));

    // Straight to setup, and no request carried anything from the form.
    await screen.findByRole("heading", { name: /set up this board/i });
    expect(calls.every((call) => !JSON.stringify(call.body ?? {}).includes("@"))).toBe(true);
  });

  it("never sends or stores what was typed into the credential fields", async () => {
    const user = userEvent.setup();
    const calls = stubFetch([]);
    render(<BridgeBoardApp />);

    await user.type(await screen.findByLabelText("Email"), "someone@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: /continue locally/i }));
    await screen.findByRole("heading", { name: /set up this board/i });

    const everything = JSON.stringify({
      calls,
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    });
    expect(everything).not.toContain("someone@example.com");
    expect(everything).not.toContain("hunter2");
    // Only the non-sensitive flag is kept.
    expect(window.sessionStorage.getItem("bridgeboard.localSession")).toBe("1");
  });

  it("shows the saved profile instead of setup when one exists", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "bridgeboard.profile.v1",
      JSON.stringify({ ...DEFAULT_PROFILE, displayName: "Cha" }),
    );
    render(<BridgeBoardApp />);

    await user.click(await screen.findByRole("button", { name: /continue locally/i }));
    expect(await screen.findByText("Cha")).toBeDefined();
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
    expect(spokenPhrases()).toEqual(["I", "want"]);
    expect(screen.getByText("2 words")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /speak/i }));
    expect(spokenPhrases().at(-1)).toBe("I want");

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

    const before = spokenPhrases().length;
    await user.click(screen.getByRole("button", { name: /^help$/i }));
    expect(spokenPhrases().length).toBe(before + 1);

    release?.();

    // After commit: waffles keeps its ready image and its selection, pancakes
    // is the only pending tile, dragon fruit is gone.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /dragon fruit/i })).toBeNull();
    });
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

  it("survives a trip to History and back", async () => {
    const user = userEvent.setup();
    stubFetch([jsonBoard(board([choice("waffles", "a", true)], "Waffles?"))]);

    await enterApp(user);
    await askFirstQuestion(user);
    await screen.findByRole("button", { name: /waffles/i });
    await user.click(screen.getByRole("button", { name: /waffles/i }));

    await user.click(screen.getByRole("button", { name: /history/i }));
    await screen.findByRole("heading", { name: /^history$/i });
    await user.click(screen.getByRole("button", { name: /ai aac/i }));

    // Same board, same resolved picture, same selection.
    const waffles = await screen.findByRole("button", { name: /waffles/i });
    expect(waffles.getAttribute("aria-pressed")).toBe("true");
    expect(waffles.querySelector(".choice-visual")?.getAttribute("data-status")).toBe("ready");
  });

  it("switches to the manual board on Full board without waiting for the AI", async () => {
    const user = userEvent.setup();
    await enterApp(user);
    await user.click(screen.getByRole("button", { name: /ai aac/i }));

    await user.click(screen.getByRole("button", { name: /full board/i }));
    expect(await screen.findByRole("region", { name: "Core words" })).toBeDefined();
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
    await screen.findByRole("navigation", { name: /main/i });
    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /open settings/i }));
    expect(await screen.findByLabelText(/button size/i)).toHaveValue("standard");
  });

  it("records a selection to history and survives a remount", async () => {
    const user = userEvent.setup();
    await enterApp(user);

    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^want$/ }));

    cleanup();
    render(<BridgeBoardApp />);
    await screen.findByRole("navigation", { name: /main/i });
    await user.click(screen.getByRole("button", { name: /history/i }));
    expect(await screen.findByText("want")).toBeDefined();
  });

  it("records nothing when history is turned off", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "bridgeboard.profile.v1",
      JSON.stringify({ ...DEFAULT_PROFILE, displayName: "Cha", historyEnabled: false }),
    );
    window.sessionStorage.setItem("bridgeboard.localSession", "1");
    render(<BridgeBoardApp />);
    await screen.findByRole("navigation", { name: /main/i });

    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^want$/ }));

    await user.click(screen.getByRole("button", { name: /history/i }));
    expect(await screen.findByText(/no phrases yet/i)).toBeDefined();
  });

  it("silences speech in quiet mode", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "bridgeboard.profile.v1",
      JSON.stringify({ ...DEFAULT_PROFILE, displayName: "Cha", quietMode: true }),
    );
    window.sessionStorage.setItem("bridgeboard.localSession", "1");
    render(<BridgeBoardApp />);
    await screen.findByRole("navigation", { name: /main/i });

    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^want$/ }));
    expect(spokenPhrases()).toEqual([]);
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
    expect(screen.getByText(/nothing is listening until you press listen/i)).toBeDefined();
  });
});
