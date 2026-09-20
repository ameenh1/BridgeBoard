// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRealtimeTranscriptionController } from "@/lib/speech/realtimeTranscription";

class FakeTrack {
  stopped = false;

  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  readonly track = new FakeTrack();

  getAudioTracks() {
    return [this.track];
  }

  getTracks() {
    return [this.track];
  }
}

class FakeChannel {
  readyState = "open";
  listeners = new Map<string, (event: unknown) => void>();

  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, listener);
  }

  close() {
    this.readyState = "closed";
  }

  send() {}
}

class FakePeer {
  connectionState = "new";
  localDescription: { type: "offer"; sdp: string } | null = null;
  readonly channel = new FakeChannel();
  readonly tracks: Array<{ track: FakeTrack; stream: FakeStream }> = [];

  createDataChannel() {
    return this.channel;
  }

  addTrack(track: FakeTrack, stream: FakeStream) {
    this.tracks.push({ track, stream });
  }

  async createOffer() {
    return { type: "offer" as const, sdp: "offer-sdp" };
  }

  async setLocalDescription(description: { type: "offer"; sdp: string }) {
    this.localDescription = description;
  }

  async setRemoteDescription() {}

  close() {}
}

const Peer = FakePeer as unknown as typeof RTCPeerConnection;
const originalMediaDevices = navigator.mediaDevices;

afterEach(() => {
  if (originalMediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
});

describe("realtime microphone capture", () => {
  it("keeps the raw stream and leaves the threshold control off by default", async () => {
    const stream = new FakeStream();
    const getUserMedia = vi.fn(async () => stream as unknown as MediaStream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    let peer: FakePeer | undefined;
    const controller = createRealtimeTranscriptionController({
      peerConnectionConstructor: class extends Peer {
        constructor() {
          super();
          peer = this as unknown as FakePeer;
        }
      } as typeof RTCPeerConnection,
      fetchImpl: vi.fn(async () => new Response("answer-sdp", { status: 200 })),
    });

    await controller.start();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(peer?.tracks[0]?.stream).toBe(stream);

    await controller.stop();
    expect(stream.track.stopped).toBe(true);
  });

  it("requests native suppression and reports a non-fatal fallback when Web Audio is unavailable", async () => {
    const stream = new FakeStream();
    const getUserMedia = vi.fn(async () => stream as unknown as MediaStream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const onProcessingNotice = vi.fn();
    const controller = createRealtimeTranscriptionController({
      peerConnectionConstructor: Peer,
      fetchImpl: vi.fn(async () => new Response("answer-sdp", { status: 200 })),
      noiseGateDb: -30,
      onProcessingNotice,
    });

    await controller.start();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { noiseSuppression: true } });
    expect(onProcessingNotice).toHaveBeenCalledWith(expect.stringMatching(/still works/i));
    await controller.stop();
  });
});
