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

export type RealtimeTurnDetection = {
  type: "server_vad";
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  create_response?: boolean;
  interrupt_response?: boolean;
} | null;
