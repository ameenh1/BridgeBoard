import "server-only";
import { cache } from "react";
import { createAuthClient, type AuthClient } from "./supabaseServer";

/**
 * The only shape of a signed-in person that ever leaves the server.
 *
 * Deliberately two fields. Supabase's user object carries provider metadata,
 * raw app metadata, timestamps and an `identities` array; none of that is
 * needed to render "signed in as …", and BridgeBoard's profile contract is
 * explicit that no demographic or medical data is stored against a person.
 * Narrowing here means a future careless `res.json(user)` cannot leak fields
 * nobody deliberately chose to expose.
 */
export type AuthUser = {
  id: string;
  email: string;
};

export function toAuthUser(user: { id: string; email?: string | null }): AuthUser {
  return { id: user.id, email: user.email ?? "" };
}

/**
 * Resolves the current user, or `null` when nobody is signed in, Supabase is
 * unconfigured, or the auth service cannot be reached.
 *
 * All three collapse to `null` on purpose. A caller's only question is "do I
 * have an account to attribute this to?", and BridgeBoard's answer when auth
 * is unavailable must be "carry on without one" — never an error surface that
 * could stand between a child and their board.
 *
 * `getUser()` is used rather than `getSession()` because it revalidates the
 * token with the auth server instead of trusting the cookie's contents.
 */
export async function getAuthUser(auth?: AuthClient | null): Promise<AuthUser | null> {
  const resolved = auth ?? (await createAuthClient());
  if (!resolved) return null;

  try {
    const { data, error } = await resolved.client.auth.getUser();
    if (error || !data.user) return null;
    return toAuthUser(data.user);
  } catch {
    return null;
  }
}

/**
 * Request-scoped memo, so several Server Components asking "who is this?"
 * during one render cost a single round trip.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => getAuthUser());
