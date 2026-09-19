import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getAuthConfig } from "./authConfig";

/**
 * A per-request Supabase auth client bound to Next's cookie store.
 *
 * Never cache or share one of these across requests. The client accumulates
 * the response headers that must accompany a cookie write, and reusing it
 * would leave a later response without them — see `pendingHeaders` below.
 */
export type AuthClient = {
  client: SupabaseClient;
  /**
   * Headers `@supabase/ssr` requires on any response that sets auth cookies:
   * `Cache-Control: private, no-store`, `Expires: 0`, `Pragma: no-cache`.
   *
   * These are not optional hygiene. Without them a CDN or reverse proxy is
   * free to cache a response carrying a `Set-Cookie` session token and serve
   * it to the next person who asks — handing one caregiver's session to a
   * stranger. Always spread them onto the response via `authJson`.
   */
  pendingHeaders: Record<string, string>;
};

/**
 * Returns `null` when Supabase is unconfigured rather than throwing, so the
 * caller can answer "accounts are unavailable" instead of failing the request.
 */
export async function createAuthClient(): Promise<AuthClient | null> {
  const config = getAuthConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  const pendingHeaders: Record<string, string> = {};

  const client = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet, headers) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, {
              ...options,
              /**
               * The library defaults this to false because it expects a
               * browser-side Supabase client to read the tokens. Ours never
               * does, so we can close the door: with httpOnly set, injected
               * script cannot read the access or refresh token even if
               * something manages to run on the page.
               */
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
            });
          }
        } catch {
          /**
           * Thrown when called during a Server Component render, where the
           * response is already committed. Every auth flow here runs in a
           * route handler, which can set cookies, so reaching this branch
           * means a refresh was skipped — not that the session is invalid.
           */
        }
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  return { client, pendingHeaders };
}

/**
 * JSON response that carries any cache-control headers the auth cookie write
 * demanded. Use this for every response from an auth route.
 */
export function authJson(
  body: unknown,
  auth: Pick<AuthClient, "pendingHeaders"> | null,
  init: ResponseInit = {},
): Response {
  return Response.json(body, {
    ...init,
    headers: { ...auth?.pendingHeaders, ...init.headers },
  });
}
