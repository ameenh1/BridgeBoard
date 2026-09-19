"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  createBoardSessionController,
  type BoardSessionController,
  type BoardSessionState,
} from "@/lib/board/boardSessionController";
import {
  createRealtimeTranscriptionController,
  type RealtimeTranscriptionController,
} from "@/lib/speech/realtimeTranscription";
import type { RealtimeTranscriptionState } from "@/lib/speech/types";
import { cancelSpeech, speak } from "@/lib/speech/speak";
import {
  appendHistory,
  clearHistory,
  loadHistory,
  type CommunicationHistoryEntry,
} from "@/lib/storage/history";
import {
  clearSettings,
  hasStoredSettings,
  loadSettings,
  updateSettings,
} from "@/lib/storage/settings";
import { endLocalSession, hasLocalSession, startLocalSession } from "@/lib/storage/localSession";
import type { BoardAction, RenderableChoice } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import { DEFAULT_PROFILE, serverProfileFields } from "@/types/profile";
import type { VocabularyItem } from "@/types/vocabulary";
import { AiBoard } from "./AiBoard";
import { CaregiverScreen } from "./CaregiverScreen";
import { DefaultBoard } from "./DefaultBoard";
import { HistoryScreen } from "./HistoryScreen";
import { LoginScreen } from "./LoginScreen";
import { ProfileGateScreen, SetupScreen } from "./ProfileGateScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ACTIONS } from "./icons";

type Stage = "login" | "profile" | "setup" | "app";
type View = "board" | "ai" | "history" | "caregiver" | "settings";

type Health = {
  classifier: "live" | "unconfigured";
  sharedCache: "configured" | "optional_unconfigured";
};

const INITIAL_SESSION: BoardSessionState = {
  board: null,
  isRefreshing: false,
  partialTranscript: "",
};

const subscribeNever = () => () => {};

/**
 * True only after hydration. Browser storage does not exist on the server, so
 * the shell renders a neutral boot surface for the server pass and reads
 * settings during the client mount — no effect writing state on mount, and no
 * hydration mismatch from guessing at stored values.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export function BridgeBoardApp() {
  if (!useHydrated()) return <main className="boot-screen" aria-busy="true" />;
  return <BridgeBoardShell />;
}

/**
 * The single client shell.
 *
 * Both controllers are created here and torn down only when this component
 * unmounts or the local profile is exited. That is deliberate: the board
 * session has to survive a trip to History and back, because discarding it
 * would throw away the active board and every picture already resolved for it.
 */
