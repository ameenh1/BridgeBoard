"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { signIn, signUp } from "@/lib/auth/authClient";
import type { AuthUser } from "@/types/auth";

/**
 * Entry point.
 *
 * An account is optional and always will be. Signing in lets a caregiver
 * carry settings between devices later; it is never a condition of reaching
 * the board. "Continue without an account" stays on this screen permanently,
 * and it is also the automatic answer whenever accounts are unreachable —
 * BridgeBoard must survive failure of credentials like any other dependency.
 *
 * The visual structure here is Person 1's; only the form behaviour is new.
 */
type Mode = "sign_in" | "sign_up";

export function LoginScreen({
  onContinue,
  onSignedIn,
}: {
  onContinue: () => void;
  onSignedIn: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "info" }>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setNotice(undefined);

    const result = mode === "sign_in" ? await signIn(email, password) : await signUp(email, password);

    switch (result.status) {
      case "signed_in":
        // No setPending(false): the shell swaps this screen out immediately,
        // and re-enabling a button on an unmounting form only risks a double
        // submit.
        onSignedIn(result.user);
        return;

      case "confirm_email":
        setNotice({
          text: "Check your email for a confirmation link, then sign in. You can start using the board now without waiting.",
          tone: "info",
        });
        break;

      case "unavailable":
        setNotice({
          text: "Accounts aren't reachable right now. You can still continue without one — nothing on the board depends on signing in.",
          tone: "info",
        });
        break;

      case "error":
        setNotice({ text: result.message, tone: "error" });
        break;

      default:
        setNotice({ text: "That didn't work. Try again.", tone: "error" });
    }

    setPending(false);
  }

  const submitLabel = mode === "sign_in" ? "Sign in" : "Create account";

  return (
    <main className="login-page">
      <section className="intro-panel">
        <Image className="plant plant-evergreen" src="/brand/evergreen.svg" alt="" width={220} height={400} />
        <Image className="plant plant-polypodium" src="/brand/polypodium.svg" alt="" width={400} height={400} />
        <Image className="plant plant-split-leaf" src="/brand/split-leaf.svg" alt="" width={260} height={320} />
        <div className="brand-lockup">
          <h1>
            Bridge
            <br />
            Board
          </h1>
          <p>An AI-powered AAC Board</p>
        </div>
        <div className="kids">
          <Image
            className="kids-art"
            src="/brand/kids.webp"
            alt="Two children using communication devices"
            width={900}
            height={720}
            priority
          />
        </div>
      </section>

      <section className="feature-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Welcome to BridgeBoard</h2>
          <p>
            {mode === "sign_in"
              ? "Sign in to keep settings across devices, or continue without an account."
              : "Create an account to keep settings across devices, or continue without one."}
          </p>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
          />

          <div className="password-heading">
            <label htmlFor="password">Password</label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            placeholder={mode === "sign_up" ? "At least 8 characters" : "Enter your password"}
            autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
          />

          <button className="continue-button" type="submit" disabled={pending}>
            {pending ? "Working…" : submitLabel}
          </button>

          {/*
            Announced rather than silently appearing: a caregiver using a
            screen reader needs the failure, not just a colour change.
          */}
          <p className="auth-message" role="status" aria-live="polite">
            {notice ? <span className={notice.tone === "error" ? "is-error" : undefined}>{notice.text}</span> : null}
          </p>

          <button
            className="auth-toggle"
            type="button"
            disabled={pending}
            onClick={() => {
              setMode(mode === "sign_in" ? "sign_up" : "sign_in");
              setNotice(undefined);
            }}
          >
            {mode === "sign_in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>

          <div className="auth-divider" role="separator">
            <span>or</span>
          </div>

          <button className="local-button" type="button" onClick={onContinue} disabled={pending}>
            Continue without an account
          </button>

          <p className="auth-note">
            The board works fully without signing in. Settings and history stay
            on this device either way — an account only carries them between
            devices.
          </p>
        </form>
      </section>
    </main>
  );
}
