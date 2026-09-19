"use client";

import { useEffect } from "react";
import { DefaultBoard } from "@/components/DefaultBoard";
import { DEFAULT_PROFILE } from "@/types/profile";
import { speak } from "@/lib/speech/speak";
import { loadSettings } from "@/lib/storage/settings";

/**
 * What the app does when something throws.
 *
 * Next's default here is a bare "Application error: a client-side exception
 * has occurred" page. On a communication device that is the worst possible
 * outcome: the one thing BridgeBoard promises is that communication survives
 * failure of the AI, the network, images, the microphone, credentials and
 * storage. A crash is just one more failure, so it gets the same answer as
 * all the others — fall back to the manual board.
 *
 * Deliberately minimal in what it depends on. The crash may have come from
 * anywhere, so this reads no controller, starts no stream, and touches no
 * network. Settings are read behind a try because storage is one of the
 * things that is allowed to be broken; on failure it uses defaults rather
 * than giving up.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Server-side digest only in production; the message stays out of the UI.
    console.error("[bridgeboard] recovered from a crash", error.digest ?? error.message);
  }, [error]);

  let profile = DEFAULT_PROFILE;
  try {
    profile = loadSettings();
  } catch {
    // Defaults are fine. A board with the wrong button size still talks.
  }

  return (
    <main className="app-page">
      <header className="app-nav">
        <span className="brand-button">
          <span className="brand-mark" aria-hidden="true">B</span>
          BridgeBoard
        </span>
        <div className="nav-right">
          <p className="recovery-note" role="status">
            Something went wrong. Your board still works.
          </p>
          <button className="secondary-button" type="button" onClick={retry}>
            Try again
          </button>
        </div>
      </header>

      <div className="app-content">
        <DefaultBoard
          profile={profile}
          onSpeak={(phrase) => speak(phrase, profile)}
          // History writes are skipped here: storage may be what failed, and
          // recording is never worth risking a second crash over.
          onRecord={() => undefined}
        />
      </div>
    </main>
  );
}
