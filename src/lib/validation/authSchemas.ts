import { z } from "zod";

/**
 * Credential request validation.
 *
 * Same stance as `requestSchemas.ts`: the browser is an external boundary.
 * These bounds exist so a malformed or hostile body is rejected before it
 * reaches the auth service, not to second-guess Supabase's own rules.
 */

/**
 * Upper bounds matter more than lower ones here. bcrypt-family hashes
 * truncate or choke on very long inputs, so an unbounded password field is a
 * cheap way to burn server CPU; 72 bytes is the practical ceiling Supabase
 * enforces anyway.
 */
/**
 * Trim and lowercase *before* validating, not after. `z.email().trim()` runs
 * the format check first, so a trailing space — which mobile keyboards and
 * autofill add constantly — would be rejected as a malformed address.
 */
const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("That email address doesn't look valid.").max(254));

export const CredentialsSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8, "Use at least 8 characters.").max(72),
});

export type Credentials = z.infer<typeof CredentialsSchema>;

/**
 * Login accepts any non-empty password. Applying the 8-character signup rule
 * to sign-in would tell an attacker that no account can exist with a shorter
 * password, and would lock out anyone who registered under older rules.
 */
export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(72),
});

export type LoginRequest = z.infer<typeof LoginSchema>;
