// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BridgeBoardApp } from "@/components/BridgeBoardApp";
import { DEFAULT_PROFILE } from "@/types/profile";

function stubHealth() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ classifier: "live", sharedCache: "configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

function enterApp(profile: Partial<typeof DEFAULT_PROFILE> = {}) {
  window.localStorage.setItem(
    "bridgeboard.profile.v1",
    JSON.stringify({ ...DEFAULT_PROFILE, displayName: "Cha", ...profile }),
  );
  window.sessionStorage.setItem("bridgeboard.localSession", "1");
  render(<BridgeBoardApp />);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  setOnline(true);
  stubHealth();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("spoken confirmation", () => {
  it("shows what was said", async () => {
    const user = userEvent.setup();
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^want$/ }));

    const bar = document.querySelector(".spoken-bar");
    expect(bar?.textContent).toContain("want");
    expect(bar?.getAttribute("aria-live")).toBe("polite");
  });

  it("is the only output in quiet mode, and says so", async () => {
    const user = userEvent.setup();
    enterApp({ quietMode: true });
    await screen.findByRole("navigation", { name: /main/i });

    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^want$/ }));

    // Nothing was spoken aloud, so the text is the whole message.
    const bar = document.querySelector(".spoken-bar");
    expect(bar?.textContent).toContain("Showing");
    expect(bar?.textContent).toContain("want");
  });

  it("says 'Said' when speech is on", async () => {
    const user = userEvent.setup();
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^want$/ }));
    expect(document.querySelector(".spoken-bar")?.textContent).toContain("Said");
  });

  it("is empty before anything is said", async () => {
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });
    expect(document.querySelector(".spoken-bar")?.textContent).toBe("");
  });
});

describe("offline", () => {
  it("explains that the AI needs a network and the board does not", async () => {
    const user = userEvent.setup();
    setOnline(false);
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });
    await user.click(screen.getByRole("button", { name: /ai aac/i }));

    expect(await screen.findByText(/no connection/i)).toBeDefined();
    expect(screen.getByText(/still works and still speaks/i)).toBeDefined();
  });

  it("disables Listen so it cannot fail as a fake microphone error", async () => {
    const user = userEvent.setup();
    setOnline(false);
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });
    await user.click(screen.getByRole("button", { name: /ai aac/i }));

    expect(screen.getByRole("button", { name: /listen/i })).toBeDisabled();
  });

  it("leaves the manual board fully usable", async () => {
    const user = userEvent.setup();
    setOnline(false);
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    const core = screen.getByRole("region", { name: "Core words" });
    const tile = within(core).getByRole("button", { name: /^want$/ });
    expect(tile).not.toBeDisabled();
    await user.click(tile);
    expect(document.querySelector(".spoken-bar")?.textContent).toContain("want");
  });

  it("recovers when the connection returns", async () => {
    const user = userEvent.setup();
    setOnline(false);
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });
    await user.click(screen.getByRole("button", { name: /ai aac/i }));
    expect(screen.getByRole("button", { name: /listen/i })).toBeDisabled();

    setOnline(true);
    window.dispatchEvent(new Event("online"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /listen/i })).not.toBeDisabled();
    });
    expect(screen.queryByText(/no connection/i)).toBeNull();
  });
});

describe("focus and announcement on view change", () => {
  it("moves focus into the new view and names it", async () => {
    const user = userEvent.setup();
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /history/i }));

    const region = await screen.findByRole("region", { name: "History" });
    // A keyboard or switch user continues from here rather than the top of
    // the document, and a screen reader reads the region's name.
    expect(document.activeElement).toBe(region);
  });

  it("does not steal focus on first load", async () => {
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });
    expect(document.activeElement).toBe(document.body);
  });

  it("names each view it moves into", async () => {
    const user = userEvent.setup();
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /ai aac/i }));
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "AI AAC" }));

    await user.click(screen.getByRole("button", { name: /default aac/i }));
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Default AAC board" }),
    );
  });
});
