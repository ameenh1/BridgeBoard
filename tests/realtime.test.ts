import { describe, expect, it, vi } from "vitest";
import { createOpenAIRealtimeTranscriptionSession } from "../lib/server.js";

describe("OpenAI Realtime transcription session adapter", () => {
  it("posts a transcription WebRTC session without exposing the standard key", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response("v=0\r\nanswer-sdp", { status: 201 });
    }) as unknown as typeof fetch;

    const answer = await createOpenAIRealtimeTranscriptionSession({
      sdp: "offer-sdp",
      apiKey: "server-test-key",
      languages: ["en"],
      keywords: ["blue cup", "red cup"],
      delay: "low",
      fetchImpl
    });

    expect(answer).toContain("answer-sdp");
    expect(requestUrl).toBe("https://api.openai.com/v1/realtime/calls");
    expect(requestInit?.headers).toBeInstanceOf(Headers);
    expect((requestInit?.headers as Headers).get("authorization")).toBe("Bearer server-test-key");

    const form = requestInit?.body as FormData;
    expect(form.get("sdp")).toBe("offer-sdp");
    const session = JSON.parse(String(form.get("session"))) as {
      type: string;
      model: string;
      audio: {
        input: {
          transcription: Record<string, unknown>;
          turn_detection: {
            type: string;
            create_response?: boolean;
            interrupt_response?: boolean;
          };
        };
      };
    };
    expect(session.type).toBe("realtime");
    expect(session.model).toBe("gpt-realtime-2.1-mini");
    expect(session.audio.input.transcription).toEqual({
      model: "gpt-live-transcribe",
      keywords: ["blue cup", "red cup"],
      languages: ["en"],
      delay: "low"
    });
    expect(session.audio.input.turn_detection.type).toBe("server_vad");
    expect(session.audio.input.turn_detection.create_response).toBe(false);
    expect(session.audio.input.turn_detection.interrupt_response).toBe(false);
  });

  it("supports explicit turn commits and reports OpenAI failures", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad request", { status: 400 })) as unknown as typeof fetch;

    await expect(
      createOpenAIRealtimeTranscriptionSession({
        sdp: "offer-sdp",
        apiKey: "server-test-key",
        turnDetection: null,
        fetchImpl
      })
    ).rejects.toThrow("OpenAI Realtime session creation failed (400)");
  });
});
