import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Pre-generates the images a demo will ask for, so they come from the shared
 * cache instead of an image model when it matters.
 *
 * A cold concept costs 11-15s and one image-model call. A cached one costs
 * about 2s and none. Running this before a demo turns every board in the
 * script warm, and because the cache is shared the warmth follows the project
 * to any machine or deployment pointed at the same Supabase project.
 *
 *   npm run cache:warm                       # the built-in demo script
 *   npm run cache:warm -- "Juice or milk?"   # specific questions
 *   npm run cache:warm -- --url https://bridgeboard.vercel.app
 *
 * Safe to re-run: already-cached concepts are simply confirmed, fast.
 */

/**
 * The questions a demo is most likely to ask. Each one exercises a different
 * path: a catalog word paired with a novel one, feelings, body needs, and a
 * question the classifier should decline rather than guess at.
 */
const DEMO_QUESTIONS = [
  "Would you like waffles or dragon fruit?",
  "Would you like waffles or pancakes?",
  "How are you feeling?",
  "Do you want water or juice?",
  "Do you need the bathroom or a break?",
  "Do you want to play outside or read a book?",
];

type Args = { baseUrl: string; questions: string[] };

function parseArgs(argv: string[]): Args {
  let baseUrl = process.env.WARM_CACHE_URL ?? "http://localhost:3000";
  const questions: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--url") {
      baseUrl = argv[i + 1] ?? baseUrl;
      i += 1;
    } else {
      questions.push(argv[i]);
    }
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    questions: questions.length > 0 ? questions : DEMO_QUESTIONS,
  };
}

function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (existsSync(full)) {
      process.loadEnvFile(full);
      return;
    }
  }
}

type Outcome = { label: string; source: string; seconds: number };

async function warmOne(baseUrl: string, question: string): Promise<Outcome[]> {
  const started = Date.now();
  const response = await fetch(`${baseUrl}/api/classify-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionText: question,
      profile: { id: "cache-warm", maxChoices: 6, visuals: "photos_first" },
    }),
  });
  if (!response.ok) throw new Error(`classify returned ${response.status}`);

  const payload = (await response.json()) as {
    board: { choices: { label: string }[]; isFallback: boolean };
    assetStream?: { endpoint: string; token: string };
  };

  if (payload.board.isFallback) return [{ label: "(fallback board)", source: "-", seconds: 0 }];
  if (!payload.assetStream) {
    // Everything already had bundled artwork, or nothing needed resolving.
    return payload.board.choices.map((choice) => ({
      label: choice.label,
      source: "bundled",
      seconds: 0,
    }));
  }

  const stream = await fetch(`${baseUrl}${payload.assetStream.endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: payload.assetStream.token, skipAssetKeys: [] }),
  });
  if (!stream.ok || !stream.body) throw new Error(`asset stream returned ${stream.status}`);

  const byChoiceId = new Map(
    payload.board.choices.map((choice, index) => [String(index), choice.label]),
  );
  const outcomes: Outcome[] = [];
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: { type?: string; choiceId?: string; source?: string; status?: string };
      try {
        event = JSON.parse(line) as typeof event;
      } catch {
        continue;
      }
      if (event.type === "complete" || !event.choiceId) continue;
      outcomes.push({
        label: byChoiceId.get(event.choiceId) ?? event.choiceId,
        source: event.status === "unavailable" ? "unavailable" : (event.source ?? "?"),
        seconds: (Date.now() - started) / 1000,
      });
    }
  }
  return outcomes;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const { baseUrl, questions } = parseArgs(process.argv.slice(2));

  const health = await fetch(`${baseUrl}/api/health`).catch(() => null);
  if (!health?.ok) {
    throw new Error(`No app at ${baseUrl}. Start it with \`npm run dev\`, or pass --url.`);
  }
  const status = (await health.json()) as { classifier: string; sharedCache: string };
  console.log(`target       ${baseUrl}`);
  console.log(`classifier   ${status.classifier}`);
  console.log(`shared cache ${status.sharedCache}`);
  if (status.sharedCache !== "configured") {
    console.log(
      "\nWARNING: the shared cache is not configured, so nothing warmed here\n" +
        "survives a restart. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY,\n" +
        "then run `npm run supabase:setup-assets`.",
    );
  }
  console.log();

  let generated = 0;
  let cached = 0;
  for (const question of questions) {
    process.stdout.write(`${question}\n`);
    try {
      const outcomes = await warmOne(baseUrl, question);
      for (const outcome of outcomes) {
        if (outcome.source === "cache") cached += 1;
        if (outcome.source === "generated" || outcome.source === "web") generated += 1;
        console.log(
          `   ${outcome.label.slice(0, 28).padEnd(30)} ${outcome.source.padEnd(12)} ${outcome.seconds.toFixed(1)}s`,
        );
      }
    } catch (error) {
      console.log(`   failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
    console.log();
  }

  console.log(`${generated} newly resolved, ${cached} already cached.`);
  console.log("Re-run to confirm everything now reports `cache`.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
