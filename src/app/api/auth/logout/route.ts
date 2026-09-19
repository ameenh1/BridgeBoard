import { authJson, createAuthClient } from "@/lib/auth/supabaseServer";
import type { AuthResult } from "@/types/auth";

/**
 * POST /api/auth/logout
 *
 * Always reports success. If the provider call fails the cookies are still
 * cleared locally by `signOut`, and a caregiver who pressed "Sign out" should
 * never be told they are still signed in — the visible state must match what
 * the device will do on the next request.
 *
 * POST rather than GET so a prefetch, a crawler, or an <img> tag pointed at
 * this path cannot sign someone out.
 */
export async function POST(): Promise<Response> {
  const auth = await createAuthClient();
  if (!auth) {
    return authJson({ status: "signed_out" } satisfies AuthResult, null);
  }

  try {
    await auth.client.auth.signOut();
  } catch (error) {
    console.warn("[auth] logout unreachable", error instanceof Error ? error.message : error);
  }

  return authJson({ status: "signed_out" } satisfies AuthResult, auth);
}
