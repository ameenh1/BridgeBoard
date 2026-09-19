"use client";

import { useEffect, useState } from "react";
import type { ChildProfile } from "@/types/profile";
import { MAX_SPEECH_RATE, MIN_SPEECH_RATE } from "@/types/profile";
import { listVoices } from "@/lib/speech/speak";

/**
 * Every control here does something. The frontend design carried a dead
 * "Quiet mode" checkbox and a dead "Reset profile" button; a control that
 * looks functional and is not is worse than no control on a device someone
 * depends on.
 */
export function SettingsScreen({
  profile,
  onChange,
  onResetProfile,
}: {
  profile: ChildProfile;
  onChange: (patch: Partial<ChildProfile>) => void;
  onResetProfile: () => void;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Chrome returns an empty voice list until they finish loading, then fires
  // voiceschanged. Without this the picker is permanently empty on first load.
  useEffect(() => {
    const update = () => setVoices(listVoices());
    update();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);

  return (
    <section className="simple-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Caregiver</span>
          <h1>Settings</h1>
          <p>Saved to your account when you are signed in.</p>
        </div>
      </div>

      <div className="settings-list">
        <label>
          <span>
            <strong>Preferred name</strong>
            <small>Shown on your communication board</small>
          </span>
          <input
            value={profile.displayName}
            maxLength={60}
            onChange={(event) => onChange({ displayName: event.target.value })}
          />
        </label>

        <label>
          <span>
            <strong>Choices per board</strong>
            <small>Upper limit on AI-suggested choices</small>
          </span>
          <select
            value={String(profile.maxChoices)}
            onChange={(event) => onChange({ maxChoices: Number(event.target.value) as 2 | 4 | 6 })}
          >
            <option value="2">2</option>
            <option value="4">4</option>
            <option value="6">6</option>
          </select>
        </label>

        <label>
          <span>
            <strong>Pictures</strong>
            <small>
              Photos first finds a picture for every choice. Mixed keeps the
              bundled artwork and only looks up new words. Icons only never
              fetches anything.
            </small>
          </span>
          <select
            value={profile.visuals}
            onChange={(event) =>
              onChange({ visuals: event.target.value as ChildProfile["visuals"] })
            }
          >
            <option value="photos_first">Photos first</option>
            <option value="mixed">Mixed</option>
            <option value="icons_first">Icons only</option>
          </select>
        </label>

        <label>
          <span>
            <strong>Button size</strong>
          </span>
          <select
            value={profile.buttonSize}
            onChange={(event) =>
              onChange({ buttonSize: event.target.value as ChildProfile["buttonSize"] })
            }
          >
            <option value="large">Large</option>
            <option value="standard">Standard</option>
          </select>
        </label>

        <label className="toggle-row">
          <span>
            <strong>Show word labels</strong>
            <small>Turn off for pictures only</small>
          </span>
          <input
            type="checkbox"
            checked={profile.textLabelsEnabled}
            onChange={(event) => onChange({ textLabelsEnabled: event.target.checked })}
          />
        </label>

        <label className="toggle-row">
          <span>
            <strong>Speak choices aloud</strong>
          </span>
          <input
            type="checkbox"
            checked={profile.speechEnabled}
            onChange={(event) => onChange({ speechEnabled: event.target.checked })}
          />
        </label>

        <label className="toggle-row">
          <span>
            <strong>Quiet mode</strong>
            <small>Silences all speech without changing the setting above</small>
          </span>
          <input
            type="checkbox"
            checked={profile.quietMode}
            onChange={(event) => onChange({ quietMode: event.target.checked })}
          />
        </label>

        <label>
          <span>
            <strong>Speaking speed</strong>
            <small>{profile.speechRate.toFixed(1)}&times;</small>
          </span>
          <input
            type="range"
            min={MIN_SPEECH_RATE}
            max={MAX_SPEECH_RATE}
            step={0.1}
            value={profile.speechRate}
            onChange={(event) => onChange({ speechRate: Number(event.target.value) })}
          />
        </label>

        <label>
          <span>
            <strong>Voice</strong>
            <small>{voices.length ? "From this device" : "Loading device voices…"}</small>
          </span>
          <select
            value={profile.voiceURI ?? ""}
            onChange={(event) => onChange({ voiceURI: event.target.value || undefined })}
          >
            <option value="">Device default</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle-row">
          <span>
              <strong>Keep history</strong>
            <small>Saved to your account when you are signed in</small>
          </span>
          <input
            type="checkbox"
            checked={profile.historyEnabled}
            onChange={(event) => onChange({ historyEnabled: event.target.checked })}
          />
        </label>
      </div>

      <button className="danger-button" type="button" onClick={onResetProfile}>
        Reset this profile
      </button>
    </section>
  );
}
