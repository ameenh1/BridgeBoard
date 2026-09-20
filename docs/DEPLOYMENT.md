# BridgeBoard deployment

BridgeBoard is a Next.js application deployed to the Vercel project
bridgeboard in the ameens-projects-75c66f34 team. The public Production alias
is https://bridgeboard-two.vercel.app.

## Prerequisites

- Node.js 22.12 or newer. The current Vercel project uses Node 24.x.
- Access to the Vercel team and the bridgeboard project.
- A checked-out working tree containing the intended changes.
- Supabase access when provisioning or inspecting the shared image cache.

Install dependencies and run the full local gate before deploying:

```bash
npm ci
npm run verify
git diff --check
```

npm run verify runs typechecking, linting, all tests, the bundled-image check,
smoke checks, a production build, and a production dependency audit. If npm
audit returns a transient registry HTTP 503, retry the unchanged command before
treating the audit as failed.

## Environment variables

Never commit .env.local or copy secret values into this document. Keep OpenAI
and Supabase service-role credentials server-only. A NEXT_PUBLIC_ prefix exposes
a value to the browser bundle.

### Required for the live AI and image pipeline

Set these in Vercel with the correct environment scope:

| Variable | Scope | Purpose |
|---|---|---|
| OPENAI_API_KEY | Production, and Preview only when intentionally testing AI | Classification, Realtime, and image providers |
| ASSET_STREAM_SECRET | Production, and Preview only when intentionally testing image streams | Signs the short-lived /api/resolve-assets token |
| SUPABASE_URL | Production, and Preview only when intentionally using the shared cache | Server-side Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Production, and Preview only when intentionally using the shared cache | Server-only cache and Storage access |

The private Storage bucket is bridgeboard-ai-assets. Store application
metadata in public.ai_asset_cache; do not write application data into
Supabase's internal Storage schema.

### Account and optional settings

The account routes use SUPABASE_PUBLISHABLE_KEY server-side, with
NEXT_PUBLIC_SUPABASE_ANON_KEY supported as the compatibility fallback. The
browser-safe Supabase URL is NEXT_PUBLIC_SUPABASE_URL. These public values are
not substitutes for the service-role key.

Optional variables include ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID,
AI_IMAGE_GENERATION_ENABLED, AI_ASSET_SEARCH_ENABLED,
AI_ALLOWED_IMAGE_DOMAINS, AI_ASSET_MAX_BYTES, AI_ASSET_OUTPUT_MAX_BYTES,
SUPABASE_ASSET_BUCKET, and SUPABASE_SIGNED_URL_TTL_SECONDS. Paid web image
search must remain disabled unless it is explicitly wanted:

```text
AI_ASSET_SEARCH_ENABLED=false
AI_IMAGE_GENERATION_ENABLED=true
```

To inspect names and scopes without revealing values:

```bash
npx vercel@latest env ls \
  --project bridgeboard \
  --scope ameens-projects-75c66f34
```

Be careful with vercel env pull: it replaces the destination file. Do not pull
Production variables over a working .env.local without first preserving
local-only values.

## Configure a signing secret

Generate the secret locally and pipe it directly to Vercel. It is not printed
or stored in the repository:

```bash
node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' |
  npx vercel@latest env add ASSET_STREAM_SECRET production \
    --project bridgeboard \
    --scope ameens-projects-75c66f34 \
    --force --sensitive --yes
```

Use a separate secret for Preview if Preview image streams are needed. Do not
reuse a Production secret in a less-trusted environment.

## Production deployment

Deploy from the repository root. This performs a fresh Vercel build and
updates the Production alias:

```bash
npx vercel@latest deploy --prod --yes \
  --project bridgeboard \
  --scope ameens-projects-75c66f34
```

Wait for the deployment to report READY before declaring it live. Inspect the
build duration, framework, aliases, and target:

```bash
npx vercel@latest inspect <deployment-url> \
  --scope ameens-projects-75c66f34
```

For a safe Preview first:

```bash
npx vercel@latest deploy --yes \
  --project bridgeboard \
  --scope ameens-projects-75c66f34
```

A Preview does not change Production. Promote only an already-verified
deployment:

```bash
npx vercel@latest promote <deployment-url> \
  --scope ameens-projects-75c66f34
```

## Post-deploy verification

Check the public page and capability health without exposing environment
values:

```bash
curl -fsS https://bridgeboard-two.vercel.app/
curl -fsS https://bridgeboard-two.vercel.app/api/health
```

The health response should report ok true and these capability values:

```json
{
  "classifier": "live",
  "assetProviders": "configured",
  "assetStream": "configured",
  "sharedCache": "configured"
}
```

Then submit a representative question and confirm that the response includes
an assetStream descriptor. Consume the NDJSON stream with Node rather than
PowerShell Invoke-WebRequest, which can print streamed bytes as a huge decimal
sequence:

```bash
node --input-type=module <<'NODE'
const base = "https://bridgeboard-two.vercel.app";
const question = "Would you like waffles, pancakes, basketball, or tennis?";
const classified = await fetch(base + "/api/classify-question", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    questionText: question,
    profile: { id: "production-smoke", maxChoices: 8, visuals: "photos_first" },
  }),
});
if (!classified.ok) throw new Error("classify returned " + classified.status);
const payload = await classified.json();
if (!payload.assetStream) throw new Error("asset stream is missing");

const labels = new Map(payload.board.choices.map((choice) => [choice.id, choice.label]));
const stream = await fetch(base + payload.assetStream.endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: payload.assetStream.token, skipAssetKeys: [] }),
});
if (!stream.ok || !stream.body) throw new Error("asset stream returned " + stream.status);

const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of stream.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === "complete") {
      console.log("complete");
    } else {
      console.log(labels.get(event.choiceId) ?? event.choiceId, event.status, event.source ?? "-");
    }
  }
}
NODE
```

For Production runtime logs, look for successful resolver requests and no
warnings or errors:

```bash
npx vercel@latest logs \
  --project bridgeboard \
  --scope ameens-projects-75c66f34 \
  --environment production \
  --since 30m
```

Verify that /api/resolve-assets returns HTTP 200. A repeated question should
resolve already-stored images from the Supabase cache instead of generating
duplicates.

## Git workflow

Run verification before committing and push the branch that was reviewed:

```bash
git status --short
npm run verify
git diff --check
git add -A
git commit -m "Document deployment and stabilize AI notifications"
git push origin main
```

Do not use git reset --hard, overwrite another developer's changes, or push an
unverified branch. If the repository is on a different branch, replace main
with that branch after confirming the intended remote target.

## Rollback

If the Production deployment fails after reaching READY, inspect the logs
first. Roll back to the previous known-good deployment:

```bash
npx vercel@latest rollback \
  --scope ameens-projects-75c66f34
```

After a rollback, recheck /, /api/health, and the Production logs. Do not
promote a Preview or change Supabase schema or buckets as an emergency
workaround without separately verifying the data and authorization boundary.
