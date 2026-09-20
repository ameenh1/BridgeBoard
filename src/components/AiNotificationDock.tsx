import { WifiOff } from "lucide-react";
import type { BoardSessionState } from "@/lib/board/boardSessionController";
import { AlertCircle } from "./icons";

export function AiNotificationDock({
  online,
  microphoneNotice,
  boardError,
}: {
  online: boolean;
  microphoneNotice?: string;
  boardError?: BoardSessionState["lastError"];
}) {
  const hasNotifications = Boolean(!online || boardError || microphoneNotice);
  if (!hasNotifications) return null;

  return (
    <aside className="ai-notification-dock" aria-label="AI AAC notifications">
      <div className="ai-notification-stack">
        {!online ? (
          <p className="ai-toast ai-toast--status" role="status">
            <WifiOff aria-hidden="true" size={18} />
            <span>
              No connection. The AI needs a network — <strong>Default AAC</strong>{" "}
              still works and still speaks.
            </span>
          </p>
        ) : null}

        {boardError ? (
          <p className="ai-toast ai-toast--error" role="alert">
            <AlertCircle aria-hidden="true" size={18} />
            <span>
              {boardError === "classification"
                ? "That message could not be organized. Your previous choices are still available."
                : "Some pictures could not load. Every choice still works."}
            </span>
          </p>
        ) : null}

        {microphoneNotice ? (
          <p className="ai-toast ai-toast--status" role="status">
            <AlertCircle aria-hidden="true" size={18} />
            <span>{microphoneNotice}</span>
          </p>
        ) : null}
      </div>
    </aside>
  );
}
