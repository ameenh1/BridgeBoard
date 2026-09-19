import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthError } from "@supabase/supabase-js";
import { getAuthConfig, isAuthConfigured } from "@/lib/auth/authConfig";
import { signInMessage, signUpMessage } from "@/lib/auth/authMessages";
import { toAuthUser } from "@/lib/auth/session";
import { CredentialsSchema, LoginSchema } from "@/lib/validation/authSchemas";

/** Only `code` and `status` are read by the message mappers. */
function authError(code: string, status = 400): AuthError {
  return { code, status, name: "AuthApiError", message: `raw provider text: ${code}` } as AuthError;
}

describe("credential validation", () => {
  it("normalises the email before validating it", () => {
    // Mobile keyboards and autofill routinely append a space and capitalise
    // the first letter. Neither should read as an invalid address, and both
    // must land on the same account.
    const parsed = CredentialsSchema.safeParse({
      email: "  Caregiver@Example.com  ",
      password: "correct horse battery",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.email).toBe("caregiver@example.com");
  });

  it("normalises sign-in the same way, so case cannot split an account", () => {
    const parsed = LoginSchema.safeParse({ email: "CAREGIVER@EXAMPLE.COM", password: "pw" });
    expect(parsed.data?.email).toBe("caregiver@example.com");
  });

  it("requires at least 8 characters when signing up", () => {
    const parsed = CredentialsSchema.safeParse({ email: "a@b.co", password: "short" });
    expect(parsed.success).toBe(false);
  });

  it("caps the password so an unbounded body cannot burn hashing CPU", () => {
    const parsed = CredentialsSchema.safeParse({
      email: "a@b.co",
      password: "x".repeat(5000),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed body outright", () => {
    expect(CredentialsSchema.safeParse(null).success).toBe(false);
    expect(CredentialsSchema.safeParse({ email: "not-an-email", password: "aaaaaaaa" }).success).toBe(
      false,
    );
  });

  it("does not impose the signup length rule on sign-in", () => {
    // Enforcing it here would reveal that no account can have a shorter
    // password, and would lock out anyone registered under older rules.
    expect(LoginSchema.safeParse({ email: "a@b.co", password: "old" }).success).toBe(true);
    expect(LoginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("auth messages", () => {
  it("cannot be used to discover which emails have accounts", () => {
    // Wrong password and no-such-account must be indistinguishable.
    const wrongPassword = signInMessage(authError("invalid_credentials"));
    const noSuchUser = signInMessage(authError("user_not_found"));
    const disabled = signInMessage(authError("user_banned"));
    expect(wrongPassword).toBe(noSuchUser);
    expect(noSuchUser).toBe(disabled);
  });

  it("never passes provider text through to the caregiver", () => {
    const messages = [
      signInMessage(authError("invalid_credentials")),
      signInMessage(authError("email_not_confirmed")),
      signUpMessage(authError("weak_password")),
      signUpMessage(authError("something_unmapped")),
      signUpMessage(authError("over_email_send_rate_limit", 429)),
    ];
    for (const message of messages) {
      expect(message).not.toContain("raw provider text");
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("distinguishes rate limiting, which is actionable, from a bad password", () => {
    expect(signInMessage(authError("over_request_rate_limit", 429))).not.toBe(
      signInMessage(authError("invalid_credentials")),
    );
  });
});

describe("the user DTO", () => {
  it("drops every field except id and email", () => {
    const user = toAuthUser({
      id: "user-1",
      email: "caregiver@example.com",
      // Fields Supabase really returns, none of which should escape.
      ...({
        phone: "+15555550123",
        app_metadata: { provider: "email" },
        user_metadata: { note: "sensitive" },
        identities: [{ id: "x" }],
      } as object),
    });
    expect(user).toEqual({ id: "user-1", email: "caregiver@example.com" });
    expect(Object.keys(user)).toHaveLength(2);
  });

  it("tolerates a user with no email rather than throwing", () => {
    expect(toAuthUser({ id: "user-2" })).toEqual({ id: "user-2", email: "" });
  });
});

describe("configuration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports unconfigured when either value is missing, instead of throwing", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    expect(getAuthConfig()).toBeNull();
    expect(isAuthConfigured()).toBe(false);

    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    expect(isAuthConfigured()).toBe(false);
  });

  it("is configured only when both are present", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(isAuthConfigured()).toBe(true);
    expect(getAuthConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });
});
