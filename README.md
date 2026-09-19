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
OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-live-transcribe
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

`resolveVisualAssets()` classifies the current finalized utterance with a bounded recent context window, checks local and shared caches, emits a local symbol immediately on a miss, and starts web discovery and image generation concurrently. The first validated image is cached and emitted as a `ready` event.

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

## Realtime caregiver microphone

The browser-safe `createRealtimeTranscriptionController()` connects the microphone through WebRTC to OpenAI's Realtime API. The server-only `createOpenAIRealtimeTranscriptionSession()` receives the browser SDP offer and calls `/v1/realtime/calls`; the normal OpenAI API key never reaches the browser. The session uses `gpt-realtime-2.1-mini` as the WebRTC session model and `gpt-live-transcribe` for input transcription, with automatic assistant responses disabled. Override either model through the environment variables above.

The repository includes a runnable local demo that connects the full flow:

```powershell
npm run demo:realtime
```

Open `http://localhost:3000`, allow microphone access, and say one of these:

- “Do you want your blue cup or red cup?”
- “Do you want waffles or pancakes?”

The demo shows the partial transcript, finalized caregiver utterance, approved classification, local visual symbols immediately, and web/generated/cache replacements as they arrive. It keeps a process hot cache and ignores stale asset streams when caregiver turns arrive quickly. The demo also has typed transcript buttons, so the classifier and fallback UI can be tested without an API key. A real `OPENAI_API_KEY` is required for microphone transcription, web discovery, and image generation. Supabase cache hits require the migration, Storage bucket, and server-only Supabase variables described above.

For the automated local checks:

```powershell
npm test
npm run typecheck
npm audit --omit=dev
```

The production frontend should use the same controller and point `sessionEndpoint` at an authenticated application route. Do not expose the local demo server publicly without adding authentication and rate limiting.

## Safety and boundaries

- The model returns approved IDs, not arbitrary labels or URLs.
- Invalid IDs, ambiguous input, model errors, and unavailable services use fallback behavior.
- Web candidates must be HTTPS images from configured domains and pass byte/signature/size validation.
- OpenAI and Supabase server clients must not be imported into browser code.
- The asset resolver is automatic for the current demo; it does not infer a communicator's choice.
