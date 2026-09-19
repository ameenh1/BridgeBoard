// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BridgeBoardApp } from "@/components/BridgeBoardApp";
import { savePersonalPhoto } from "@/lib/storage/personalPhotos";
import { DEFAULT_PROFILE } from "@/types/profile";

const PHOTO = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
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
});

function enterApp() {
  window.localStorage.setItem(
    "bridgeboard.profile.v1",
    JSON.stringify({ ...DEFAULT_PROFILE, displayName: "Cha" }),
  );
  window.sessionStorage.setItem("bridgeboard.localSession", "1");
  render(<BridgeBoardApp />);
}

describe("personal photos on the board", () => {
  it("replaces the bundled drawing on the manual board", async () => {
    // need_water ships with bundled artwork, so this proves the photo wins
    // over a real curated image rather than merely filling an empty slot.
    savePersonalPhoto("need_water", PHOTO);
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    const needs = screen.getByRole("region", { name: "Needs" });
    const tile = within(needs).getByRole("button", { name: /water/i });
    const img = tile.querySelector("img");

    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(PHOTO);
  });

  it("shows the bundled drawing when there is no photo", async () => {
    enterApp();
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
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /manage 1 photos/i }));

    expect(await screen.findByRole("heading", { name: /personal photos/i })).toBeDefined();
    expect(screen.getByText(/1 of \d+ photos used/i)).toBeDefined();
  });

  it("says plainly that photos never leave the device", async () => {
    const user = userEvent.setup();
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /add photos/i }));

    expect(screen.getByText(/never uploaded, never sent to the ai/i)).toBeDefined();
  });

  it("removing a photo restores the drawing", async () => {
    const user = userEvent.setup();
    savePersonalPhoto("need_water", PHOTO);
    enterApp();
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
    enterApp();
    await screen.findByRole("navigation", { name: /main/i });

    await user.click(screen.getByRole("button", { name: /cha/i }));
    await user.click(await screen.findByRole("button", { name: /open settings/i }));
    await user.click(await screen.findByRole("button", { name: /reset this profile/i }));

    expect(window.localStorage.getItem("bridgeboard.personalPhotos.v1")).toBeNull();
  });
});
