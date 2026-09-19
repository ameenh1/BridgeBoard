"use client";

import Image from "next/image";
import type { FormEvent } from "react";

/**
 * Temporary local entry point.
 *
 * The email and password fields are visual placeholders for an account flow
 * that has not been built. They are optional, uncontrolled, never read by any
 * handler, never stored, and never sent anywhere — the submit handler ignores
 * the form entirely and just starts a local session. Keeping them visible
 * preserves the intended design; the button text and the note below it say
 * plainly that nothing is being authenticated.
 */
export function LoginScreen({ onContinue }: { onContinue: () => void }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Deliberately reads nothing off the form.
    event.preventDefault();
    onContinue();
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
        </div>
      </section>

      <section className="feature-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Welcome to BridgeBoard</h2>
          <p>Everything runs on this device. Nothing here is sent anywhere.</p>

          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="off" />

          <div className="password-heading">
            <label htmlFor="password">Password</label>
          </div>
          <input id="password" name="password" type="password" placeholder="Enter your password" autoComplete="off" />

          <button className="continue-button" type="submit">
            Continue locally
          </button>

          <p className="auth-note">
            Account sign-in will be connected later. These fields are
            placeholders — you can leave them blank, and whatever you type is
            ignored, not saved, and never transmitted.
          </p>
        </form>
      </section>
    </main>
  );
}
