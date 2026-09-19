/**
 * Demo mode short-circuits known prompts to deterministic boards before any
 * model call. It is a reliability feature, not a shortcut: conference wifi and
 * rate limits are real, and the demo has to survive both.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_APP_MODE === "demo";
}

/** Reported by /api/health so we can tell which mode a deployment is in. */
export function getAppMode(): string {
  return process.env.NEXT_PUBLIC_APP_MODE ?? "live";
}
