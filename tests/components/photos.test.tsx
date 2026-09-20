// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BridgeBoardApp } from "@/components/BridgeBoardApp";
import { savePersonalPhoto } from "@/lib/storage/personalPhotos";
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

const PHOTO = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  cloudState.profile = { ...DEFAULT_PROFILE, id: "11111111-1111-4111-8111-111111111111", displayName: "Cha" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ classifier: "live", sharedCache: "configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function enterApp() {
  render(<BridgeBoardApp />);
  await screen.findByRole("heading", { name: /who is communicating today/i });
  await screen.getByRole("button", { name: /cha/i }).click();
}

describe("personal photos on the board", () => {
  it("replaces the bundled drawing on the manual board", async () => {
    // need_water ships with bundled artwork, so this proves the photo wins
    // over a real curated image rather than merely filling an empty slot.
    savePersonalPhoto("need_water", PHOTO);
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    const needs = screen.getByRole("region", { name: "Needs" });
    const tile = within(needs).getByRole("button", { name: /water/i });
    const img = tile.querySelector("img");

    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(PHOTO);
  });

  it("shows the bundled drawing when there is no photo", async () => {
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    const needs = screen.getByRole("region", { name: "Needs" });
    const tile = within(needs).getByRole("button", { name: /water/i });
    const src = tile.querySelector("img")?.getAttribute("src") ?? "";

    expect(src).not.toBe(PHOTO);
    expect(src).toContain("drink");
  });

  it("is reachable from the caregiver screen and reports the count", async () => {
    const user = userEvent.setup();
    savePersonalPhoto("need_water", PHOTO);
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /manage 1 photos/i }));

    expect(await screen.findByRole("heading", { name: /personal photos/i })).toBeDefined();
    expect(screen.getByText(/1 of \d+ photos used/i)).toBeDefined();
  });

  it("says plainly that photos never leave the device", async () => {
    const user = userEvent.setup();
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /add photos/i }));

    expect(screen.getByText(/never uploaded, never sent to the ai/i)).toBeDefined();
  });

  it("removing a photo restores the drawing", async () => {
    const user = userEvent.setup();
    savePersonalPhoto("need_water", PHOTO);
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /manage 1 photos/i }));
    await user.click(await screen.findByRole("button", { name: /remove photo for water/i }));

    await user.click(screen.getByRole("button", { name: /default aac/i }));
    const needs = screen.getByRole("region", { name: "Needs" });
    const src = within(needs)
      .getByRole("button", { name: /water/i })
      .querySelector("img")
      ?.getAttribute("src");
    expect(src).not.toBe(PHOTO);
  });

  it("resetting the profile erases photos too", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    savePersonalPhoto("need_water", PHOTO);
    await enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /open settings/i }));
    await user.click(await screen.findByRole("button", { name: /reset this profile/i }));

    expect(window.localStorage.getItem("bridgeboard.personalPhotos.v1")).toBeNull();
  });
});
