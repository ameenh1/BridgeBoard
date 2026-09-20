"use client";

import { Volume2, VolumeX } from "lucide-react";

/**
 * Shows the last thing the board said.
 *
 * The device speaks on someone's behalf, so what it said has to be visible as
 * well as audible. Audio alone fails in most of the situations this app is
 * actually used in: a noisy classroom, a muted tablet, a hard-of-hearing
 * partner, and — by design — Quiet Mode, where nothing is spoken at all and a
 * tap would otherwise produce no confirmation whatsoever.
 *
 * It is also the repair mechanism. When a partner mishears, pointing at the
 * text is faster and less frustrating than saying it again.
 *
 * `aria-live="polite"` rather than `assertive`: a screen reader user has
 * already heard the utterance, so this should queue behind whatever they are
 * reading rather than interrupt it.
 */
export function SpokenBar({
  phrase,
  muted,
}: {
  phrase: string;
  /** Speech is off or Quiet Mode is on, so this text is the only output. */
  muted: boolean;
}) {
  return (
    <div className={`spoken-bar${phrase ? " has-phrase" : ""}`} aria-live="polite">
      {phrase ? (
        <>
          <span className="spoken-icon" aria-hidden="true">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </span>
          <span className="spoken-label">{muted ? "Showing" : "Said"}</span>
          <p className="spoken-phrase">{phrase}</p>
        </>
      ) : null}
    </div>
  );
}
