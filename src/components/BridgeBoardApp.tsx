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
import { cancelSpeech, speakNatural } from "@/lib/speech/speak";
import {
  clearSettings,
  loadSettings,
  updateSettings,
} from "@/lib/storage/settings";
import {
  getCurrentUser,
  loadCloudProfile,
  saveCloudProfile,
  signOutCloud,
} from "@/lib/storage/cloud";
import {
  clearPersonalPhotos,
  loadPersonalPhotos,
  personalPhotoMap,
  type PersonalPhoto,
} from "@/lib/storage/personalPhotos";
import { applyPersonalPhotos } from "@/lib/board/applyPersonalPhotos";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import type { BoardAction, RenderableChoice } from "@/types/board";
import type { ChildProfile } from "@/types/profile";
import { DEFAULT_PROFILE, serverProfileFields } from "@/types/profile";
import { AiBoard } from "./AiBoard";
import { CaregiverScreen } from "./CaregiverScreen";
import { DefaultBoard } from "./DefaultBoard";
import { PhotosScreen } from "./PhotosScreen";
import { LoginScreen } from "./LoginScreen";
import { ProfileGateScreen, SetupScreen } from "./ProfileGateScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ACTIONS } from "./icons";
import { createWelcomeBoard } from "@/lib/board/persistentChoices";

type Stage = "login" | "profile" | "setup" | "app";
type View = "board" | "ai" | "caregiver" | "settings" | "photos";

/** Named so a screen reader announces the view when focus moves into it. */
const VIEW_LABELS: Record<View, string> = {
  board: "Default AAC board",
  ai: "AI AAC",
  caregiver: "Caregiver",
  settings: "Settings",
  photos: "Personal photos",
};

function makeInitialSession(): BoardSessionState {
  return {
    board: createWelcomeBoard(),
    isRefreshing: false,
    partialTranscript: "",
  };
}

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
 * session has to survive moving between screens, because discarding it
 * would throw away the active board and every picture already resolved for it.
 */
