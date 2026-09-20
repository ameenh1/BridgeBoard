// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createNoiseGateStream, noiseGateDbToRms } from "@/lib/speech/noiseGate";

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

class FakeParam {
  value = 0;
  targets: number[] = [];

  cancelScheduledValues() {}

  setTargetAtTime(value: number) {
    this.targets.push(value);
    this.value = value;
  }
}

class FakeNode {
  connect() {}

  disconnect() {}
}

class FakeAnalyser extends FakeNode {
  fftSize = 512;
  smoothingTimeConstant = 0;
  rms = 0;

  getFloatTimeDomainData(samples: Float32Array) {
    samples.fill(this.rms);
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeDestination extends FakeNode {
  stream = new FakeStream();
}

class FakeAudioContext {
  static lastCreated: FakeAudioContext | undefined;
  state = "running";
  currentTime = 0;
  readonly analyser = new FakeAnalyser();
  readonly gain = new FakeGain();
  readonly destination = new FakeDestination();
  closed = false;

  constructor() {
    FakeAudioContext.lastCreated = this;
  }

  createMediaStreamSource() {
    return new FakeNode();
  }

  createAnalyser() {
    return this.analyser;
  }

  createGain() {
    return this.gain;
  }

  createMediaStreamDestination() {
    return this.destination;
  }

  async resume() {}

  async close() {
    this.closed = true;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("noise gate", () => {
  it("maps the configured dBFS thresholds to RMS amplitude", () => {
    expect(noiseGateDbToRms(-50)).toBeCloseTo(0.003162, 5);
    expect(noiseGateDbToRms(-20)).toBeCloseTo(0.1, 5);
  });

  it("opens for loud input, closes after quiet hold time, and cleans up", async () => {
    vi.useFakeTimers();
    const input = new FakeStream();
    const processor = await createNoiseGateStream(
      input as unknown as MediaStream,
      -20,
      FakeAudioContext as unknown as new () => AudioContext,
    );

    expect(processor).not.toBeNull();
    expect(FakeAudioContext.lastCreated).toBeDefined();
    const activeContext = FakeAudioContext.lastCreated!;
    activeContext.analyser.rms = 0.2;
    vi.advanceTimersByTime(80);
    expect(activeContext.gain.gain.targets).toContain(1);

    activeContext.analyser.rms = 0;
    vi.advanceTimersByTime(240);
    expect(activeContext.gain.gain.targets).toContain(0);

    await processor!.stop();
    expect(activeContext.closed).toBe(true);
    expect(activeContext.destination.stream.track.stopped).toBe(true);
  });
});
