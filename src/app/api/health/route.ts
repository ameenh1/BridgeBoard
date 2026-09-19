import { getAppMode } from "@/lib/demo/demoMode";

/**
 * GET /api/health
 *
 * Deliberately boring. Reports liveness and which mode a deployment is in,
 * and nothing else — no key presence, no env contents, no versions.
 */
export async function GET(): Promise<Response> {
  return Response.json({
    ok: true,
    app: "bridgeboard",
    mode: getAppMode(),
  });
}
