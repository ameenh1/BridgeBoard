# BridgeBoard agent notes

## External integrations

- Keep OpenAI and Supabase service-role credentials server-only; never commit secrets or use `NEXT_PUBLIC_` for them.
- Verify an external project or resource through its dashboard or API response before claiming it exists.
- Keep Supabase Storage's internal schema read-only. Store image bytes in Storage and application metadata in `public.ai_asset_cache`.

## AI asset pipeline

- Keep browser code limited to contracts, speech fallback, and cache events; OpenAI and Supabase admin clients stay server-only.
- OpenAI web search returns sources, not trusted image bytes. Validate HTTPS, allowed hosts, MIME type, magic bytes, and size before caching a candidate.
- On a cache miss, start web discovery and image generation together, emit the placeholder immediately, and let the first validated result win.
- If dependency installation reports blocked optional scripts or audit findings, record the exact result and verify typecheck/tests before changing versions or using force fixes.
- Use the Realtime unified WebRTC endpoint from a server route. The browser may send SDP, but it must never receive the standard OpenAI API key.

## Recorded implementation issues

- Initial Vitest 3.x installation reported two moderate `@vitest/mocker` path-traversal advisories. Upgrading to Vitest 5.0.1 removed the findings; `npm test`, `npm run typecheck`, and `npm audit` then passed.
- npm reported a blocked optional `esbuild` install script during the first install. The runner still executed successfully, so no force-enabled install was needed.
- The AI branch has no frontend framework/runtime, so the Realtime integration is framework-neutral and the end-to-end microphone check uses a small localhost Node demo. Keep that demo local-only; production apps should place the same session handler behind their own auth and rate limits.

## Repository workflow

- If Git reports `Author identity unknown`, set the identity only in this repository using the authenticated GitHub profile and its no-reply address; do not guess or change global Git identity.
- Document new failures and their reusable fixes here concisely; avoid repeating existing notes.