function BridgeBoardShell() {
  // Safe as lazy initialisers: this component only ever mounts in the browser.
  const [stage, setStage] = useState<Stage>(() =>
    !hasLocalSession() ? "login" : hasStoredSettings() ? "app" : "setup",
  );
  const [view, setView] = useState<View>("board");
  const [profile, setProfile] = useState<ChildProfile>(() => loadSettings());
  const [history, setHistory] = useState<CommunicationHistoryEntry[]>(() => loadHistory());
  const [session, setSession] = useState<BoardSessionState>(INITIAL_SESSION);
  const [realtimeState, setRealtimeState] = useState<RealtimeTranscriptionState>("idle");
  const [microphoneError, setMicrophoneError] = useState<string>();
  const [health, setHealth] = useState<Health>();
  const [lastSpoken, setLastSpoken] = useState("");

  const boardController = useRef<BoardSessionController | null>(null);
  const realtimeController = useRef<RealtimeTranscriptionController | null>(null);
  // Read inside callbacks that must not be re-created when settings change —
  // notably `say`, which the controllers close over.
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    const controller = createBoardSessionController({
      profile: serverProfileFields(profileRef.current),
      onStateChange: setSession,
    });
    boardController.current = controller;
    return () => {
      controller.destroy();
      boardController.current = null;
    };
  }, []);

  useEffect(() => {
    const aborter = new AbortController();
    void fetch("/api/health", { signal: aborter.signal })
      .then((response) => (response.ok ? (response.json() as Promise<Health>) : null))
      .then((result) => {
        if (result) setHealth(result);
      })
      .catch(() => undefined);
    return () => aborter.abort();
  }, []);

  // Releases the microphone if the tab closes or the shell unmounts while a
  // session is live. Nothing should keep listening past this component.
  useEffect(
    () => () => {
      void realtimeController.current?.stop();
      realtimeController.current = null;
    },
    [],
  );

  const say = useCallback((phrase: string) => {
    const text = phrase.trim();
    if (!text) return;
    setLastSpoken(text);
    speak(text, profileRef.current);
  }, []);

  const patchProfile = useCallback((patch: Partial<ChildProfile>) => {
    const next = updateSettings(patch);
    setProfile(next);
    if (patch.quietMode || patch.speechEnabled === false) cancelSpeech();
  }, []);

  const record = useCallback(
    (entry: Omit<CommunicationHistoryEntry, "id" | "timestamp">) => {
      const current = profileRef.current;
      if (!current.historyEnabled) return;
      appendHistory(entry, true);
      setHistory(loadHistory());
    },
    [],
  );

  const chooseVocabulary = useCallback(
    (item: VocabularyItem) => {
      record({ boardType: "full_board", selectedVocabularyId: item.id, selectedLabel: item.label });
    },
    [record],
  );

  const chooseRenderable = useCallback(
    (choice: RenderableChoice) => {
      // Selection lives in the controller so it survives the next commit.
      boardController.current?.selectChoice(choice.choiceKey);
      say(choice.spokenPhrase);
      const board = boardController.current?.getState().board;
      record({
        boardType: board?.boardType ?? "choice",
        questionText: board?.questionText,
        selectedVocabularyId: choice.id,
        selectedLabel: choice.label,
      });
    },
    [record, say],
  );

  const submitQuestion = useCallback((questionText: string) => {
    void boardController.current?.submitQuestion(questionText);
  }, []);

  const stopListening = useCallback(async () => {
    const controller = realtimeController.current;
    realtimeController.current = null;
    setRealtimeState("idle");
    await controller?.stop();
  }, []);

  const startListening = useCallback(async () => {
    setMicrophoneError(undefined);
    const controller = createRealtimeTranscriptionController({
      onStateChange: setRealtimeState,
      onError: (error) => setMicrophoneError(microphoneMessage(error.code)),
      onPartialTranscript: ({ transcript }) =>
        boardController.current?.acceptPartialTranscript(transcript),
      onFinalTranscript: ({ transcript }) =>
        boardController.current?.acceptFinalTranscript(transcript),
    });
    realtimeController.current = controller;
    try {
      await controller.start();
    } catch {
      // start() already reported through onError; typed input stays available.
      realtimeController.current = null;
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (realtimeState === "connecting" || realtimeState === "connected") void stopListening();
    else void startListening();
  }, [realtimeState, startListening, stopListening]);

  const handleAction = useCallback(
    (action: BoardAction) => {
      if (action === "full_board") {
        setView("board");
        return;
      }
      if (action === "repeat" && lastSpoken) {
        say(lastSpoken);
        return;
      }
      say(ACTIONS[action].phrase);
    },
    [lastSpoken, say],
  );

  const finishSetup = useCallback((next: ChildProfile) => {
    const saved = updateSettings(next);
    setProfile(saved);
    setStage("app");
    setView("board");
  }, []);

  const resetProfile = useCallback(() => {
    if (!window.confirm("Reset this profile? Settings and history on this device will be erased.")) {
      return;
    }
    void stopListening();
    clearSettings();
    clearHistory();
    endLocalSession();
    setProfile(DEFAULT_PROFILE);
    setHistory([]);
    setStage("login");
    setView("board");
  }, [stopListening]);

  const clearAllHistory = useCallback(() => {
    if (!window.confirm("Clear the history saved on this device?")) return;
    clearHistory();
    setHistory([]);
  }, []);

  if (stage === "login") {
    return (
      <LoginScreen
        onContinue={() => {
          startLocalSession();
          setStage(hasStoredSettings() ? "profile" : "setup");
        }}
      />
    );
  }

  if (stage === "profile") {
    return (
      <ProfileGateScreen
        profile={profile}
        onContinue={() => {
          setStage("app");
          setView("board");
        }}
        onSetUpNew={() => {
          setProfile({ ...DEFAULT_PROFILE, id: profile.id });
          setStage("setup");
        }}
      />
    );
  }

  if (stage === "setup") {
    return <SetupScreen initial={profile} onFinish={finishSetup} />;
  }

  const name = profile.displayName.trim();

  return (
    <main className="app-page">
      <header className="app-nav">
        <button
          className="brand-button"
          type="button"
          onClick={() => setView("board")}
          aria-label="BridgeBoard home"
        >
          <span className="brand-mark" aria-hidden="true">B</span>
          BridgeBoard
        </button>

        <nav aria-label="Main">
          <NavButton active={view === "board"} onClick={() => setView("board")}>
            Default AAC
          </NavButton>
          <NavButton active={view === "ai"} onClick={() => setView("ai")}>
            AI AAC
          </NavButton>
          <NavButton active={view === "history"} onClick={() => setView("history")}>
            History
          </NavButton>
        </nav>

        <div className="nav-right">
          <HealthBadge health={health} />
          <button className="profile-pill" type="button" onClick={() => setView("caregiver")}>
            <span className="mini-avatar" aria-hidden="true">
              {(name[0] ?? "B").toUpperCase()}
            </span>
            {name || "Caregiver"}
          </button>
        </div>
      </header>

      {/*
        Every view stays mounted below this point only in the sense that the
        controllers do: React unmounts the inactive screen, but the board
        session and any in-flight asset streams live in the shell, so coming
        back to AI AAC shows the same board with the same resolved pictures.
      */}
      <div className="app-content">
        {view === "board" ? (
          <DefaultBoard profile={profile} onSpeak={say} onRecord={chooseVocabulary} />
        ) : null}

        {view === "ai" ? (
          <AiBoard
            session={session}
            profile={profile}
            realtimeState={realtimeState}
            microphoneError={microphoneError}
            onSubmitQuestion={submitQuestion}
            onToggleListening={toggleListening}
            onChoose={chooseRenderable}
            onAction={handleAction}
          />
        ) : null}

        {view === "history" ? (
          <HistoryScreen
            entries={history}
            historyEnabled={profile.historyEnabled}
            onClear={clearAllHistory}
          />
        ) : null}

        {view === "caregiver" ? (
          <CaregiverScreen onOpenSettings={() => setView("settings")} />
        ) : null}

        {view === "settings" ? (
          <SettingsScreen
            profile={profile}
            onChange={patchProfile}
            onResetProfile={resetProfile}
          />
        ) : null}
      </div>
    </main>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "active" : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Says whether the AI side is usable without ever naming which credential is
 * absent. "AI setup required" is actionable for whoever deployed it and
 * meaningless to anyone else.
 */
function HealthBadge({ health }: { health: Health | undefined }) {
  if (!health) return null;
  const live = health.classifier === "live";
  return (
    <span className={`status-badge${live ? " is-live" : ""}`}>
      <span className="status-dot" aria-hidden="true" />
      {live ? "AI ready" : "AI setup required"}
    </span>
  );
}

function microphoneMessage(code: string): string {
  switch (code) {
    case "permission_denied":
      return "Microphone access was blocked.";
    case "not_supported":
      return "This browser cannot use the microphone.";
    default:
      return "The microphone could not connect.";
  }
}
