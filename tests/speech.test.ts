// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelSpeech, speakNatural } from "@/lib/speech/speak";
import { DEFAULT_PROFILE } from "@/types/profile";
import { spokenPhrases } from "./setup";

class FakeAudio {
  onended: (() => void) | null = null;
  currentTime = 0;

  constructor() {}

  pause(): void {}

  async play(): Promise<void> {}
}

const originalCreateObjectURL = URL.createObjectURL;

function installAudioMocks(): void {
  vi.stubGlobal("Audio", FakeAudio);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test-audio"),
  });
}

afterEach(() => {
  cancelSpeech();
  vi.unstubAllGlobals();
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
  } else {
    Reflect.deleteProperty(URL, "createObjectURL");
  }
});

describe("natural speech", () => {
  it("retries one transient speech failure with the same request before playing audio", async () => {
    installAudioMocks();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 502 }))
      .mockResolvedValueOnce(
        new Response(new Blob(["audio"]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await speakNatural("Yes", DEFAULT_PROFILE);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([, init]) => init?.body)).toEqual([
      JSON.stringify({ text: "Yes" }),
      JSON.stringify({ text: "Yes" }),
    ]);
    expect(spokenPhrases()).toEqual([]);
  });

  it("falls back to the device voice after one failed retry", async () => {
    installAudioMocks();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 502 }))
      .mockResolvedValueOnce(new Response("still unavailable", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    await speakNatural("No", DEFAULT_PROFILE);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(spokenPhrases()).toEqual(["No"]);
  });

  it("does not retry an unconfigured speech response", async () => {
    installAudioMocks();
    const fetchMock = vi.fn().mockResolvedValue(new Response("unconfigured", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await speakNatural("More", DEFAULT_PROFILE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(spokenPhrases()).toEqual(["More"]);
  });
});
