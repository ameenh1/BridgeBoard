"use client";

import { useEffect } from "react";

/**
 * Last resort: a failure in the root layout itself, which replaces the whole
 * document and so cannot reuse any of the app's own chrome or fonts.
 *
 * error.tsx handles everything below the layout and falls back to a real
 * working board. Getting here means even that could not render, so this stays
 * deliberately dumb — inline styles, no imports beyond React, nothing that
 * could itself throw. It says plainly that the board is unavailable rather
 * than pretending otherwise, because a communication device that lies about
 * being ready is worse than one that admits it is not.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[bridgeboard] root layout failed", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b9dfd9",
          color: "#000",
          fontFamily: "Arial, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>BridgeBoard could not start</h1>
          <p style={{ fontSize: 17, lineHeight: 1.5, margin: "0 0 24px" }}>
            Reload to try again. If it keeps happening, the printed board is
            still the fastest way to keep talking.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              background: "#f0656b",
              border: 0,
              borderRadius: 9,
              color: "#fff",
              cursor: "pointer",
              fontSize: 17,
              fontWeight: 700,
              minHeight: 48,
              padding: "0 28px",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
