import { createHash } from "node:crypto";
import { z } from "zod";

export const runtime = "nodejs";

const SpeechRequestSchema = z.object({
  text: z.string().trim().min(1).max(240),
});

const DEFAULT_ELEVENLABS_MODEL = "eleven_flash_v2_5";
const FIXED_VOICE_SETTINGS = {
  stability: 1,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
  speed: 1,
} as const;

function createSpeechSeed(text: string, voiceId: string, modelId: string): number {
  return createHash("sha256")
    .update(`${voiceId}\0${modelId}\0${text}`)
    .digest()
    .readUInt32BE(0);
}

/** Proxy short AAC phrases to ElevenLabs without exposing its API key. */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey || !voiceId) {
    return Response.json({ error: "speech_unconfigured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsed = SpeechRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const modelId = process.env.ELEVENLABS_MODEL?.trim() || DEFAULT_ELEVENLABS_MODEL;

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
        body: JSON.stringify({
          text: parsed.data.text,
          model_id: modelId,
          voice_settings: FIXED_VOICE_SETTINGS,
          seed: createSpeechSeed(parsed.data.text, voiceId, modelId),
        }),
        signal: request.signal,
      },
    );

    if (!upstream.ok || !upstream.body) {
      console.error("[speech] ElevenLabs request failed", upstream.status);
      return Response.json({ error: "speech_unavailable" }, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    console.error("[speech] ElevenLabs request failed", error);
    return Response.json({ error: "speech_unavailable" }, { status: 502 });
  }
}
