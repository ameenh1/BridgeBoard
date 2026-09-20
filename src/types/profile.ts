/**
 * Caregiver-configurable presentation settings.
 *
 * Deliberately small: no demographic fields, no medical fields, nothing that
 * would make this look like a clinical record.
 */
export type ChildProfile = {
  id: string;

  /** What the caregiver calls this person. Shown on the device, sent nowhere. */
  displayName: string;

  /** Upper bound on how many choices a board may show. */
  maxChoices: 2 | 4 | 6 | 8;

  visuals: "photos_first" | "mixed" | "icons_first";

  speechEnabled: boolean;
  quietMode: boolean;
  textLabelsEnabled: boolean;

  /** Relative microphone threshold used by the AI board. Null leaves capture un-gated. */
  noiseGateDb: NoiseGateDb;

  /** Presentation only — never sent to the server. */
  buttonSize: "standard" | "large";
  /** SpeechSynthesis rate. Clamped to a range that stays intelligible. */
  speechRate: number;
  /** A voice from `speechSynthesis.getVoices()`. Absent means the device default. */
  voiceURI?: string;
};

export const MIN_SPEECH_RATE = 0.6;
export const MAX_SPEECH_RATE = 1.3;

/** Relative microphone levels for the AI board's local noise gate. */
export type NoiseGateDb = null | -50 | -40 | -30 | -20;

export const NOISE_GATE_LEVELS: readonly {
  value: NoiseGateDb;
  label: string;
  description: string;
}[] = [
  { value: null, label: "Off", description: "No voice threshold" },
  { value: -50, label: "−50 dBFS", description: "Gentle" },
  { value: -40, label: "−40 dBFS", description: "Medium" },
  { value: -30, label: "−30 dBFS", description: "Strong" },
  { value: -20, label: "−20 dBFS", description: "Strongest" },
];

/** Used whenever no profile is stored, or stored settings fail to parse. */
export const DEFAULT_PROFILE: ChildProfile = {
  id: "default-profile",
  displayName: "",
  maxChoices: 8,
  visuals: "photos_first",
  speechEnabled: true,
  quietMode: false,
  textLabelsEnabled: true,
  noiseGateDb: null,
  buttonSize: "large",
  speechRate: 0.9,
};

/** The subset the server is allowed to see. Everything else is presentation. */
export type ServerProfileFields = Pick<ChildProfile, "id" | "maxChoices" | "visuals">;

export function serverProfileFields(profile: ChildProfile): ServerProfileFields {
  return { id: profile.id, maxChoices: profile.maxChoices, visuals: profile.visuals };
}
