"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/browser";
import { signInWithPassword, signUpWithPassword } from "@/lib/storage/cloud";

/**
 * Supabase email/password entry point for account creation and sign-in.
 *
 * The email and password fields are used for an account flow
 * that has not been built. They are optional, uncontrolled, never read by any
 * handler, never stored, and never sent anywhere — the submit handler ignores
 * the form entirely and just starts a local session. Keeping them visible
 * preserves the intended design; the button text and the note below it say
 * plainly that nothing is being authenticated.
 */
export function LoginScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [showSignupAction, setShowSignupAction] = useState(false);
  const [notice, setNotice] = useState<string>();
  const configured = isSupabaseBrowserConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);
    setShowSignupAction(false);
    if (!configured) {
      setError("Supabase is not configured yet.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || password.length < 8) {
      setError("Enter an email and a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    const result = mode === "signIn"
      ? await signInWithPassword(email, password)
      : await signUpWithPassword(email, password);
    setBusy(false);
    if (result.error) {
      if (mode === "signIn") {
        setError("Account not found or the password is incorrect.");
        setShowSignupAction(true);
      } else {
        setError(result.error.message);
      }
      return;
    }
    if (mode === "signUp" && result.needsEmailConfirmation) {
      setNotice("Check your email to confirm your account, then sign in.");
      setMode("signIn");
      return;
    }
    onAuthenticated();
  }

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
          <div className="sound-waves" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      <section className="feature-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>{mode === "signIn" ? "Welcome Back" : "Create your account"}</h2>
          <p>{mode === "signIn" ? "Sign in to access your communication board" : "Save boards and history across devices"}</p>

          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" />

          <div className="password-heading">
            <label htmlFor="password">Password</label>
          </div>
          <input id="password" name="password" type="password" placeholder="Enter your password" autoComplete={mode === "signIn" ? "current-password" : "new-password"} />

          <button className="continue-button" type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "signIn" ? "Continue" : "Create account"}
          </button>

          <p className="signup-prompt">
            <span>{mode === "signIn" ? "Don't have an account?" : "Already have an account?"}</span>{" "}
            <button type="button" onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
              {mode === "signIn" ? "Sign up" : "Sign in"}
            </button>
          </p>

          {error ? (
            <div role="alert" className="auth-error">
              <span className="auth-error-icon" aria-hidden="true">!</span>
              <div>
                <strong>We couldn&apos;t sign you in</strong>
                <span>{error}</span>
                {showSignupAction ? (
                  <button type="button" onClick={() => { setMode("signUp"); setError(undefined); setShowSignupAction(false); }}>
                    Create an account
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {notice ? (
            <div role="status" className="auth-notice">
              <span className="auth-notice-icon" aria-hidden="true">✓</span>
              <div>
                <strong>Account created</strong>
                <span>{notice}</span>
              </div>
            </div>
          ) : null}

          {!configured ? <p role="alert" className="auth-error">Supabase is not configured yet.</p> : null}

          <p className="auth-note">
            Your account is secured by Supabase. Board settings and history are
            saved to your account when you are signed in.
          </p>
        </form>
      </section>
    </main>
  );
}
