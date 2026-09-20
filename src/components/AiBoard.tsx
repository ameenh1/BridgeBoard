"use client";

import { Check, LayoutGrid, Mic, MicOff, RefreshCw, Send, Sparkles, Volume2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { BoardSessionState } from "@/lib/board/boardSessionController";
import type { RealtimeTranscriptionState } from "@/lib/speech/types";
import type { BoardAction, RenderableChoice } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import { ChoiceVisual, VisualAttribution } from "./ChoiceVisual";
import { ACTIONS, AlertCircle, ChoiceIcon } from "./icons";
import { isPersistentAiChoice } from "@/lib/board/persistentChoices";

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
  // Row 1: this question's AI image tiles. Row 2: the default answers.
  const aiChoices = board?.choices.filter((choice) => !isPersistentAiChoice(choice)) ?? [];
  const quickChoices = board?.choices.filter(isPersistentAiChoice) ?? [];

  function renderChoice(choice: RenderableChoice) {
    const selected = session.selectedChoiceKey === choice.choiceKey;
    const showPhrase =
      profile.textLabelsEnabled && choice.spokenPhrase !== choice.label;
    return (
      <button
        key={choice.choiceKey}
        type="button"
        className={`choice-card choice-card--dense${selected ? " is-selected" : ""}${isPersistentAiChoice(choice) ? " is-persistent" : ""}`}
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
        {choice.origin === "dynamic" ? (
          <span className="origin-badge">
            <Sparkles aria-hidden="true" size={13} /> New
          </span>
        ) : null}
      </button>
    );
  }

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
    <section className="mode-view ai-view">
      {/*
        One compact header: title left, non-blocking board status right.
        The status never disables anything — tiles stay clickable throughout.
      */}
      <div className="ai-topbar">
        <h1>AI AAC</h1>
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

      <form className="question-form question-form--compact" onSubmit={handleSubmit}>
        <label htmlFor="caregiver-question" className="sr-only">
          Caregiver question
        </label>
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
            className={`listen-button listen-button--icon${listening ? " listening" : ""}`}
            onClick={onToggleListening}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Listen for a spoken question"}
            title={listening ? "Stop" : "Listen"}
          >
            {listening ? <MicOff aria-hidden="true" size={20} /> : <Mic aria-hidden="true" size={20} />}
          </button>
          <button className="primary-button ask-button" type="submit" disabled={!question.trim()}>
            <Send aria-hidden="true" size={18} />
            <span>Ask</span>
          </button>
        </div>
      </form>

      {/* Only takes a row while actually listening — idle shows nothing. */}
      {session.partialTranscript || listening ? (
        <p className="transcript-line" aria-live="polite">
          {session.partialTranscript ? (
            <>Hearing: &ldquo;{session.partialTranscript}&rdquo;</>
          ) : (
            <>Listening for a complete question&hellip;</>
          )}
        </p>
      ) : null}

      {microphoneError ? (
        <p className="inline-alert" role="alert">
          <AlertCircle aria-hidden="true" size={18} /> {microphoneError} You can still
          type the question above.
        </p>
      ) : null}

      {board?.questionText ? (
        <p className="heard-question">&ldquo;{board.questionText}&rdquo;</p>
      ) : null}

      {session.lastError ? (
        <p className="board-notice" role="status">
          <AlertCircle aria-hidden="true" size={18} />
          {session.lastError === "classification"
            ? "That question could not be organized. Your previous choices are still available."
            : "Some pictures could not load. Every choice still works."}
        </p>
      ) : null}

      {/*
        Two fixed rows. Row 1 reserves four slots for this question's AI
        image tiles; row 2 is the default answers, always here. A refresh
        never clears either row; new pictures upgrade their own tile in place.
      */}
      {board ? (
        <>
          <div className="choice-grid choice-grid--ai">
            {aiChoices.map((choice) => renderChoice(choice))}
          </div>
          {aiChoices.length === 0 ? (
            <p className="ai-row-hint">Ask a question above — its pictures land here.</p>
          ) : null}
          <div className="choice-grid choice-grid--quick">
            {quickChoices.map((choice) => renderChoice(choice))}
          </div>
        </>
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

      <div className="action-rail" aria-label="Always available">
        {actions.map((action) => {
          const config = ACTIONS[action];
          const Icon = config.icon;
          return (
            <button
              key={action}
              type="button"
              className={action === "full_board" ? "full-board-action" : undefined}
              onClick={() => onAction(action)}
              aria-label={config.label}
              title={config.phrase || config.label}
            >
              {action === "full_board" ? (
                <LayoutGrid aria-hidden="true" size={16} />
              ) : (
                <Icon aria-hidden="true" size={16} />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Exported for the Full Board action, which shows catalog words with no AI. */
export { ChoiceIcon };
