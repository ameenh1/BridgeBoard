# BridgeBoard agent notes

## External integrations

- Keep OpenAI and Supabase service-role credentials server-only; never commit secrets or use `NEXT_PUBLIC_` for them.
- Verify the connector or MCP server is present and authenticated before claiming that an external project or resource was created.
- Supabase MCP is configured through Codex's shared `config.toml`. Keep the connection least-privileged and do not store passwords, access tokens, or OTPs in this repository.
- If Supabase OAuth registration fails with an invalid-scope response, remove the failed server entry, preserve the exact error, and use an authenticated Supabase dashboard session or a user-provided PAT rather than retrying blindly.
- Do not claim a Supabase project is created until its dashboard or MCP response provides a verified project reference.
- Treat Supabase memory charts as host RAM/cache/commit metrics, not table size; check database size, swap, and connection counts before changing compute.
- Keep Supabase Storage's internal schema read-only. Store image bytes in Storage and application metadata in `public.ai_asset_cache`.

## AI integration

- When renaming the caregiver input to “message,” broad accessible-name regexes can match both the textbox and microphone button; target the textbox role in UI tests. Statement replies also need their own validator so short first-person responses remain valid while instructions and medical advice are rejected.
- Keep browser code limited to contracts, Realtime control, and board/cache events. OpenAI and Supabase admin clients stay server-only.
- A board is usable before image work starts. Never clear the committed board or disable choices because classification, search, generation, or caching is pending.
- Apply image events by stable `assetKey`. A ready image never regresses to pending or unavailable, and unrelated choices never change.
- OpenAI web search results are untrusted input. Validate HTTPS and every redirect, allowed hosts, byte limits, MIME and magic bytes, then decode and re-encode before display or caching.
- Paid web image search is opt-in: require `AI_ASSET_SEARCH_ENABLED=true`; keep local and example defaults false so an unset flag cannot trigger searches.
- Use the unified Realtime WebRTC endpoint from the server route. The browser may send SDP but must never receive the standard OpenAI API key.
- Catalog `spokenPhrase` values may be sentence-style while tiles show short labels; direct tile speech uses the visible label. Browser `noiseSuppression` is Boolean and unevenly supported, so the optional dBFS voice gate stays local, defaults off, and falls back without blocking the board.
- Testing Library does not expose `screen.getByOutput` in this dependency set; use supported role or text queries for output assertions.

## Current integration note

- On 2026-09-18, OAuth dynamic registration initially failed because the server rejected Codex's default scopes. The failed entry was replaced with a bearer-token fallback, then OAuth was retried with explicit Supabase scopes after the user signed in; Codex reported successful authentication. BridgeBoard project ref `rpldjjorjscwyaubbdtq` was verified in the Supabase dashboard.

## Repository workflow

- If Git reports `Author identity unknown`, set the identity only in this repository using the authenticated GitHub profile and its no-reply address; do not guess or change global Git identity.
- npm initially reported blocked optional install scripts for `esbuild@0.28.2` and `unrs-resolver@1.12.2`. The toolchain still ran; verify the full pipeline before approving scripts or forcing dependency changes.
- A later `npm install --package-lock-only` hit `EALLOWREMOTE` for Tailwind's optional WASM package because this npm environment disables remote-package fetches. The earlier pinned install had already updated dependency entries; verify with `npm ci` and do not loosen npm policy just to refresh metadata.
- OpenAI SDK 7.19.0 does not yet type the documented web-search image fields. Keep the compatibility cast isolated to the exact `web_search` tool object and parse raw `web_search_call.results` rather than model-authored URLs.
- This package compiles `tsx` scripts as CommonJS, so top-level `await` fails during smoke checks. Put asynchronous script work in an explicit `main()` entrypoint.
- PowerShell `Invoke-WebRequest` can print streamed response bytes as a huge decimal sequence. Probe NDJSON with Node `fetch`, decode by line, and log only event metadata so embedded image data never reaches terminal output.
- A production `npm audit` briefly returned registry HTTP 503. Retry the unchanged command before treating a registry outage as an audit failure; the retry reported zero vulnerabilities.
- Supabase CLI migration commands create `supabase/.temp/cli-latest`. Keep `/supabase/.temp/` ignored so runtime state is never committed with migrations.
- The AI six-item cap was enforced independently by profile validation, visual requests, signed grants, API validation, and resolver concurrency; when raising capacity, update the `2|4|6|8` contract and `AI_MAX_VISUAL_ASSETS` ceiling together.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
