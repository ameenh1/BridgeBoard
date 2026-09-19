"use client";

import type {
  RealtimeTranscriptionConfig,
  RealtimeTranscriptionState,
  RealtimeTranscript
} from "./types.js";

export type RealtimeTranscriptionError = {
  code:
    | "not_supported"
    | "permission_denied"
    | "connection"
    | "session"
    | "unknown";
  message: string;
};

export type RealtimeTranscriptionClientOptions = RealtimeTranscriptionConfig & {
  sessionEndpoint?: string;
  fetchImpl?: typeof fetch;
  peerConnectionConstructor?: typeof RTCPeerConnection;
  mediaStream?: MediaStream;
  onPartialTranscript?: (transcript: RealtimeTranscript) => void;
  onFinalTranscript?: (transcript: RealtimeTranscript) => void;
  onStateChange?: (state: RealtimeTranscriptionState) => void;
  onError?: (error: RealtimeTranscriptionError) => void;
  onEvent?: (event: Record<string, unknown>) => void;
};

export type RealtimeTranscriptionController = {
  start(): Promise<void>;
  stop(): Promise<void>;
  commitTurn(): void;
  sendEvent(event: Record<string, unknown>): void;
};

type RealtimeEvent = Record<string, unknown> & { type?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function waitForIceGathering(peerConnection: RTCPeerConnection): Promise<void> {
  if (peerConnection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      peerConnection.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }, 3_000);

    const onChange = () => {
      if (peerConnection.iceGatheringState !== "complete") {
        return;
      }

      window.clearTimeout(timeout);
      peerConnection.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };

    peerConnection.addEventListener("icegatheringstatechange", onChange);
  });
}

function errorForConnection(error: unknown): RealtimeTranscriptionError {
  const message = error instanceof Error ? error.message : "Realtime transcription could not connect.";
  return { code: "connection", message };
}

export function createRealtimeTranscriptionController(
  options: RealtimeTranscriptionClientOptions
): RealtimeTranscriptionController {
  let peerConnection: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let mediaStream: MediaStream | null = options.mediaStream ?? null;
  let state: RealtimeTranscriptionState = "idle";
  const partialByItem = new Map<string, string>();

  const setState = (next: RealtimeTranscriptionState) => {
    state = next;
    options.onStateChange?.(next);
  };

  const reportError = (error: RealtimeTranscriptionError) => {
    setState("error");
    options.onError?.(error);
  };

  const sendEvent = (event: Record<string, unknown>) => {
    if (!dataChannel || dataChannel.readyState !== "open") {
      throw new Error("The OpenAI Realtime data channel is not open.");
    }
    dataChannel.send(JSON.stringify(event));
  };

  const handleEvent = (value: unknown) => {
    if (!isRecord(value)) {
      return;
    }

    const event = value as RealtimeEvent;
    options.onEvent?.(event);

    if (event.type === "session.created" || event.type === "session.started") {
      setState("connected");
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.delta") {
      const itemId = stringValue(event.item_id) ?? "unknown";
      const delta = stringValue(event.delta) ?? "";
      const transcript = `${partialByItem.get(itemId) ?? ""}${delta}`;
      partialByItem.set(itemId, transcript);
      options.onPartialTranscript?.({ itemId, transcript });
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      const itemId = stringValue(event.item_id) ?? "unknown";
      const transcript = stringValue(event.transcript)?.trim() ?? "";
      partialByItem.delete(itemId);
      if (transcript) {
        options.onFinalTranscript?.({
          itemId,
          transcript,
          languages: Array.isArray(event.languages)
            ? event.languages.filter((language): language is string => typeof language === "string")
            : undefined
        });
      }
      return;
    }

    if (event.type === "error") {
      const eventError = isRecord(event.error) ? stringValue(event.error.message) : undefined;
      reportError({
        code: "session",
        message: eventError ?? "OpenAI Realtime returned an error."
      });
    }
  };

  const start = async (): Promise<void> => {
    if (state === "connecting" || state === "connected") {
      return;
    }

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const error = {
        code: "not_supported" as const,
        message: "This browser does not support microphone capture. Use typed input or a demo transcript."
      };
      reportError(error);
      throw new Error(error.message);
    }

    const PeerConnection = options.peerConnectionConstructor ?? window.RTCPeerConnection;
    if (!PeerConnection) {
      const error = {
        code: "not_supported" as const,
        message: "This browser does not support WebRTC. Use typed input or a demo transcript."
      };
      reportError(error);
      throw new Error(error.message);
    }

    setState("connecting");

    try {
      mediaStream ??= await navigator.mediaDevices.getUserMedia({ audio: true });
      peerConnection = new PeerConnection();
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection?.connectionState === "connected") {
          setState("connected");
        } else if (peerConnection?.connectionState === "failed") {
          reportError({ code: "connection", message: "The WebRTC connection to OpenAI failed." });
        }
      };

      dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannel.addEventListener("open", () => setState("connected"));
      dataChannel.addEventListener("message", (message) => {
        try {
          handleEvent(JSON.parse(message.data) as unknown);
        } catch {
          reportError({ code: "session", message: "OpenAI sent an invalid Realtime event." });
        }
      });
      dataChannel.addEventListener("error", () => {
        reportError({ code: "connection", message: "The OpenAI Realtime data channel failed." });
      });

      for (const track of mediaStream.getTracks()) {
        peerConnection.addTrack(track, mediaStream);
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitForIceGathering(peerConnection);

      const response = await (options.fetchImpl ?? fetch)(
        options.sessionEndpoint ?? "/api/realtime/session",
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: peerConnection.localDescription?.sdp ?? offer.sdp
        }
      );
      const answerSdp = await response.text();
      if (!response.ok || !answerSdp.trim()) {
        throw new Error(
          `The application Realtime session endpoint failed (${response.status}): ${answerSdp.slice(0, 500)}`
        );
      }

      await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (error) {
      const mapped = error instanceof DOMException && error.name === "NotAllowedError"
        ? {
            code: "permission_denied" as const,
            message: "Microphone access was not allowed. Use typed input or a demo transcript."
          }
        : errorForConnection(error);
      reportError(mapped);
      await stop();
      throw error;
    }
  };

  const stop = async (): Promise<void> => {
    if (!peerConnection && !mediaStream) {
      setState("stopped");
      return;
    }

    setState("stopping");
    dataChannel?.close();
    peerConnection?.close();
    for (const track of mediaStream?.getTracks() ?? []) {
      track.stop();
    }
    dataChannel = null;
    peerConnection = null;
    mediaStream = null;
    partialByItem.clear();
    setState("stopped");
  };

  return {
    start,
    stop,
    commitTurn: () => sendEvent({ type: "input_audio_buffer.commit" }),
    sendEvent
  };
}
