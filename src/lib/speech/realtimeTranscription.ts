"use client";

import type { RealtimeTranscript, RealtimeTranscriptionState } from "./types";

export type RealtimeTranscriptionError = {
  code: "not_supported" | "permission_denied" | "connection" | "session";
  message: string;
};

export type RealtimeTranscriptionOptions = {
  sessionEndpoint?: string;
  fetchImpl?: typeof fetch;
  peerConnectionConstructor?: typeof RTCPeerConnection;
  mediaStream?: MediaStream;
  connectionTimeoutMs?: number;
  onPartialTranscript?: (transcript: RealtimeTranscript) => void;
  onFinalTranscript?: (transcript: RealtimeTranscript) => void;
  onStateChange?: (state: RealtimeTranscriptionState) => void;
  onError?: (error: RealtimeTranscriptionError) => void;
};

export type RealtimeTranscriptionController = {
  start(): Promise<void>;
  stop(): Promise<void>;
  commitTurn(): void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createRealtimeTranscriptionController(
  options: RealtimeTranscriptionOptions = {},
): RealtimeTranscriptionController {
  let peer: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let stream: MediaStream | null = options.mediaStream ?? null;
  let state: RealtimeTranscriptionState = "idle";
  const partials = new Map<string, string>();

  const setState = (next: RealtimeTranscriptionState) => {
    state = next;
    options.onStateChange?.(next);
  };
  const report = (error: RealtimeTranscriptionError) => {
    setState("error");
    options.onError?.(error);
  };
  const cleanup = async (nextState?: RealtimeTranscriptionState) => {
    channel?.close();
    peer?.close();
    for (const track of stream?.getTracks() ?? []) track.stop();
    channel = null;
    peer = null;
    stream = null;
    partials.clear();
    if (nextState) setState(nextState);
  };
  const handleEvent = (raw: unknown) => {
    if (!isRecord(raw) || typeof raw.type !== "string") return;
    if (raw.type === "conversation.item.input_audio_transcription.delta") {
      const itemId = typeof raw.item_id === "string" ? raw.item_id : "unknown";
      const transcript = `${partials.get(itemId) ?? ""}${typeof raw.delta === "string" ? raw.delta : ""}`;
      partials.set(itemId, transcript);
      options.onPartialTranscript?.({ itemId, transcript });
    } else if (raw.type === "conversation.item.input_audio_transcription.completed") {
      const itemId = typeof raw.item_id === "string" ? raw.item_id : "unknown";
      const transcript = typeof raw.transcript === "string" ? raw.transcript.trim() : "";
      partials.delete(itemId);
      if (transcript) options.onFinalTranscript?.({ itemId, transcript });
    } else if (raw.type === "error") {
      const details = isRecord(raw.error) && typeof raw.error.message === "string"
        ? raw.error.message
        : "Realtime transcription failed.";
      report({ code: "session", message: details });
    }
  };

  return {
    async start() {
      if (state === "connecting" || state === "connected") return;
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        const error = { code: "not_supported" as const, message: "Microphone capture is not supported." };
        report(error);
        throw new Error(error.message);
      }
      const Peer = options.peerConnectionConstructor ?? window.RTCPeerConnection;
      if (!Peer) {
        const error = { code: "not_supported" as const, message: "WebRTC is not supported." };
        report(error);
        throw new Error(error.message);
      }

      setState("connecting");
      try {
        stream ??= await navigator.mediaDevices.getUserMedia({ audio: true });
        peer = new Peer();
        channel = peer.createDataChannel("oai-events");
        channel.addEventListener("open", () => setState("connected"));
        channel.addEventListener("message", (message) => {
          try {
            handleEvent(JSON.parse(String(message.data)) as unknown);
          } catch {
            report({ code: "session", message: "Realtime returned an invalid event." });
          }
        });
        channel.addEventListener("error", () => {
          report({ code: "connection", message: "Realtime data channel failed." });
        });
        peer.onconnectionstatechange = () => {
          if (peer?.connectionState === "connected") setState("connected");
          if (peer?.connectionState === "failed") {
            report({ code: "connection", message: "Realtime connection failed." });
          }
        };
        for (const track of stream.getTracks()) peer.addTrack(track, stream);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        const controller = new AbortController();
        const timeout = window.setTimeout(
          () => controller.abort(),
          options.connectionTimeoutMs ?? 15_000,
        );
        const response = await (options.fetchImpl ?? fetch)(
          options.sessionEndpoint ?? "/api/realtime/session",
          {
            method: "POST",
            headers: { "Content-Type": "application/sdp" },
            body: peer.localDescription?.sdp ?? offer.sdp,
            signal: controller.signal,
          },
        ).finally(() => window.clearTimeout(timeout));
        const answer = await response.text();
        if (!response.ok || !answer.trim()) throw new Error("Realtime session endpoint failed.");
        await peer.setRemoteDescription({ type: "answer", sdp: answer });
      } catch (error) {
        const denied = error instanceof DOMException && error.name === "NotAllowedError";
        await cleanup();
        const mapped = denied
          ? { code: "permission_denied" as const, message: "Microphone access was not allowed." }
          : { code: "connection" as const, message: "Realtime transcription could not connect." };
        report(mapped);
        throw error;
      }
    },
    async stop() {
      if (state !== "error") setState("stopping");
      await cleanup(state === "error" ? undefined : "stopped");
    },
    commitTurn() {
      if (!channel || channel.readyState !== "open") {
        throw new Error("Realtime data channel is not open.");
      }
      channel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    },
  };
}
