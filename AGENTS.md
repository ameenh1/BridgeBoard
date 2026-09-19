# BridgeBoard agent notes

## External integrations

- Verify the connector or MCP server is present and authenticated before claiming that an external project or resource was created.
- Supabase MCP is configured through Codex's shared `config.toml`. Keep the connection least-privileged and do not store passwords, access tokens, or OTPs in this repository.
- If Supabase OAuth registration fails with an invalid-scope response, remove the failed server entry, preserve the exact error, and use an authenticated Supabase dashboard session or a user-provided PAT rather than retrying blindly.
- Do not claim a Supabase project is created until its dashboard or MCP response provides a verified project reference.
- Treat Supabase memory charts as host RAM/cache/commit metrics, not table size; check database size, swap, and connection counts before changing compute.

## Current integration note

- On 2026-09-18, OAuth dynamic registration initially failed because the server rejected Codex's default scopes. The failed entry was replaced with a bearer-token fallback, then OAuth was retried with explicit Supabase scopes after the user signed in; Codex reported successful authentication. BridgeBoard project ref `rpldjjorjscwyaubbdtq` was verified in the Supabase dashboard.

## Repository workflow

- If Git reports `Author identity unknown`, set the identity only in this repository using the authenticated GitHub profile and its no-reply address; do not guess or change global Git identity.
