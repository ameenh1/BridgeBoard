import { authJson, createAuthClient } from "@/lib/auth/supabaseServer";
import { logAuthFailure, signUpMessage } from "@/lib/auth/authMessages";
import { toAuthUser } from "@/lib/auth/session";
import { CredentialsSchema } from "@/lib/validation/authSchemas";
import type { AuthResult } from "@/types/auth";

/**
 * POST /api/auth/signup
 *
 * Creates an account. Accounts are an optional convenience in BridgeBoard —
 * failure here never blocks communication, it just leaves the caregiver on
 * the local path.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await createAuthClient();
  if (!auth) {
    return authJson({ status: "unavailable" } satisfies AuthResult, null, { status: 503 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Left null; the schema rejects it below with the same message as any
    // other malformed payload.
  }

  const parsed = CredentialsSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check the email and password.";
    return authJson({ status: "error", message } satisfies AuthResult, auth, { status: 400 });
  }

  try {
    const { data, error } = await auth.client.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      logAuthFailure("signup", error);
      return authJson(
        { status: "error", message: signUpMessage(error) } satisfies AuthResult,
        auth,
        { status: 400 },
      );
    }

    // Confirmations off: Supabase returns a live session and the cookie is
    // already written by the client's setAll.
    if (data.session && data.user) {
      return authJson(
        { status: "signed_in", user: toAuthUser(data.user) } satisfies AuthResult,
        auth,
      );
    }

    /**
     * No session means confirmation is required. This branch is also what an
     * already-registered address produces (Supabase returns a user with an
     * empty `identities` array rather than admitting the account exists), and
     * we deliberately answer both identically so the form cannot be used to
     * discover who has an account.
     */
    return authJson({ status: "confirm_email" } satisfies AuthResult, auth);
  } catch (error) {
    console.warn("[auth] signup unreachable", error instanceof Error ? error.message : error);
    return authJson({ status: "unavailable" } satisfies AuthResult, auth, { status: 503 });
  }
}
