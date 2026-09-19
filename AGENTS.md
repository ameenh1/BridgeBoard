# BridgeBoard agent notes

## External integrations

- Keep OpenAI and Supabase service-role credentials server-only; never commit secrets or use `NEXT_PUBLIC_` for them.
- Verify an external project or resource through its dashboard or API response before claiming it exists.
- Keep Supabase Storage's internal schema read-only. Store image bytes in Storage and application metadata in `public.ai_asset_cache`.

## AI asset pipeline

- Keep browser code limited to contracts, speech fallback, and cache events; OpenAI and Supabase admin clients stay server-only.
- OpenAI web search returns sources, not trusted image bytes. Validate HTTPS, allowed hosts, MIME type, magic bytes, and size before caching a candidate.
- On a cache miss, default to generation-first so successful generation incurs no web-search call. Keep parallel/web-first available explicitly, treat `off` as generation-only, and keep fallback events internal to the demo UI.
- If dependency installation reports blocked optional scripts or audit findings, record the exact result and verify typecheck/tests before changing versions or using force fixes.
- Use the Realtime unified WebRTC endpoint from a server route. The browser may send SDP, but it must never receive the standard OpenAI API key.

## Recorded implementation issues

- Initial Vitest 3.x installation reported two moderate `@vitest/mocker` path-traversal advisories. Upgrading to Vitest 5.0.1 removed the findings; `npm test`, `npm run typecheck`, and `npm audit` then passed.
- npm reported a blocked optional `esbuild` install script during the first install. The runner still executed successfully, so no force-enabled install was needed.
- The AI branch has no frontend framework/runtime, so the Realtime integration is framework-neutral and the end-to-end microphone check uses a small localhost Node demo. Keep that demo local-only; production apps should place the same session handler behind their own auth and rate limits.
- The first demo server served `/` with `application/octet-stream` because MIME detection used the URL `/` instead of the resolved `index.html` path; browsers downloaded the page. Detect static content type from the resolved file path and verify the root response as `text/html`.
- The Realtime demo initially sent a transcription-only config to `/v1/realtime/calls`, which caused the local session route to return HTTP 500. The unified WebRTC endpoint requires `type: "realtime"` and a session `model`; keep `gpt-live-transcribe` under `audio.input.transcription` and set server VAD `create_response: false` for transcription-only caregiver audio.
- Placeholder-only manifest entries made the fast path look empty and shared-cache lookups could delay fallback paint; common demo choices now have local SVG symbols, the demo keeps a process hot cache, and fallback events are emitted before the shared lookup.
- The demo UI previously rendered those local symbols as final-looking cards, so generated assets were hard to confirm. Keep fallback events internal to the resolver, show a loading state in the demo, and render only ready non-placeholder assets with their source label and optional source link.
- A live web-provider probe initially omitted the repository env loader and then found the local image-host allowlist was too narrow for the search result. Load `serverEnv.ts` in standalone probes and keep the approved image-host set aligned in `.env.example` and local development configuration.
- Unsplash negotiated AVIF because the downloader advertised it before the supported formats, so valid web results were rejected by byte validation. Prefer PNG/JPEG/WebP in the request `Accept` header and keep the validator/cache format set consistent.
- Unapproved visuals must come only from explicit concrete caregiver-spoken concepts returned in a separate structured field; hash those concepts for cache keys and cap the total requests per turn so transcript text is not stored and image calls do not grow without bound.
- Tests that assert a specific asset search mode must pass `assetSearchMode` explicitly because the dotenv-loaded `.env.local` runtime setting can otherwise change their provider-call expectations.
- The local configuration once forced `parallel`, causing paid web searches even when generation won, while the documented `off` mode also skipped generation. Keep committed and local defaults on `generation_first`, make `off` generation-only, and use `AI_ASSET_SEARCH_ENABLED=false` when web discovery must be disabled regardless of mode.
- Realtime may finalize “bath room” as aliases or separate items, and the resolver can emit local events before its result returns. Keep approved speech keywords plus the bounded two-second fragment seam, clear partial/context state at session boundaries, buffer asset events until classification is sent, and regression-test aliases, isolated fragments, and verified local assets.

## Repository workflow

- If Git reports `Author identity unknown`, set the identity only in this repository using the authenticated GitHub profile and its no-reply address; do not guess or change global Git identity.
- Document new failures and their reusable fixes here concisely; avoid repeating existing notes.
