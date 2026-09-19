create table if not exists public.ai_asset_cache (
  cache_key text primary key,
  choice_id text not null,
  source text not null check (source in ('web', 'generated')),
  object_path text not null unique,
  source_url text,
  attribution text,
  style_version text not null,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null,
  status text not null default 'ready' check (status in ('ready', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists ai_asset_cache_last_used_at_idx
  on public.ai_asset_cache (last_used_at);

alter table public.ai_asset_cache enable row level security;

revoke all on table public.ai_asset_cache from anon, authenticated;
grant select, insert, update, delete on table public.ai_asset_cache to service_role;

comment on table public.ai_asset_cache is
  'Server-only BridgeBoard asset metadata. Image bytes live in private Supabase Storage.';
