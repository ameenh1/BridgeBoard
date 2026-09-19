import { describe, expect, it, vi } from "vitest";
import { createOpenAIRealtimeSession } from "@/lib/speech/openaiRealtimeServer";

describe("Realtime session boundary", () => {
  it("sends SDP and a transcription-only realtime session", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const form = init?.body as FormData;
      const session = JSON.parse(String(form.get("session"))) as Record<string, unknown>;
      expect(form.get("sdp")).toBe("v=0\r\n");
      expect(session.type).toBe("realtime");
      expect(JSON.stringify(session)).toContain("create_response");
      return new Response("answer-sdp", { status: 200 });
    });
    const answer = await createOpenAIRealtimeSession({
      sdp: "v=0\r\n",
      apiKey: "server-only-key",
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(answer).toBe("answer-sdp");
    expect((fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>).Authorization)
      .toBe("Bearer server-only-key");
  });
});
