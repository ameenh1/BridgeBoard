import "server-only";
import type { RealtimeTurnDetection } from "./types";

type Options = {
  sdp: string;
  keywords?: readonly string[];
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  turnDetection?: RealtimeTurnDetection;
};

const DEFAULT_TURN_DETECTION: Exclude<RealtimeTurnDetection, null> = {
  type: "server_vad",
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 500,
  create_response: false,
  interrupt_response: false,
};

export async function createOpenAIRealtimeSession(options: Options): Promise<string> {
  if (!options.sdp.trim()) throw new Error("missing_sdp");
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("realtime_unconfigured");

  const form = new FormData();
  form.set("sdp", options.sdp);
  form.set("session", JSON.stringify({
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1-mini",
    audio: {
      input: {
        transcription: {
          model: process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ?? "gpt-live-transcribe",
          languages: ["en"],
          delay: "low",
          ...(options.keywords?.length ? { keywords: [...options.keywords] } : {}),
          prompt: "A caregiver is speaking short AAC choice questions and support phrases.",
        },
        turn_detection:
          options.turnDetection === undefined ? DEFAULT_TURN_DETECTION : options.turnDetection,
      },
    },
  }));

  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
    : AbortSignal.timeout(15_000);
  const response = await (options.fetchImpl ?? fetch)(
    options.endpoint ?? "https://api.openai.com/v1/realtime/calls",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    },
  );
  const answer = await response.text();
  if (!response.ok) throw new Error(`realtime_upstream_${response.status}`);
  if (!answer.trim()) throw new Error("realtime_empty_answer");
  return answer;
}
