// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/app/error";
import { DEFAULT_PROFILE } from "@/types/profile";
import { spokenPhrases } from "../setup";

afterEach(cleanup);

/**
 * The promise is that communication survives failure. A crash is one more
 * failure, so the recovery screen has to be a usable board — not an apology.
 */
describe("crash recovery", () => {
  it("renders a working manual board instead of an error page", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<ErrorBoundary error={new Error("boom")} retry={() => undefined} />);

    // All four rows of real vocabulary are there.
    for (const row of ["Core words", "Responses", "Needs", "Feelings and actions"]) {
      expect(screen.getByRole("region", { name: row })).toBeDefined();
    }

    // And the board actually talks.
    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^I$/ }));
    await user.click(within(core).getByRole("button", { name: /^want$/ }));
    expect(spokenPhrases()).toEqual(["I", "want"]);

    await user.click(screen.getByRole("button", { name: /speak/i }));
    expect(spokenPhrases().at(-1)).toBe("I want");
  });

  it("offers a retry and does not leak the error message", () => {
    const retry = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary
        error={Object.assign(new Error("ECONNREFUSED 127.0.0.1:54321 secret-token-abc"), {
          digest: "d1",
        })}
        retry={retry}
      />,
    );

    expect(document.body.textContent).not.toContain("ECONNREFUSED");
    expect(document.body.textContent).not.toContain("secret-token-abc");
    expect(screen.getByText(/your board still works/i)).toBeDefined();
    screen.getByRole("button", { name: /try again/i }).click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("still renders when reading stored settings throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Storage is explicitly one of the things allowed to be broken.
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("site data blocked");
    });

    render(<ErrorBoundary error={new Error("boom")} retry={() => undefined} />);

    expect(screen.getByRole("region", { name: "Core words" })).toBeDefined();
    getItem.mockRestore();
  });

  it("records nothing to history while recovering", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    render(<ErrorBoundary error={new Error("boom")} retry={() => undefined} />);
    const core = screen.getByRole("region", { name: "Core words" });
    await user.click(within(core).getByRole("button", { name: /^want$/ }));

    // Storage may be what failed; recovery must not risk a second crash.
    expect(setItem).not.toHaveBeenCalled();
    expect(DEFAULT_PROFILE.historyEnabled).toBe(true); // not disabled by config
  });
});
