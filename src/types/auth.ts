/**
 * The auth contract shared by the route handlers and the client shell.
 *
 * Mirrors how `RenderableBoard` works: the browser receives a small, closed
 * set of outcomes it can switch on, never a raw provider payload or error
 * string. Every message below is written by us and safe to show a caregiver.
 */

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthResult =
  /** Signed in; the session cookie is set. */
  | { status: "signed_in"; user: AuthUser }
  /** Account created but Supabase requires the address to be confirmed. */
  | { status: "confirm_email" }
  /** Signed out; the session cookie is cleared. */
  | { status: "signed_out" }
  /** No account, and none is needed — the local path is still open. */
  | { status: "anonymous" }
  /**
   * Accounts are not available right now: no credentials configured, or the
   * auth service could not be reached. Distinct from `error` because the
   * caregiver did nothing wrong and retrying the form will not help.
   */
  | { status: "unavailable" }
  /** Something the caregiver can act on, with a message we authored. */
  | { status: "error"; message: string };

export function isSignedIn(result: AuthResult): result is { status: "signed_in"; user: AuthUser } {
  return result.status === "signed_in";
}
