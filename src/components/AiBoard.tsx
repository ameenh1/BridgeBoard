"use client";

import {
  Mic, MicOff, Send, Sparkles, Volume2, WifiOff,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import type { BoardSessionState } from "@/lib/board/boardSessionController";
import type { RealtimeTranscriptionState } from "@/lib/speech/types";
import type { RenderableChoice } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import { ChoiceVisual, VisualAttribution } from "./ChoiceVisual";
import { AlertCircle, ChoiceIcon } from "./icons";
import { isPersistentAiChoice } from "@/lib/board/persistentChoices";

export function AiBoard({
  session,
  profile,
  realtimeState,
  online,
  microphoneError,
  onSubmitQuestion,
  onToggleListening,
  onChoose,
}: {
  session: BoardSessionState;
  profile: ChildProfile;
  realtimeState: RealtimeTranscriptionState;
  /** False means the AI side cannot work, whatever else is configured. */
  online: boolean;
  microphoneError?: string;
  onSubmitQuestion: (questionText: string) => void;
  onToggleListening: () => void;
  onChoose: (choice: RenderableChoice) => void;
}) {
  const [question, setQuestion] = useState("");
  const board = session.board;
  const listening = realtimeState === "connecting" || realtimeState === "connected";
  // Row 1: four slots for this question's AI image tiles. Row 2: the default answers.
  const aiChoices = (board?.choices.filter((choice) => !isPersistentAiChoice(choice)) ?? []).slice(0, 4);
  const quickChoices = board?.choices.filter(isPersistentAiChoice) ?? [];

  function renderChoice(choice: RenderableChoice) {
    const selected = session.selectedChoiceKey === choice.choiceKey;
    const showPhrase =
      profile.textLabelsEnabled && !isPersistentAiChoice(choice) && choice.spokenPhrase !== choice.label;
    return (
      <button
        key={choice.choiceKey}
        type="button"
        className={`choice-card choice-card--dense${isPersistentAiChoice(choice) ? " choice-card--quick is-persistent" : ""}${selected ? " is-selected" : ""}`}
        aria-pressed={selected}
        // When word labels are off and the spoken phrase differs from the
        // visible label, announce what tapping will actually say.
        aria-label={
          !profile.textLabelsEnabled && choice.spokenPhrase !== choice.label
            ? choice.spokenPhrase
            : undefined
        }
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
          {showPhrase ? <small>{choice.spokenPhrase}</small> : null}
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

  return (
    <section className="mode-view ai-view">
      <section className="ai-capture" aria-label="Ask a question">
        <div className="ai-capture-heading">
          <span className="eyebrow">Ask a question</span>
          <p>Tap the microphone to listen, or type a question below.</p>
        </div>
        <div className="ai-capture-controls">
        <button
          type="button"
          className={`ai-listen-button${listening ? " listening" : ""}`}
          onClick={onToggleListening}
          aria-pressed={listening}
          disabled={!online}
          aria-label={listening ? "Stop listening" : "Listen for a spoken question"}
          title={!online ? "Needs a network connection" : listening ? "Stop listening" : "Start listening"}
        >
          <span className="ai-listen-icon" aria-hidden="true">
            {listening ? <MicOff size={48} /> : <Mic size={48} />}
          </span>
          <strong>{listening ? "Listening…" : "Tap to listen"}</strong>
          <small>{listening ? "Tap to stop" : "Use the microphone to ask"}</small>
        </button>
        <div className="ai-question-entry">
        <form className="question-form question-form--typed" onSubmit={handleSubmit}>
          <label htmlFor="caregiver-question" className="sr-only">Caregiver question</label>
          <div className="question-controls">
            <input
              id="caregiver-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Type a question instead…"
              autoComplete="off"
              maxLength={300}
            />
            <button className="primary-button ask-button" type="submit" disabled={!question.trim() || !online}>
              <Send aria-hidden="true" size={18} />
              <span>Ask</span>
            </button>
          </div>
        </form>
        <div className="ai-question-readout" aria-live="polite">
          <span className="ai-readout-label">Heard question</span>
          <p>
            {session.partialTranscript
              ? `“${session.partialTranscript}”`
              : board?.questionText
                ? `“${board.questionText}”`
                : listening
                  ? "Listening for a complete question…"
                  : "Your spoken question will appear here."}
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
          type the question above.
        </p>
      ) : null}

      {session.lastError ? (
        <p className="board-notice" role="status">
          <AlertCircle aria-hidden="true" size={18} />
          {session.lastError === "classification"
            ? "That question could not be organized. Your previous choices are still available."
            : "Some pictures could not load. Every choice still works."}
        </p>
      ) : null}

      {/* Two fixed rows. The caregiver's generated choices fill the four slots
          above the always-available default answers. */}
      {board ? (
        <div className="ai-choice-area">
          <div className="choice-grid choice-grid--ai">
            {aiChoices.map((choice) => renderChoice(choice))}
            {Array.from({ length: Math.max(0, 4 - aiChoices.length) }).map((_, index) => (
              <div
                className="ai-choice-slot"
                key={`empty-ai-slot-${index}`}
                aria-label="Empty caregiver choice slot"
              >
                <Sparkles aria-hidden="true" size={24} />
                <span>Waiting for a question</span>
              </div>
            ))}
          </div>
          {session.isRefreshing ? (
            <p className="ai-row-hint">Updating choices…</p>
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
          <h3>No question yet</h3>
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
