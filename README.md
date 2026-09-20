# BridgeBoard

Conversation in. Choice out.

BridgeBoard is a context-aware AAC app. A caregiver asks a question or makes a
statement out loud or by typing; BridgeBoard offers a small set of relevant,
approved words with pictures. **The AI never decides what someone means** — it
proposes vocabulary ids or short response concepts, and the app owns every
label, every spoken phrase and every picture.

One Next.js application, one `npm run dev`. There is no separate frontend.

## Local setup

Requires Node.js 22.12 or newer.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Then open <http://localhost:3000>.

Set `OPENAI_API_KEY`, the OpenAI model variables, and a strong
`ASSET_STREAM_SECRET` in `.env.local`. None of these may carry a
`NEXT_PUBLIC_` prefix — there are no client-visible credentials at all.

**Without an OpenAI key the app still runs.** Login, setup, the Default AAC
board, the message composer, history and settings are fully functional
offline; the AI AAC screen reports "AI setup required" without naming which
credential is missing.

The optional shared image cache uses `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` and a private `bridgeboard-ai-assets` bucket.
Apply the checked-in migration, then:

```powershell
npm run supabase:setup-assets
```

If Supabase is absent or slow, image resolution falls back to inline data URIs.
It never blocks a board.

## How it hangs together

```
caregiver speech ─► /api/realtime/session ─► transcript
                                              │
                                              ▼
                        /api/classify-question ─► Zod ─► confidence
                        ─► allowlist/topic filter ─► maxChoices ─► trusted choices
                                              │
                                              ▼
                    RenderableBoard (text + phrase + icon, immediately usable)
                                              │
                            /api/resolve-assets ─► NDJSON ─► pictures, per tile
```

A tile is selectable and speakable the moment it appears. Pictures arrive
later and upgrade one tile at a time; nothing ever waits on an image.

### Screens

| Screen | What it is |
|---|---|
| Login | Supabase email/password account creation and sign-in. New accounts must confirm their email before signing in. |
| Default AAC | The manual 4×6 board. Works with no network. Driven by `src/lib/board/defaultBoardLayout.ts`, which holds ids only. |
| AI AAC | Live transcription and classification. The committed board stays mounted and usable while the next one loads. |
| History | Account-backed record of choices. Never includes audio. |
| Settings | Name, choices per board, picture policy, button size, labels, speech, quiet mode, rate, voice, history. |

### Where words come from

Catalog labels and spoken phrases live in
`src/lib/vocabulary/approvedVocabulary.ts`. The board layout references ids and
never restates a catalog word, so there is exactly one place a catalog word can
change. For a clear open-ended question, the model may also propose short
answer concepts. For a caregiver statement, it may propose up to four short
response concepts. The application validates those concepts, creates the
spoken phrase locally, and never treats a suggestion as the communicator's
answer.

## Routes

- `POST /api/classify-question` — returns an immediately usable board plus an
  optional signed asset-stream descriptor. Always returns a board, even when
  the classifier throws.
- `POST /api/resolve-assets` — streams per-choice NDJSON image updates against
  a signed two-minute token.
- `POST /api/realtime/session` — exchanges a WebRTC SDP offer for a
  server-created OpenAI Realtime session. The API key stays on the server.
- `GET /api/health` — reports configured capabilities without exposing secrets.

See [AI backend integration](docs/AI_BACKEND_INTEGRATION.md) for the data
contract and the stable-board rules the UI depends on.

## Artwork

The 22 bundled AAC illustrations live in `public/default-images` as WebP and
are named by `imageUrl` in the catalog. `src/lib/images/imageManifest.ts` is
generated at build time from what is actually on disk, so a catalog entry
naming an asset that was never produced renders its icon instead of a broken
image.

```powershell
npm run images:check      # what the catalog names vs what exists
npm run images:manifest   # regenerate after adding files (also runs on build)
```

## Verification

```powershell
npm run verify
```

Runs typecheck, lint, the full test suite, the image check, production smoke
checks, a production build, and a production dependency audit.

## What this will not do

It will not choose an answer, claim to know what someone wants or feels, speak
without being asked, diagnose, advise medically, remove the manual board, or
invent unsupported options when it is unsure. Clear open-ended questions may
surface validated suggestions, but communication still has to survive failure of
the AI, the network, images, the microphone, credentials and storage — so when
any of those break, the board falls back to manual instead of guessing.
