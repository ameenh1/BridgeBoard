# BridgeBoard

BridgeBoard is a Next.js backend for turning finalized caregiver questions into immediately usable AAC boards. Text, speech, icons, and support actions are returned first; web or generated images upgrade individual choices through a separate stream without blocking or clearing the board.

## Local setup

Requires Node.js 22.12 or newer.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY`, the OpenAI model variables, and a strong `ASSET_STREAM_SECRET` in `.env.local`. None of these variables may use a `NEXT_PUBLIC_` prefix.

The optional shared cache uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a private `bridgeboard-ai-assets` bucket. Apply the checked-in migration, then run:

```powershell
npm run supabase:setup-assets
```

If Supabase is absent or unavailable, classification and live image resolution continue without the shared cache.

## Routes

- `POST /api/classify-question` returns the immediately usable board and an optional signed asset-stream descriptor.
- `POST /api/resolve-assets` streams per-choice NDJSON image updates.
- `POST /api/realtime/session` exchanges a WebRTC SDP offer for a server-created OpenAI Realtime session.
- `GET /api/health` reports configured capabilities without exposing secrets.

See [AI backend integration](docs/AI_BACKEND_INTEGRATION.md) for the frontend contract and stable-board behavior.

## Verification

```powershell
npm run verify
```

The command runs typecheck, lint, unit tests, production smoke checks, a Next.js production build, and a production dependency audit.
