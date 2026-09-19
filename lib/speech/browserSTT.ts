"use client";

export type SpeechErrorCode =
  | "not_supported"
  | "permission_denied"
  | "no_speech"
  | "network"
  | "aborted"
  | "unknown";

export type BrowserSpeechOptions = {
  lang?: string;
  onTranscript: (transcript: string) => void;
  onError?: (error: { code: SpeechErrorCode; message: string }) => void;
  onEnd?: () => void;
};

export type BrowserSpeechController = {
  start(): void;
  stop(): void;
  abort(): void;
};

function mapSpeechError(error: string): { code: SpeechErrorCode; message: string } {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return { code: "permission_denied", message: "Microphone access was not allowed. Use typed input or a demo transcript." };
    case "no-speech":
      return { code: "no_speech", message: "No speech was detected. Use typed input or try again." };
    case "network":
      return { code: "network", message: "Browser speech recognition needs a network connection. Use typed input or a demo transcript." };
    case "aborted":
      return { code: "aborted", message: "Speech recognition was stopped." };
    default:
      return { code: "unknown", message: "Speech recognition failed. Use typed input or a demo transcript." };
  }
}

export function createBrowserSpeechRecognizer(
  options: BrowserSpeechOptions
): BrowserSpeechController | null {
  if (typeof window === "undefined") {
    return null;
  }

  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Recognition) {
    options.onError?.({
      code: "not_supported",
      message: "This browser does not support speech recognition. Use typed input or a demo transcript."
    });
    return null;
  }

  const recognition = new Recognition();
  recognition.lang = options.lang ?? "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcripts: string[] = [];
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal && result[0]?.transcript) {
        transcripts.push(result[0].transcript.trim());
      }
    }

    const transcript = transcripts.join(" ").trim();
    if (transcript) {
      options.onTranscript(transcript);
    }
  };

  recognition.onerror = (event) => {
    options.onError?.(mapSpeechError(event.error));
  };
  recognition.onend = () => options.onEnd?.();

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort()
  };
}
