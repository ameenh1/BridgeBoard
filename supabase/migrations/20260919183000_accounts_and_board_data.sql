create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communication_history (
  entry_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  board_type text not null check (board_type in ('choice', 'feelings_needs', 'body_needs', 'yes_no', 'fallback', 'full_board')),
  question_text text,
  selected_vocabulary_id text,
  selected_label text,
  created_at timestamptz not null default now()
);

create index if not exists communication_history_user_created_idx
  on public.communication_history (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.communication_history enable row level security;

create policy "users can read their own profiles" on public.profiles
  for select using (auth.uid() = user_id);
create policy "users can create their own profiles" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "users can update their own profiles" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can read their own history" on public.communication_history
  for select using (auth.uid() = user_id);
create policy "users can create their own history" on public.communication_history
  for insert with check (auth.uid() = user_id);
create policy "users can delete their own history" on public.communication_history
  for delete using (auth.uid() = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.communication_history to authenticated;
