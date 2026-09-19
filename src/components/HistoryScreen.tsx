"use client";

import { Heart } from "lucide-react";
import type { CommunicationHistoryEntry } from "@/lib/storage/history";

export function HistoryScreen({
  entries,
  historyEnabled,
  onClear,
}: {
  entries: CommunicationHistoryEntry[];
  historyEnabled: boolean;
  onClear: () => void;
}) {
  // Newest first. Storage keeps insertion order and caps at 50.
  const ordered = [...entries].reverse();

  return (
    <section className="simple-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">On this device</span>
          <h1>History</h1>
          <p>
            {historyEnabled
              ? "Choices made on this device. Never uploaded, never includes audio."
              : "History is turned off in Settings, so nothing new is being recorded."}
          </p>
        </div>
        {ordered.length ? (
          <button className="danger-button" type="button" onClick={onClear}>
            Clear history
          </button>
        ) : null}
      </div>

      {ordered.length ? (
        <div className="history-card">
          {ordered.map((entry) => (
            <div className="history-item" key={entry.id}>
              <span>
                <strong>{entry.selectedLabel ?? "(no label)"}</strong>
                <small>{entry.questionText ? `Asked: ${entry.questionText}` : "Manual board"}</small>
              </span>
              <small>{formatTime(entry.timestamp)}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-illustration" aria-hidden="true">
            <Heart size={44} />
          </span>
          <h2>No phrases yet</h2>
          <p>Choices made on the board will appear here.</p>
        </div>
      )}
    </section>
  );
}

function formatTime(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
