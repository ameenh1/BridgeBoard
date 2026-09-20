"use client";

import type { ChildProfile } from "@/types/profile";
import { MAX_SPEECH_RATE, MIN_SPEECH_RATE } from "@/types/profile";

let currentAudio: HTMLAudioElement | null = null;
let speechRequest = 0;

const RETRYABLE_SPEECH_STATUSES = new Set([408, 429, 500, 502, 504]);

async function fetchSpeechAudio(text: string): Promise<Blob> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        if (attempt === 0 && RETRYABLE_SPEECH_STATUSES.has(response.status)) continue;
        throw new Error(`speech_${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
      if (error instanceof Error && error.message.startsWith("speech_")) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("speech_unavailable");
}

/** Uses ElevenLabs online and falls back to the device voice if unavailable. */
export async function speakNatural(phrase: string, profile: ChildProfile): Promise<void> {
  const text = phrase.trim();
  if (!text || !profile.speechEnabled || profile.quietMode) return;

  cancelSpeech();
  const request = ++speechRequest;
  try {
    const blob = await fetchSpeechAudio(text);
    if (request !== speechRequest) return;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      URL.revokeObjectURL(url);
    };
    await audio.play();
  } catch {
    if (request === speechRequest) speak(text, profile);
  }
}

/**
 * Speaks app-owned text.
 *
 * Every selection string that reaches here comes from a visible catalog label,
 * a built sentence, or a support action. No model output is ever spoken.
 *
 * Total by design: a device with no speech synthesis, a blocked voice list or
 * a throwing `speak()` must not stop the board from working. The tile has
 * already shown its word; audio is the bonus, not the message.
 */
export function speak(phrase: string, profile: ChildProfile): void {
  const text = phrase.trim();
  if (!text) return;
  if (!profile.speechEnabled || profile.quietMode) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = clampRate(profile.speechRate);

    const voice = resolveVoice(synth, profile.voiceURI);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    synth.speak(utterance);
  } catch {
    // A silent tile is still a readable tile.
  }
}

/** Stops anything mid-utterance, e.g. when Quiet Mode is switched on. */
export function cancelSpeech(): void {
  speechRequest += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Nothing to do.
  }
}

export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0.9;
  return Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate));
}

/**
 * The stored voice may belong to a different device or have been uninstalled,
 * and Chrome returns an empty list until voices load. Falling back to the
 * platform default is always better than refusing to speak.
 */
function resolveVoice(
  synth: SpeechSynthesis,
  voiceURI: string | undefined,
): SpeechSynthesisVoice | null {
  let voices: SpeechSynthesisVoice[] = [];
  try {
    voices = synth.getVoices();
  } catch {
    return null;
  }
  if (voices.length === 0) return null;

  if (voiceURI) {
    const chosen = voices.find((voice) => voice.voiceURI === voiceURI);
    if (chosen) return chosen;
  }
  return voices.find((voice) => voice.default && voice.lang.startsWith("en"))
    ?? voices.find((voice) => voice.lang.startsWith("en"))
    ?? null;
}

/** Voices for the settings picker. Empty until the browser has loaded them. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  try {
    return window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith("en"));
  } catch {
    return [];
  }
}
