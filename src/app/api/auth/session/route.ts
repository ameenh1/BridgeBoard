import { authJson, createAuthClient } from "@/lib/auth/supabaseServer";
import { getAuthUser } from "@/lib/auth/session";
import type { AuthResult } from "@/types/auth";

/**
 * GET /api/auth/session
 *
 * Who, if anyone, is signed in on this device. Answers 200 in every case:
 * "nobody is signed in" is a normal state in BridgeBoard, not an error, and
 * the shell uses this only to decide what to show in the header.
 *
 * This is also where a refresh token gets exchanged when the access token has
 * expired — `getUser()` triggers it and `setAll` writes the rotated cookies,
 * which is why no Proxy is needed to keep sessions alive.
 */
export async function GET(): Promise<Response> {
  const auth = await createAuthClient();
  if (!auth) {
    return authJson({ status: "unavailable" } satisfies AuthResult, null);
  }

  const user = await getAuthUser(auth);
  return authJson(
    (user ? { status: "signed_in", user } : { status: "anonymous" }) satisfies AuthResult,
    auth,
  );
}
