// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AiNotificationDock } from "@/components/AiNotificationDock";

describe("AiNotificationDock", () => {
  afterEach(cleanup);

  it("does not render microphone connection failures", () => {
    render(<AiNotificationDock online />);

    expect(screen.queryByText(/microphone could not connect/i)).not.toBeInTheDocument();
  });

  it("uses status semantics for informational notices", () => {
    render(
      <AiNotificationDock
        online
        microphoneNotice="Finishing the transcript…"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Finishing the transcript…");
  });

  it("orders simultaneous notifications by urgency", () => {
    render(
      <AiNotificationDock
        online={false}
        boardError="asset_stream"
        microphoneNotice="Finishing the transcript…"
      />,
    );

    const dock = screen.getByRole("complementary", { name: "AI AAC notifications" });
    const messages = Array.from(dock.querySelectorAll(".ai-toast"))
      .map((notice) => notice.textContent?.replace(/\s+/g, " ").trim());

    expect(messages).toEqual([
      "No connection. The AI needs a network — Default AAC still works and still speaks.",
      "Some pictures could not load. Every choice still works.",
      "Finishing the transcript…",
    ]);
  });
});
