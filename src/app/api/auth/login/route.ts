import { authJson, createAuthClient } from "@/lib/auth/supabaseServer";
import { logAuthFailure, signInMessage } from "@/lib/auth/authMessages";
import { toAuthUser } from "@/lib/auth/session";
import { LoginSchema } from "@/lib/validation/authSchemas";
import type { AuthResult } from "@/types/auth";

/**
 * POST /api/auth/login
 *
 * Exchanges credentials for a session cookie. The browser never sees a token:
 * `@supabase/ssr` writes the access and refresh tokens as httpOnly cookies
 * through the client built in `createAuthClient`.
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
    // Handled by the schema below.
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return authJson(
      { status: "error", message: "Enter an email address and password." } satisfies AuthResult,
      auth,
      { status: 400 },
    );
  }

  try {
    const { data, error } = await auth.client.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      if (error) logAuthFailure("login", error);
      return authJson(
        {
          status: "error",
          message: error ? signInMessage(error) : "That email and password don't match an account.",
        } satisfies AuthResult,
        auth,
        { status: 401 },
      );
    }

    return authJson(
      { status: "signed_in", user: toAuthUser(data.user) } satisfies AuthResult,
      auth,
    );
  } catch (error) {
    console.warn("[auth] login unreachable", error instanceof Error ? error.message : error);
    return authJson({ status: "unavailable" } satisfies AuthResult, auth, { status: 503 });
  }
}
