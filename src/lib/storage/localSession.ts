"use client";

/**
 * The temporary local click-through that stands in for sign-in.
 *
 * This is deliberately not authentication. It stores one non-sensitive flag in
 * sessionStorage so a reload inside the same browser session returns to the
 * board instead of the login screen. No credential is ever read, transmitted
 * or persisted — the email and password fields on the login screen are inert
 * placeholders for a real auth flow that has not been built yet.
 */
const SESSION_KEY = "bridgeboard.localSession";

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function hasLocalSession(): boolean {
  try {
    return getSessionStorage()?.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function startLocalSession(): void {
  try {
    getSessionStorage()?.setItem(SESSION_KEY, "1");
  } catch {
    // A session that cannot be remembered just shows the login again.
  }
}

export function endLocalSession(): void {
  try {
    getSessionStorage()?.removeItem(SESSION_KEY);
  } catch {
    // Nothing to do.
  }
}
