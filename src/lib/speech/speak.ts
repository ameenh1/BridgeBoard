"use client";

import type { ChildProfile } from "@/types/profile";
import { MAX_SPEECH_RATE, MIN_SPEECH_RATE } from "@/types/profile";

let currentAudio: HTMLAudioElement | null = null;
let speechRequest = 0;

/** Uses ElevenLabs online and falls back to the device voice if unavailable. */
export async function speakNatural(phrase: string, profile: ChildProfile): Promise<void> {
  const text = phrase.trim();
  if (!text || !profile.speechEnabled || profile.quietMode) return;

  cancelSpeech();
  const request = ++speechRequest;
  try {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(`speech_${response.status}`);
    const blob = await response.blob();
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
 * Speaks an authored phrase.
 *
 * Every string that reaches here comes from the approved vocabulary or from a
 * support action's authored phrase. No model output is ever spoken.
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
