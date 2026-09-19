export type RealtimeTranscriptionDelay =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type RealtimeTranscriptionTurnDetection = {
  type: "server_vad";
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  create_response?: boolean;
  interrupt_response?: boolean;
} | null;

export type RealtimeTranscriptionConfig = {
  model?: string;
  prompt?: string;
  keywords?: readonly string[];
  languages?: readonly string[];
  delay?: RealtimeTranscriptionDelay;
  turnDetection?: RealtimeTranscriptionTurnDetection;
};

export type RealtimeTranscriptionState =
  | "idle"
  | "connecting"
  | "connected"
  | "stopping"
  | "stopped"
  | "error";

export type RealtimeTranscript = {
  itemId: string;
  transcript: string;
  languages?: string[];
};
