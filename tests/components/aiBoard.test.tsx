// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiBoard } from "@/components/AiBoard";
import { DEFAULT_PROFILE } from "@/types/profile";

const idleSession = {
  board: null,
  isRefreshing: false,
  partialTranscript: "",
};

const callbacks = {
  onSubmitQuestion: vi.fn(),
  onResetChoices: vi.fn(),
  onToggleListening: vi.fn(),
  onNoiseGateChange: vi.fn(),
  onChoose: vi.fn(),
};

describe("AiBoard noise filter control", () => {
  afterEach(cleanup);

  it("is disabled while a listening session is active", () => {
    render(
      <AiBoard
        session={idleSession}
        profile={{ ...DEFAULT_PROFILE, noiseGateDb: -30 }}
        realtimeState="connected"
        online
        {...callbacks}
      />,
    );

    expect(screen.getByRole("slider", { name: "Noise filter threshold" })).toBeDisabled();
    expect(screen.getByText("−30 dBFS")).toBeInTheDocument();
  });

  it("keeps the threshold editable while idle", () => {
    render(
      <AiBoard
        session={idleSession}
        profile={DEFAULT_PROFILE}
        realtimeState="idle"
        online
        {...callbacks}
      />,
    );

    expect(screen.getByRole("slider", { name: "Noise filter threshold" })).toBeEnabled();
    expect(screen.getByText("Off")).toBeInTheDocument();
  });
});
