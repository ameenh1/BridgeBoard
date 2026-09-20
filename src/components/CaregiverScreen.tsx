"use client";

import { Camera, MicOff, ShieldCheck, Sliders } from "lucide-react";

/**
 * Caregiver overview.
 *
 * The frontend design had "Customize board" and "Review privacy" buttons with
 * no handlers behind them. Rather than leave two dead controls on a caregiver
 * screen, the privacy card now states the actual behaviour and the vocabulary
 * card says plainly what is and is not possible today.
 */
export function CaregiverScreen({
  onOpenSettings,
  onOpenPhotos,
  photoCount,
}: {
  onOpenSettings: () => void;
  onOpenPhotos: () => void;
  photoCount: number;
}) {
  return (
    <section className="simple-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Caregiver</span>
          <h1>About this board</h1>
          <p>How BridgeBoard behaves, and what it never does.</p>
        </div>
      </div>

      <div className="settings-grid">
        <article className="settings-card">
          <span className="card-icon" aria-hidden="true">
            <MicOff size={28} />
          </span>
          <h2>Listening</h2>
          <p>
            The microphone is off until someone presses Listen, and closes again
            on Stop. Audio is transcribed and never stored. If the microphone is
            blocked or unavailable, the question can still be typed.
          </p>
        </article>

        <article className="settings-card">
          <span className="card-icon" aria-hidden="true">
            <ShieldCheck size={28} />
          </span>
          <h2>What the AI can do</h2>
          <p>
            The AI only proposes words from an approved list. It never writes
            what a tile says or what it speaks — every phrase is authored here.
            If it fails or is unsure, the board falls back to manual rather than
            guessing.
          </p>
        </article>

        <article className="settings-card">
          <span className="card-icon" aria-hidden="true">
            <Camera size={28} />
          </span>
          <h2>Personal photos</h2>
          <p>
            Use a photo of the real thing instead of a drawing — their cup,
            their bag, their dog. Photos stay on this device and are never
            uploaded or sent to the AI.
          </p>
          <button className="secondary-button" type="button" onClick={onOpenPhotos}>
            {photoCount > 0 ? `Manage ${photoCount} photos` : "Add photos"}
          </button>
        </article>

        <article className="settings-card">
          <span className="card-icon" aria-hidden="true">
            <Sliders size={28} />
          </span>
          <h2>Display and speech</h2>
          <p>
            Button size, labels, speaking speed, voice and quiet mode are all
            adjustable and saved to your account when you are signed in.
          </p>
          <button className="secondary-button" type="button" onClick={onOpenSettings}>
            Open settings
          </button>
        </article>
      </div>
    </section>
  );
}
