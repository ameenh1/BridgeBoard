import { existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates the private Storage bucket the shared image cache writes into, and
 * reports whether the metadata table exists.
 *
 * Without the bucket every cache write fails with "Bucket not found". That
 * failure is swallowed by design — a dead cache must never fail a board — so
 * the only symptom is that generated images are re-generated on every cold
 * start instead of being served from Supabase. On a serverless deploy, where
 * the in-process cache dies with each instance, that means paying the full
 * generation cost on essentially every request.
 *
 *   npm run supabase:setup-assets
 *
 * Safe to re-run: the bucket is only created when it is missing.
 *
 * Deliberately standalone. It does not import src/lib/assets/supabaseAssetCache
 * because that module starts with `import "server-only"`, which Next resolves
 * through its own bundler alias and which throws outside that context.
 */

const DEFAULT_BUCKET = "bridgeboard-ai-assets";
const TABLE = "ai_asset_cache";

/** Next loads .env.local for us; a standalone tsx script has to do it itself. */
function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (existsSync(full)) {
      process.loadEnvFile(full);
      return;
    }
  }
}

async function main(): Promise<void> {
  loadLocalEnv();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Add them to .env.local.",
    );
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const bucket = process.env.SUPABASE_ASSET_BUCKET ?? DEFAULT_BUCKET;

  const { data: existing, error: getError } = await client.storage.getBucket(bucket);
  if (existing) {
    console.log(`bucket   ok       ${bucket} (already present, public=${existing.public})`);
  } else {
    if (getError && !/not found/i.test(getError.message)) throw getError;
    const { error } = await client.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: Number(process.env.AI_ASSET_MAX_BYTES ?? 5 * 1024 * 1024),
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
    if (error && !/already exists/i.test(error.message)) throw error;
    console.log(`bucket   created  ${bucket} (private)`);
  }

  // The bucket alone is not enough: bytes go to Storage, metadata to this
  // table. Report it rather than create it — the schema is a checked-in
  // migration, not something a setup script should invent.
  const { error: tableError } = await client.from(TABLE).select("cache_key").limit(1);
  if (tableError) {
    console.log(`table    MISSING  public.${TABLE} — ${tableError.message}`);
    console.log(
      `\nApply the migration before the cache can work:\n` +
        `  supabase/migrations/20260919171956_ai_asset_cache.sql\n` +
        `Run it in the Supabase dashboard SQL editor, or with the Supabase CLI.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`table    ok       public.${TABLE}`);
  console.log("\nShared image cache is ready.");
}

// Wrapped rather than top-level await: tsx compiles these scripts as CJS,
// where top-level await throws ERR_REQUIRE_ASYNC_MODULE.
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
