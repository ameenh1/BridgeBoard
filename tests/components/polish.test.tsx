// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BridgeBoardApp } from "@/components/BridgeBoardApp";
import { DEFAULT_PROFILE } from "@/types/profile";

const cloudState = vi.hoisted(() => ({
  user: { id: "u1", email: "caregiver@example.com" },
  profile: null as typeof DEFAULT_PROFILE | null,
}));

vi.mock("@/lib/storage/cloud", () => ({
  getCurrentUser: vi.fn(async () => cloudState.user),
  loadCloudProfile: vi.fn(async () => cloudState.profile),
  loadCloudHistory: vi.fn(async () => []),
  saveCloudProfile: vi.fn(async (_userId: string, profile: typeof DEFAULT_PROFILE) => profile),
  saveCloudHistory: vi.fn(async () => undefined),
  clearCloudHistory: vi.fn(async () => undefined),
  signOutCloud: vi.fn(async () => undefined),
}));

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

async function enterApp(profile: Partial<typeof DEFAULT_PROFILE> = {}) {
  cloudState.profile = {
    ...DEFAULT_PROFILE,
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Cha",
    ...profile,
  };
  render(<BridgeBoardApp />);
  await screen.findByRole("heading", { name: /who is communicating today/i });
  screen.getByRole("button", { name: /cha/i }).click();
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  setOnline(true);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  stubHealth();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("offline", () => {
  it("explains that the AI needs a network and the board does not", async () => {
    const user = userEvent.setup();
    setOnline(false);
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });
    await user.click(screen.getByRole("button", { name: /ai aac/i }));

    expect(await screen.findByText(/no connection/i)).toBeDefined();
    expect(screen.getByText(/still works and still speaks/i)).toBeDefined();
  });

  it("disables Listen so it cannot fail as a fake microphone error", async () => {
    const user = userEvent.setup();
    setOnline(false);
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });
    await user.click(screen.getByRole("button", { name: /ai aac/i }));

    expect(screen.getByRole("button", { name: /listen/i })).toBeDisabled();
  });

  it("leaves the manual board fully usable", async () => {
    const user = userEvent.setup();
    setOnline(false);
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    const core = screen.getByRole("region", { name: "Core words" });
    const tile = within(core).getByRole("button", { name: /^want$/ });
    expect(tile).not.toBeDisabled();
    await user.click(tile);
  });

  it("recovers when the connection returns", async () => {
    const user = userEvent.setup();
    setOnline(false);
    await enterApp();
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
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /history/i }));

    const region = await screen.findByRole("region", { name: "History" });
    // A keyboard or switch user continues from here rather than the top of
    // the document, and a screen reader reads the region's name.
    expect(document.activeElement).toBe(region);
  });

  it("does not steal focus on first load", async () => {
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });
    expect(document.activeElement).toBe(document.body);
  });

  it("names each view it moves into", async () => {
    const user = userEvent.setup();
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /ai aac/i }));
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "AI AAC" }));

    await user.click(screen.getByRole("button", { name: /default aac/i }));
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Default AAC board" }),
    );
  });
});
