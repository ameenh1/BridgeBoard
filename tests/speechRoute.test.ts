import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/speech/route";

function speechRequest(text: string): Request {
  return new Request("http://localhost/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

function audioResponse(): Response {
  return new Response(new Blob(["audio"]), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });
}

function stubElevenLabs() {
  const calls: RequestInit[] = [];
  const upstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init ?? {});
    return audioResponse();
  });
  vi.stubGlobal("fetch", upstream);
  return calls;
}

function requestBodies(calls: RequestInit[]) {
  return calls.map((init) => JSON.parse(String(init.body)) as Record<string, unknown>);
}

beforeEach(() => {
  vi.stubEnv("ELEVENLABS_API_KEY", "test-api-key");
  vi.stubEnv("ELEVENLABS_VOICE_ID", "voice-test");
  vi.stubEnv("ELEVENLABS_MODEL", "eleven_flash_v2_5");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("speech route", () => {
  it("sends locked voice settings, model, voice, and a valid seed", async () => {
    const calls = stubElevenLabs();

    const response = await POST(speechRequest("Yes"));

    expect(response.status).toBe(200);
    const [body] = requestBodies(calls);
    expect(body).toMatchObject({
      text: "Yes",
      model_id: "eleven_flash_v2_5",
      voice_settings: {
        stability: 1,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
        speed: 1,
      },
    });
    expect(body.seed).toEqual(expect.any(Number));
    expect(body.seed).toBeGreaterThanOrEqual(0);
    expect(body.seed).toBeLessThanOrEqual(4_294_967_295);
  });

  it("derives the same seed for normalized text and different seeds for different text", async () => {
    const calls = stubElevenLabs();

    await POST(speechRequest("  Yes  "));
    await POST(speechRequest("Yes"));
    await POST(speechRequest("No"));

    const bodies = requestBodies(calls);
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[0].seed).not.toBe(bodies[2].seed);
  });

  it("uses the configured model and voice without changing the public request shape", async () => {
    const calls = stubElevenLabs();
    vi.stubEnv("ELEVENLABS_VOICE_ID", "configured-voice");
    vi.stubEnv("ELEVENLABS_MODEL", "configured-model");

    const response = await POST(speechRequest("Read"));
    const [body] = requestBodies(calls);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ text: "Read", model_id: "configured-model" });
    expect(new Headers(calls[0]?.headers).get("xi-api-key")).toBe("test-api-key");
  });

  it("preserves the existing 503 when ElevenLabs is unconfigured", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    const response = await POST(speechRequest("Yes"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "speech_unconfigured" });
  });
});
