# BridgeBoard AI layer

BridgeBoard turns finalized caregiver context into a constrained set of approved AAC vocabulary IDs, then resolves the corresponding visuals from local cache, Supabase Storage, web candidates, or generated assets. It never claims to know the communicator's thoughts or intended response.

This branch contains the framework-neutral AI and asset pipeline. The Figma Make frontend can consume the browser-safe exports from `lib/index.ts`; server integrations use `lib/server.ts`.

## Setup

Requires Node.js 20+ and npm.

```bash
npm install
Copy-Item .env.example .env.local
npm test
npm run typecheck
```

Put the real OpenAI key in the root `.env.local` file:

```env
OPENAI_API_KEY=your_key_here
OPENAI_TEXT_MODEL=gpt-5.6-luna
OPENAI_SEARCH_MODEL=gpt-5.6-luna
OPENAI_IMAGE_MODEL=gpt-image-2.5-flare
```

Never use a `NEXT_PUBLIC_` prefix and never commit `.env.local`. Live calls are disabled by setting `AI_LIVE_CLASSIFIER_ENABLED=false`, `AI_ASSET_SEARCH_ENABLED=false`, or `AI_IMAGE_GENERATION_ENABLED=false`.

## Supabase asset cache

The migration at `supabase/migrations/20260918000000_ai_asset_cache.sql` creates the application metadata table. Image bytes belong in a private Storage bucket named `bridgeboard-ai-assets`; create it once through the Supabase dashboard or call `ensureSupabaseAssetBucket()` from a server-only setup task.

Server configuration requires:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server_only_key
SUPABASE_ASSET_BUCKET=bridgeboard-ai-assets
```

The service-role key is never sent to the browser.

## Runtime flow

`resolveVisualAssets()` classifies the current finalized utterance with a bounded recent context window, checks local and shared caches, emits a placeholder immediately on a miss, and starts web discovery and image generation concurrently. The first validated image is cached and emitted as a `ready` event.

```ts
import {
  createOpenAIAssetProviders,
  createSupabaseAssetCache,
  resolveVisualAssets
} from "./lib/server.js";

const result = await resolveVisualAssets({
  transcript: "Do you want your blue cup or red cup?",
  recentContext: [],
  providers: createOpenAIAssetProviders(),
  sharedCache: createSupabaseAssetCache(),
  onEvent: (event) => sendToFrontend(event)
});

await result.pending;
```

## Safety and boundaries

- The model returns approved IDs, not arbitrary labels or URLs.
- Invalid IDs, ambiguous input, model errors, and unavailable services use fallback behavior.
- Web candidates must be HTTPS images from configured domains and pass byte/signature/size validation.
- OpenAI and Supabase server clients must not be imported into browser code.
- The asset resolver is automatic for the current demo; it does not infer a communicator's choice.
