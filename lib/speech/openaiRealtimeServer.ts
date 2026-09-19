// Server-only OpenAI Realtime session creation. Never import this module into browser code.
import "../serverEnv.js";
import type {
  RealtimeTranscriptionConfig,
  RealtimeTranscriptionTurnDetection
} from "./types.js";

export type OpenAIRealtimeTranscriptionSessionOptions = RealtimeTranscriptionConfig & {
  sdp: string;
  realtimeModel?: string;
  apiKey?: string;
  safetyIdentifier?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_TURN_DETECTION: Exclude<RealtimeTranscriptionTurnDetection, null> = {
  type: "server_vad",
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 500,
  create_response: false,
  interrupt_response: false
};

function buildTranscriptionConfig(options: OpenAIRealtimeTranscriptionSessionOptions) {
  return {
    model: options.model ?? process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ?? "gpt-live-transcribe",
    ...(options.prompt ? { prompt: options.prompt } : {}),
    ...(options.keywords && options.keywords.length > 0
      ? { keywords: [...options.keywords] }
      : {}),
    ...(options.languages && options.languages.length > 0
      ? { languages: [...options.languages] }
      : {}),
    ...(options.delay ? { delay: options.delay } : {})
  };
}

export async function createOpenAIRealtimeTranscriptionSession(
  options: OpenAIRealtimeTranscriptionSessionOptions
): Promise<string> {
  if (!options.sdp.trim()) {
    throw new Error("An SDP offer is required to create an OpenAI Realtime session.");
  }

  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for the OpenAI Realtime session endpoint.");
  }

  const form = new FormData();
  form.set("sdp", options.sdp);
  form.set(
    "session",
    JSON.stringify({
      type: "realtime",
      model:
        options.realtimeModel ??
        process.env.OPENAI_REALTIME_MODEL ??
        "gpt-realtime-2.1-mini",
      audio: {
        input: {
          transcription: buildTranscriptionConfig(options),
          turn_detection:
            options.turnDetection === undefined
              ? DEFAULT_TURN_DETECTION
              : options.turnDetection
        }
      }
    })
  );

  const headers = new Headers({ Authorization: `Bearer ${apiKey}` });
  if (options.safetyIdentifier) {
    headers.set("OpenAI-Safety-Identifier", options.safetyIdentifier);
  }

  const response = await (options.fetchImpl ?? fetch)(
    options.endpoint ?? "https://api.openai.com/v1/realtime/calls",
    {
      method: "POST",
      headers,
      body: form
    }
  );
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `OpenAI Realtime session creation failed (${response.status}): ${responseText.slice(0, 1_000)}`
    );
  }

  if (!responseText.trim()) {
    throw new Error("OpenAI Realtime returned an empty SDP answer.");
  }

  return responseText;
}
