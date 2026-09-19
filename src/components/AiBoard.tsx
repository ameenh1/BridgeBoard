"use client";

import { Check, LayoutGrid, Mic, MicOff, RefreshCw, Send, Sparkles, Volume2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { BoardSessionState } from "@/lib/board/boardSessionController";
import type { RealtimeTranscriptionState } from "@/lib/speech/types";
import type { BoardAction, RenderableChoice } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import { ChoiceVisual, VisualAttribution } from "./ChoiceVisual";
import { ACTIONS, AlertCircle, ChoiceIcon } from "./icons";

const ALL_ACTIONS: BoardAction[] = [
  "help",
  "repeat",
  "something_else",
  "not_that",
  "need_more_time",
  "full_board",
];

export function AiBoard({
  session,
  profile,
  realtimeState,
  microphoneError,
  onSubmitQuestion,
  onToggleListening,
  onChoose,
  onAction,
}: {
  session: BoardSessionState;
  profile: ChildProfile;
  realtimeState: RealtimeTranscriptionState;
  microphoneError?: string;
  onSubmitQuestion: (questionText: string) => void;
  onToggleListening: () => void;
  onChoose: (choice: RenderableChoice) => void;
  onAction: (action: BoardAction) => void;
}) {
  const [question, setQuestion] = useState("");
  const board = session.board;
  const listening = realtimeState === "connecting" || realtimeState === "connected";

  // The committed board keeps its own actions. Before the first question there
  // is no board yet, so the full support set is offered — those phrases are
  // authored locally and never depend on the classifier.
  const actions = board?.actions.length ? board.actions : ALL_ACTIONS;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    setQuestion("");
    onSubmitQuestion(text);
  }

  return (
    <section className="mode-view">
      <div className="mode-header">
        <div>
          <span className="eyebrow">Optional support</span>
          <h1>AI AAC</h1>
          <p>
            Ask a question out loud or type it. The current choices stay usable
            the whole time the next board is being prepared.
          </p>
        </div>
      </div>

      <form className="question-form" onSubmit={handleSubmit}>
        <label htmlFor="caregiver-question">Caregiver question</label>
        <div className="question-controls">
          <input
            id="caregiver-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Would you like waffles or dragon fruit?"
            autoComplete="off"
            maxLength={300}
          />
          <button
            type="button"
            className={`listen-button${listening ? " listening" : ""}`}
            onClick={onToggleListening}
            aria-pressed={listening}
          >
            {listening ? <MicOff aria-hidden="true" size={20} /> : <Mic aria-hidden="true" size={20} />}
            <span>
              {realtimeState === "connecting" ? "Connecting" : listening ? "Stop" : "Listen"}
            </span>
          </button>
          <button className="primary-button ask-button" type="submit" disabled={!question.trim()}>
            <Send aria-hidden="true" size={18} />
            <span>Ask</span>
          </button>
        </div>
      </form>

      <p className="transcript-line" aria-live="polite">
        {session.partialTranscript ? (
          <>Hearing: &ldquo;{session.partialTranscript}&rdquo;</>
        ) : listening ? (
          <>Listening for a complete question&hellip;</>
        ) : (
          <>Nothing is listening until you press Listen.</>
        )}
      </p>

      {microphoneError ? (
        <p className="inline-alert" role="alert">
          <AlertCircle aria-hidden="true" size={18} /> {microphoneError} You can still
          type the question above.
        </p>
      ) : null}

      <div className="board-heading-row">
        <div>
          <span className="eyebrow">Communication board</span>
          <h2>{board?.title ?? "Choices will appear here"}</h2>
          {board?.questionText ? (
            <p className="heard-question">&ldquo;{board.questionText}&rdquo;</p>
          ) : null}
        </div>
        {/*
          A non-blocking indicator. The board below stays mounted and every
          tile stays clickable while this is showing — a refresh must never
          take the current choices away from someone mid-sentence.
        */}
        <p className={`refresh-state${session.isRefreshing ? " is-active" : ""}`} aria-live="polite">
          {session.isRefreshing ? (
            <>
              <RefreshCw aria-hidden="true" size={16} className="spin" /> Updating choices
            </>
          ) : board ? (
            <>
              <Check aria-hidden="true" size={16} /> Board ready
            </>
          ) : (
            <>Ready for a question</>
          )}
        </p>
      </div>

      {session.lastError ? (
        <p className="board-notice" role="status">
          <AlertCircle aria-hidden="true" size={18} />
          {session.lastError === "classification"
            ? "That question could not be organized. Your previous choices are still available."
            : "Some pictures could not load. Every choice still works."}
        </p>
      ) : null}

      {board ? (
        <div className="choice-grid">
          {board.choices.map((choice) => {
            const selected = session.selectedChoiceKey === choice.choiceKey;
            return (
              <button
                key={choice.choiceKey}
                type="button"
                className={`choice-card${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onChoose(choice)}
              >
                <ChoiceVisual
                  visual={choice.visual}
                  iconKey={choice.iconKey}
                  label={choice.label}
                  large={profile.buttonSize === "large"}
                />
                <span className="choice-copy">
                  <strong>{choice.label}</strong>
                  {profile.textLabelsEnabled ? <small>{choice.spokenPhrase}</small> : null}
                </span>
                <VisualAttribution visual={choice.visual} />
                {choice.origin === "dynamic" ? (
                  <span className="origin-badge">
                    <Sparkles aria-hidden="true" size={13} /> New
                  </span>
                ) : null}
              </button>
            );
          })}
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

      <div className="quick-actions">
        <span>Always available</span>
        {actions.map((action) => {
          const config = ACTIONS[action];
          const Icon = config.icon;
          return (
            <button
              key={action}
              type="button"
              className={action === "full_board" ? "full-board-action" : undefined}
              onClick={() => onAction(action)}
            >
              {action === "full_board" ? (
                <LayoutGrid aria-hidden="true" size={16} />
              ) : (
                <Icon aria-hidden="true" size={16} />
              )}
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Exported for the Full Board action, which shows catalog words with no AI. */
export { ChoiceIcon };
