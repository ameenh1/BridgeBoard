import type { NoiseGateDb } from "@/types/profile";

export type ActiveNoiseGateDb = Exclude<NoiseGateDb, null>;

export type NoiseGateStream = {
  stream: MediaStream;
  stop(): Promise<void>;
};

type AudioContextConstructor = new () => AudioContext;

const OPEN_HOLD_MS = 40;
const CLOSE_HOLD_MS = 180;
const CLOSE_HYSTERESIS_DB = 3;
const POLL_INTERVAL_MS = 40;
const ATTACK_SECONDS = 0.02;
const RELEASE_SECONDS = 0.12;

/** Converts a relative dBFS threshold into the RMS amplitude Web Audio exposes. */
export function noiseGateDbToRms(value: ActiveNoiseGateDb): number {
  return 10 ** (value / 20);
}

function browserAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null;
}

function setGain(gain: GainNode, value: number, context: AudioContext, duration: number): void {
  const parameter = gain.gain;
  if (typeof parameter.cancelScheduledValues === "function") {
    parameter.cancelScheduledValues(context.currentTime);
  }
  if (typeof parameter.setTargetAtTime === "function") {
    parameter.setTargetAtTime(value, context.currentTime, duration);
  } else {
    parameter.value = value;
  }
}

/**
 * Builds a local, non-monitoring audio graph for the realtime microphone.
 *
 * The source is never connected to `context.destination`, so the microphone is
 * not played back through the device speakers. The returned destination stream
 * is safe to hand to WebRTC as the outbound track.
 */
export async function createNoiseGateStream(
  input: MediaStream,
  thresholdDb: ActiveNoiseGateDb,
  audioContextConstructor?: AudioContextConstructor,
): Promise<NoiseGateStream | null> {
  const Constructor = audioContextConstructor ?? browserAudioContextConstructor();
  if (!Constructor || input.getAudioTracks().length === 0) return null;

  let createdContext: AudioContext | null = null;
  try {
    createdContext = new Constructor();
    const context = createdContext;
    const source = context.createMediaStreamSource(input);
    const analyser = context.createAnalyser();
    const gate = context.createGain();
    const destination = context.createMediaStreamDestination();

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.12;
    gate.gain.value = 0;
    source.connect(analyser);
    source.connect(gate);
    gate.connect(destination);

    if (context.state === "suspended") await context.resume();

    const samples = new Float32Array(analyser.fftSize);
    const openThreshold = noiseGateDbToRms(thresholdDb);
    const closeThreshold = openThreshold * 10 ** (-CLOSE_HYSTERESIS_DB / 20);
    let gateOpen = false;
    let aboveSince: number | null = null;
    let belowSince: number | null = null;
    let stopped = false;

    const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());
    const timer = setInterval(() => {
      if (stopped) return;
      analyser.getFloatTimeDomainData(samples);
      let sumSquares = 0;
      for (const sample of samples) sumSquares += sample * sample;
      const rms = Math.sqrt(sumSquares / samples.length);
      const currentTime = now();

      if (rms >= openThreshold) {
        aboveSince ??= currentTime;
        belowSince = null;
        if (!gateOpen && currentTime - aboveSince >= OPEN_HOLD_MS) {
          gateOpen = true;
          setGain(gate, 1, context, ATTACK_SECONDS);
        }
      } else if (rms < closeThreshold) {
        belowSince ??= currentTime;
        aboveSince = null;
        if (gateOpen && currentTime - belowSince >= CLOSE_HOLD_MS) {
          gateOpen = false;
          setGain(gate, 0, context, RELEASE_SECONDS);
        }
      } else {
        // Keep the current state inside the hysteresis band.
        aboveSince = null;
        belowSince = null;
      }
    }, POLL_INTERVAL_MS);

    return {
      stream: destination.stream,
      async stop() {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        source.disconnect();
        analyser.disconnect();
        gate.disconnect();
        for (const track of destination.stream.getTracks()) track.stop();
        try {
          await context.close();
        } catch {
          // The graph may already be closed by the browser during navigation.
        }
      },
    };
  } catch {
    try {
      await createdContext?.close();
    } catch {
      // A partially-created context is best-effort cleanup only.
    }
    return null;
  }
}