function BridgeBoardShell() {
  const [stage, setStage] = useState<Stage>("login");
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<View>("board");
  const [profile, setProfile] = useState<ChildProfile>(() => loadSettings());
  const [photos, setPhotos] = useState<PersonalPhoto[]>(() => loadPersonalPhotos());
  const [session, setSession] = useState<BoardSessionState>(makeInitialSession);
  const [realtimeState, setRealtimeState] = useState<RealtimeTranscriptionState>("idle");
  const [microphoneError, setMicrophoneError] = useState<string>();
  const [lastSpoken, setLastSpoken] = useState("");
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);

  const online = useOnlineStatus();
  const contentRef = useRef<HTMLDivElement>(null);
  // Skips the very first render: focusing on load would steal focus from the
  // page before anyone has asked for a view change.
  const viewHasChanged = useRef(false);

  const boardController = useRef<BoardSessionController | null>(null);
  const realtimeController = useRef<RealtimeTranscriptionController | null>(null);
  // Read inside callbacks that must not be re-created when settings change —
  // notably `say`, which the controllers close over.
  const profileRef = useRef(profile);

  const openAccount = useCallback(async (user: { id: string; email?: string | null }) => {
    const [cloudProfile] = await Promise.all([
      loadCloudProfile(user.id),
    ]);
    const nextProfile = cloudProfile ?? DEFAULT_PROFILE;
    setAuthUser({ id: user.id, email: user.email ?? "" });
    setProfile(nextProfile);
    updateSettings(nextProfile);
    setStage(cloudProfile ? "profile" : "setup");
    setView("board");
  }, []);

  const handleAuthenticated = useCallback(async () => {
    const user = await getCurrentUser();
    if (user) await openAccount(user);
  }, [openAccount]);
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
    let cancelled = false;
    void getCurrentUser()
      .then(async (user) => {
        if (user) await openAccount(user);
        if (!cancelled) setAuthReady(true);
      })
      .catch(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [openAccount]);

  // Releases the microphone if the tab closes or the shell unmounts while a
  // session is live. Nothing should keep listening past this component.
  useEffect(
    () => () => {
      void realtimeController.current?.stop();
      realtimeController.current = null;
    },
    [],
  );

  // Moving between screens leaves focus wherever it was, so a keyboard or
  // switch user has to tab from the top of the document every time. Focusing
  // the new view also makes a screen reader read its heading, which is how a
  // view change gets announced at all.
  useEffect(() => {
    if (!viewHasChanged.current) {
      viewHasChanged.current = true;
      return;
    }
    contentRef.current?.focus();
  }, [view]);

  const say = useCallback((phrase: string) => {
    const text = phrase.trim();
    if (!text) return;
    setLastSpoken(text);
    void speakNatural(text, profileRef.current);
  }, []);

  const patchProfile = useCallback((patch: Partial<ChildProfile>) => {
    const next = updateSettings(patch);
    setProfile(next);
    if (authUser) void saveCloudProfile(authUser.id, next);
    if (patch.quietMode || patch.speechEnabled === false) cancelSpeech();
  }, [authUser]);



  const chooseRenderable = useCallback(
    (choice: RenderableChoice) => {
      // Selection lives in the controller so it survives the next commit.
      boardController.current?.selectChoice(choice.choiceKey);
      say(choice.spokenPhrase);
    },
    [say],
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
    void (async () => {
      const saved = authUser ? await saveCloudProfile(authUser.id, next) : next;
      updateSettings(saved);
      setProfile(saved);
      setStage("app");
      setView("board");
    })();
  }, [authUser]);

  const resetProfile = useCallback(() => {
    if (!window.confirm("Reset this profile? Settings and personal photos on this device will be erased.")) {
      return;
    }
    void stopListening();
    clearSettings();
    clearPersonalPhotos();
    void signOutCloud();
    setAuthUser(null);
    setProfile(DEFAULT_PROFILE);
    setPhotos([]);
    setStage("login");
    setView("board");
  }, [stopListening]);

  /**
   * Signing out ends the account session only. Settings are the
   * child's and stay on the device — losing a board configuration because a
   * caregiver signed out of an optional account would be the wrong trade.
   */
  const handleSignOut = useCallback(() => {
    void stopListening();
    void signOutCloud();
    setAuthUser(null);
    setStage("login");
    setView("board");
  }, [stopListening]);

  if (!authReady) return <main className="boot-screen" aria-busy="true" />;

  if (stage === "login") {
    return (
      <LoginScreen
        onAuthenticated={() => void handleAuthenticated()}
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

  // Personal photos are applied here rather than on the server: they are
  // never uploaded, so a board arrives generic and is personalized on the
  // device. applyPersonalPhotos returns the same reference when nothing
  // matches, so this costs nothing when no photos are set.
  const photoMap = personalPhotoMap(photos);
  const personalizedSession =
    session.board && photoMap.size > 0
      ? { ...session, board: applyPersonalPhotos(session.board, photoMap) }
      : session;

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
          BridgeBoard
        </button>

        <nav aria-label="Main">
          <NavButton active={view === "board"} onClick={() => setView("board")}>
            Default AAC
          </NavButton>
          <NavButton active={view === "ai"} onClick={() => setView("ai")}>
            AI AAC
          </NavButton>
        </nav>

        <div className="nav-right">
          <button className="profile-pill" type="button" onClick={() => setView("caregiver")}>
            <span className="mini-avatar" aria-hidden="true">
              {(name[0] ?? "B").toUpperCase()}
            </span>
            {name || "Caregiver"}
          </button>

          {/* Only shown when an account is actually in use. Nothing here
              nags an unsigned-in caregiver to create one. */}
          {authUser ? (
            <button
              className="signout-button"
              type="button"
              onClick={handleSignOut}
              title={`Signed in as ${authUser.email}`}
            >
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {/*
        Every view stays mounted below this point only in the sense that the
        controllers do: React unmounts the inactive screen, but the board
        session and any in-flight asset streams live in the shell, so coming
        back to AI AAC shows the same board with the same resolved pictures.
      */}
      <div
        className="app-content"
        ref={contentRef}
        tabIndex={-1}
        role="region"
        aria-label={VIEW_LABELS[view]}
      >
        {view === "board" ? (
          <DefaultBoard
            profile={profile}
            photos={photoMap}
            onSpeak={say}
          />
        ) : null}

        {view === "ai" ? (
          <AiBoard
            session={personalizedSession}
            profile={profile}
            realtimeState={realtimeState}
            online={online}
            microphoneError={microphoneError}
            onSubmitQuestion={submitQuestion}
            onToggleListening={toggleListening}
            onChoose={chooseRenderable}
            onAction={handleAction}
          />
        ) : null}


        {view === "caregiver" ? (
          <CaregiverScreen
            onOpenSettings={() => setView("settings")}
            onOpenPhotos={() => setView("photos")}
            photoCount={photos.length}
          />
        ) : null}

        {view === "photos" ? (
          <PhotosScreen photos={photos} onChange={setPhotos} />
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
