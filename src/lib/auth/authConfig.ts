import "server-only";

/**
 * Auth configuration, read server-side only.
 *
 * The publishable key is designed to be public, but it is deliberately *not*
 * exposed as `NEXT_PUBLIC_`. BridgeBoard's browser bundle never constructs a
 * Supabase client: credentials are posted to a route handler and the session
 * is held in httpOnly cookies. Keeping the key server-side means there is no
 * Supabase surface in the browser at all, which is one less thing to reason
 * about when auditing what a caregiver's tablet can reach.
 *
 * Absent configuration is a supported state, not an error. BridgeBoard must
 * stay usable with no credentials of any kind, so every caller treats `null`
 * as "accounts are unavailable, continue locally" rather than as a failure.
 */
export type AuthConfig = {
  url: string;
  publishableKey: string;
};

export function getAuthConfig(): AuthConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function isAuthConfigured(): boolean {
  return getAuthConfig() !== null;
}
