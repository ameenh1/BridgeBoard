create table if not exists public.ai_asset_cache (
  cache_key text primary key,
  vocabulary_id text not null,
  source text not null check (source in ('web', 'generated', 'local', 'placeholder')),
  object_path text not null unique,
  source_url text,
  attribution text,
  prompt_version text not null,
  mime_type text not null,
  width integer,
  height integer,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text not null,
  status text not null default 'ready' check (status in ('ready', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists ai_asset_cache_vocabulary_id_idx
  on public.ai_asset_cache (vocabulary_id);

create index if not exists ai_asset_cache_last_used_at_idx
  on public.ai_asset_cache (last_used_at);

alter table public.ai_asset_cache enable row level security;

comment on table public.ai_asset_cache is
  'Application metadata for BridgeBoard visual assets. Binary files belong in Supabase Storage.';
