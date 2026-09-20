"use client";

import {
  Mic, MicOff, RotateCcw, Send, Volume2, WifiOff,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import type { BoardSessionState } from "@/lib/board/boardSessionController";
import type { RealtimeTranscriptionState } from "@/lib/speech/types";
import type { RenderableChoice } from "@/types/board";
import { NOISE_GATE_LEVELS, type ChildProfile, type NoiseGateDb } from "@/types/profile";
import { ChoiceVisual, VisualAttribution } from "./ChoiceVisual";
import { AlertCircle, ChoiceIcon } from "./icons";
import { isPersistentAiChoice } from "@/lib/board/persistentChoices";

export function AiBoard({
  session,
  profile,
  realtimeState,
  online,
  microphoneError,
  microphoneNotice,
  onSubmitQuestion,
  onResetChoices,
  onToggleListening,
  onNoiseGateChange,
  onChoose,
}: {
  session: BoardSessionState;
  profile: ChildProfile;
  realtimeState: RealtimeTranscriptionState;
  /** False means the AI side cannot work, whatever else is configured. */
  online: boolean;
  microphoneError?: string;
  microphoneNotice?: string;
  onSubmitQuestion: (questionText: string) => void;
  onResetChoices: () => void;
  onToggleListening: () => void;
  onNoiseGateChange: (value: NoiseGateDb) => void;
  onChoose: (choice: RenderableChoice) => void;
}) {
  const [question, setQuestion] = useState("");
  const board = session.board;
  const listening = realtimeState === "connecting" || realtimeState === "connected";
  const noiseGateIndex = Math.max(
    0,
    NOISE_GATE_LEVELS.findIndex((level) => level.value === profile.noiseGateDb),
  );
  const noiseGateLevel = NOISE_GATE_LEVELS[noiseGateIndex] ?? NOISE_GATE_LEVELS[0];
  // The gallery holds up to eight AI suggestions. Quick answers remain in a
  // separate row and never count against that gallery.
  const aiChoices = (board?.choices.filter((choice) => !isPersistentAiChoice(choice)) ?? []).slice(0, 8);
  const quickChoices = board?.choices.filter(isPersistentAiChoice) ?? [];

  function renderChoice(choice: RenderableChoice) {
    const selected = session.selectedChoiceKey === choice.choiceKey;
    return (
      <button
        key={choice.choiceKey}
        type="button"
        className={`choice-card choice-card--dense${isPersistentAiChoice(choice) ? " choice-card--quick is-persistent" : ""}${selected ? " is-selected" : ""}`}
        aria-pressed={selected}
        aria-label={profile.textLabelsEnabled ? undefined : choice.label}
        onClick={() => onChoose(choice)}
      >
        <ChoiceVisual
          visual={choice.visual}
          iconKey={choice.iconKey}
          label={choice.label}
          large={false}
        />
        <span className="choice-copy">
          <strong>{choice.label}</strong>
        </span>
        <VisualAttribution visual={choice.visual} />
      </button>
    );
  }

  // The committed board keeps its own actions. Before the first question there
  // is no board yet, so the full support set is offered — those phrases are
  // authored locally and never depend on the classifier.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    setQuestion("");
    onSubmitQuestion(text);
  }

  function handleResetChoices() {
    if (window.confirm("Are you sure you want to clear the generated choices?")) {
      onResetChoices();
    }
  }

  return (
    <section className="mode-view ai-view">
      <section className="ai-capture" aria-label="Caregiver message">
        <div className="ai-capture-controls">
        <button
          type="button"
          className={"ai-listen-button" + (listening ? " listening" : "")}
          onClick={onToggleListening}
          aria-pressed={listening}
          disabled={!online}
          aria-label={listening ? "Stop listening" : "Listen for a caregiver message"}
          title={!online ? "Needs a network connection" : listening ? "Stop listening" : "Start listening"}
        >
          <span className="ai-listen-icon" aria-hidden="true">
            {listening ? <MicOff size={48} /> : <Mic size={48} />}
          </span>
            <strong>{listening ? "Listening…" : "Send a message"}</strong>
            <small>{listening ? "Tap to stop" : "Tap to listen"}</small>
        </button>
        <div className="ai-question-entry">
        <form className="question-form question-form--typed" onSubmit={handleSubmit}>
          <label htmlFor="caregiver-question" className="sr-only">Caregiver message</label>
          <div className="question-controls">
            <input
              id="caregiver-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Type a message… Try: Dinner is ready."
              autoComplete="off"
              maxLength={300}
            />
            <button className="primary-button ask-button" type="submit" disabled={!question.trim() || !online}>
              <Send aria-hidden="true" size={18} />
              <span>Send</span>
            </button>
          </div>
        </form>
        <div className="ai-question-readout" aria-live="polite">
          <span className="ai-readout-label">Heard message</span>
          <p>
            {session.partialTranscript ? (
              <>“{session.partialTranscript}”</>
            ) : board?.questionText ? (
              <>“{board.questionText}”</>
            ) : listening ? (
              "Listening for a complete message…"
            ) : (
              "Your caregiver message will appear here."
            )}
          </p>
        </div>
        <div className="noise-gate-control">
          <div className="noise-gate-heading">
            <label htmlFor="noise-gate-threshold">Noise filter threshold</label>
            <output htmlFor="noise-gate-threshold">{noiseGateLevel.label}</output>
          </div>
          <input
            id="noise-gate-threshold"
            type="range"
            min={0}
            max={NOISE_GATE_LEVELS.length - 1}
            step={1}
            value={noiseGateIndex}
            disabled={listening}
            aria-valuetext={`${noiseGateLevel.label}, ${noiseGateLevel.description}`}
            aria-describedby="noise-gate-help"
            onChange={(event) =>
              onNoiseGateChange(
                NOISE_GATE_LEVELS[Number(event.target.value)]?.value ?? null,
              )
            }
          />
          <p id="noise-gate-help">
            Higher settings pass only louder sounds and may miss quiet speech. The
            setting applies the next time you listen. It cannot reliably determine
            physical distance from the microphone.
          </p>
        </div>
        </div>
        </div>
      </section>

      {!online ? (
        <p className="offline-notice" role="status">
          <WifiOff aria-hidden="true" size={18} />
          <span>
            No connection. The AI needs a network — <strong>Default AAC</strong>{" "}
            still works and still speaks.
          </span>
        </p>
      ) : null}

      {/* Only takes a row while actually listening — idle shows nothing. */}
      {microphoneError ? (
        <p className="inline-alert" role="alert">
          <AlertCircle aria-hidden="true" size={18} /> {microphoneError} You can still
          type the message above.
        </p>
      ) : null}

      {microphoneNotice ? (
        <p className="board-notice" role="status">
          <AlertCircle aria-hidden="true" size={18} /> {microphoneNotice}
        </p>
      ) : null}

      {session.lastError ? (
        <p className="board-notice" role="status">
          <AlertCircle aria-hidden="true" size={18} />
          {session.lastError === "classification"
            ? "That message could not be organized. Your previous choices are still available."
            : "Some pictures could not load. Every choice still works."}
        </p>
      ) : null}

      {/* The AI gallery can wrap to two rows on a landscape tablet. Quick
          answers stay separate and a refresh never clears either area. */}
      {board ? (
        <div className="ai-choice-area">
          <div className="ai-generated-row">
            <div className="ai-generated-header">
              <button
                type="button"
                className="ai-reset-button"
                onClick={handleResetChoices}
              >
                <RotateCcw aria-hidden="true" size={16} />
                Reset choices
              </button>
            </div>
            <div className={`ai-generated-grid${session.isRefreshing ? " is-loading" : ""}`}>
              <div className="choice-grid choice-grid--ai">
                {aiChoices.map((choice) => renderChoice(choice))}
              </div>
              {session.isRefreshing ? (
                <div className="ai-loading-overlay" role="status" aria-live="polite">
                  <span className="ai-loading-spinner" aria-hidden="true" />
                  <strong>Updating choices…</strong>
                </div>
              ) : null}
            </div>
          </div>
          {aiChoices.length === 0 ? (
            <p className="ai-row-hint">Send a message above — its responses land here.</p>
          ) : null}
          <div className="choice-grid choice-grid--quick" aria-label="Quick answers">
            {quickChoices.map((choice) => renderChoice(choice))}
          </div>
        </div>
      ) : (
        <div className="empty-board">
          <span className="empty-icon" aria-hidden="true">
            <Volume2 size={40} />
          </span>
          <h3>No message yet</h3>
          <p>
            Text and symbols appear first, then each picture fills in on its own
            tile. Nothing waits for a picture.
          </p>
        </div>
      )}

    </section>
  );
}

/** Exported for the Full Board action, which shows catalog words with no AI. */
export { ChoiceIcon };
