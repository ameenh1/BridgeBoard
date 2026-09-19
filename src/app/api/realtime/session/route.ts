import { createOpenAIRealtimeSession } from "@/lib/speech/openaiRealtimeServer";
import { getAIAllowedVocabulary } from "@/lib/vocabulary/vocabularyHelpers";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType !== "application/sdp") {
    return Response.json({ error: "expected_sdp" }, { status: 415 });
  }
  const sdp = await request.text();
  if (!sdp.trim() || sdp.length > 100_000) {
    return Response.json({ error: "invalid_sdp" }, { status: 400 });
  }
  try {
    const answer = await createOpenAIRealtimeSession({
      sdp,
      signal: request.signal,
      keywords: getAIAllowedVocabulary().map((item) => item.label).slice(0, 100),
    });
    return new Response(answer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/sdp",
      },
    });
  } catch (error) {
    const unconfigured = error instanceof Error && error.message === "realtime_unconfigured";
    console.error("[realtime-session] creation failed", unconfigured ? "unconfigured" : "upstream_error");
    return Response.json(
      { error: unconfigured ? "realtime_unconfigured" : "realtime_unavailable" },
      { status: unconfigured ? 503 : 502 },
    );
  }
}
