import "server-only";
import type { AuthError } from "@supabase/supabase-js";

/**
 * Translates provider errors into messages we wrote.
 *
 * The same rule the board pipeline follows for model output applies to the
 * auth service: nothing it returns reaches a caregiver's screen verbatim.
 * Provider strings change between releases, occasionally name internals, and
 * are not written for the person holding the tablet.
 *
 * Unrecognised codes collapse to a generic line. The specific error is logged
 * server-side for whoever is debugging the deployment.
 */

const SIGN_IN_FAILED = "That email and password don't match an account.";
const GENERIC_SIGN_UP = "That account could not be created. Try again.";
const RATE_LIMITED = "Too many attempts just now. Wait a moment and try again.";

function isRateLimited(error: AuthError): boolean {
  return error.status === 429 || (error.code ?? "").includes("rate_limit");
}

export function signInMessage(error: AuthError): string {
  if (isRateLimited(error)) return RATE_LIMITED;
  if (error.code === "email_not_confirmed") {
    return "Confirm your email address first — check your inbox for the link.";
  }
  /**
   * Every other failure — wrong password, no such account, disabled user —
   * returns one identical message on purpose. Distinguishing them would let
   * anyone test which email addresses have BridgeBoard accounts.
   */
  return SIGN_IN_FAILED;
}

export function signUpMessage(error: AuthError): string {
  if (isRateLimited(error)) return RATE_LIMITED;
  if (error.code === "weak_password") {
    return "Choose a longer or less common password.";
  }
  if (error.code === "email_address_invalid") {
    return "That email address doesn't look valid.";
  }
  return GENERIC_SIGN_UP;
}

/**
 * Server-side breadcrumb. Records the provider's own code so a deployment
 * problem is diagnosable, without that text ever reaching the response.
 */
export function logAuthFailure(scope: string, error: AuthError): void {
  console.warn(`[auth] ${scope} failed`, { code: error.code, status: error.status });
}
