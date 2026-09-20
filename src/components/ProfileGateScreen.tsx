"use client";

import Image from "next/image";
import { useState } from "react";
import type { ChildProfile } from "@/types/profile";
import { MAX_SPEECH_RATE, MIN_SPEECH_RATE } from "@/types/profile";

/**
 * Decorative plants shared by the profile and setup surfaces. Marked `alt=""`
 * because they carry no information a screen reader needs.
 */
function LeafDecor() {
  return (
    <>
      <Image className="profile-leaf profile-leaf-top" src="/brand/evergreen.svg" alt="" width={182} height={300} />
      <Image className="profile-leaf profile-leaf-bottom" src="/brand/split-leaf.svg" alt="" width={298} height={300} />
      <Image className="profile-musacae" src="/brand/musacae.webp" alt="" width={300} height={300} />
      <Image className="profile-clusiacae" src="/brand/clusiacae.webp" alt="" width={180} height={180} />
    </>
  );
}

/**
 * Profile picker shown after the caregiver account/session is entered.
 *
 * The current account stores one profile. This screen is shaped like a
 * profile picker so additional child profiles can be added later.
 */
export function ProfileGateScreen({
  profile,
  onContinue,
  onSetUpNew,
}: {
  profile: ChildProfile;
  onContinue: () => void;
  onSetUpNew: () => void;
}) {
  const name = profile.displayName.trim() || "Your first profile";
  const initial = (profile.displayName.trim()[0] ?? "+").toUpperCase();

  return (
    <main className="center-page profile-page">
      <LeafDecor />
      <section className="selector-card">
        <span className="eyebrow">Your communication board</span>
        <h1>Who is communicating today?</h1>
        <p className="muted-copy">
          Choose a profile to open their board, or create a new one for another child.
        </p>

        <div className="profile-grid">
          <button className="profile-card selected" type="button" onClick={onContinue}>
            <span className="avatar" aria-hidden="true">{initial}</span>
            <span>
              <strong>{name}</strong>
              <small>Open this profile&apos;s board</small>
            </span>
          </button>
          <button className="profile-card add-profile" type="button" onClick={onSetUpNew}>
            <span className="plus" aria-hidden="true">+</span>
            <span>
              <strong>Add a profile</strong>
              <small>Create a board for another child</small>
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}

/** First-run setup, and the form used to create or update the account profile. */
export function SetupScreen({
  initial,
  onFinish,
}: {
  initial: ChildProfile;
  onFinish: (profile: ChildProfile) => void;
}) {
  // Seeded once per mount. The shell unmounts this screen whenever it leaves
  // setup, so "set up a new local profile" always gets a fresh form without
  // needing an effect to resynchronise the draft.
  const [draft, setDraft] = useState<ChildProfile>(initial);

  const patch = (change: Partial<ChildProfile>) =>
    setDraft((current) => ({ ...current, ...change }));

  return (
    <main className="center-page profile-page setup-page">
      <LeafDecor />
      <section className="setup-card">
        <span className="eyebrow">Create a profile</span>
        <h1>Set up this profile</h1>
        <p className="muted-copy">Give this child a name and choose how their board should work.</p>

        <div className="setup-grid">
          <label>
            Preferred name
            <input
              value={draft.displayName}
              maxLength={60}
              placeholder="Child&apos;s name"
              onChange={(event) => patch({ displayName: event.target.value })}
            />
          </label>

          <label>
            Choices per board
            <select
              value={String(draft.maxChoices)}
              onChange={(event) =>
                patch({ maxChoices: Number(event.target.value) as 2 | 4 | 6 | 8 })
              }
            >
              <option value="2">2 choices</option>
              <option value="4">4 choices</option>
              <option value="6">6 choices</option>
              <option value="8">8 choices</option>
            </select>
          </label>

          <div className="setup-field">
            <span className="field-label" id="setup-button-size">Button size</span>
            <div className="choice-row" role="group" aria-labelledby="setup-button-size">
              <button
                type="button"
                className={draft.buttonSize === "large" ? "choice active" : "choice"}
                aria-pressed={draft.buttonSize === "large"}
                onClick={() => patch({ buttonSize: "large" })}
              >
                Large
              </button>
              <button
                type="button"
                className={draft.buttonSize === "standard" ? "choice active" : "choice"}
                aria-pressed={draft.buttonSize === "standard"}
                onClick={() => patch({ buttonSize: "standard" })}
              >
                Standard
              </button>
            </div>
          </div>

          <label className="toggle-row">
            <span>
              <strong>Speak choices aloud</strong>
              <small>Say each word when it is chosen</small>
            </span>
            <input
              type="checkbox"
              checked={draft.speechEnabled}
              onChange={(event) => patch({ speechEnabled: event.target.checked })}
            />
          </label>

          <label>
            Speaking speed
            <input
              type="range"
              min={MIN_SPEECH_RATE}
              max={MAX_SPEECH_RATE}
              step={0.1}
              value={draft.speechRate}
              onChange={(event) => patch({ speechRate: Number(event.target.value) })}
            />
          </label>

        </div>

        <div className="setup-actions">
          <button className="secondary-button" type="button" onClick={() => onFinish(initial)}>
            Use defaults
          </button>
          <button className="primary-button" type="button" onClick={() => onFinish(draft)}>
            Continue to board
          </button>
        </div>
      </section>
    </main>
  );
}
