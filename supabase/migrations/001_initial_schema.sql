-- ============================================================
-- Svenska Hub — Initial Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Profiles table
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  daily_new_limit int not null default 20,
  daily_review_limit int not null default 100,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);


-- 2. Vocabulary table (shared word pool)
create table public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  swedish_word text not null,
  english_meaning text not null,
  gender text check (gender in ('en', 'ett', 'n/a')),
  grammar_forms jsonb default '{}',
  example_sv text,
  example_en text,
  added_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now()
);

alter table public.vocabulary enable row level security;

create policy "Authenticated users can view all vocabulary"
  on public.vocabulary for select
  to authenticated
  using (true);

create policy "Authenticated users can insert vocabulary"
  on public.vocabulary for insert
  to authenticated
  with check (true);

-- Service role can always insert (for the ingest API)
-- No additional policy needed — service role bypasses RLS


-- 3. Card Progress table (individual SRS state)
create table public.card_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  word_id uuid not null references public.vocabulary(id) on delete cascade,
  due_date timestamptz not null default now(),
  stability real not null default 0,
  difficulty real not null default 0,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  state int not null default 0, -- 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, word_id)
);

alter table public.card_progress enable row level security;

create policy "Users can view own card progress"
  on public.card_progress for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own card progress"
  on public.card_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own card progress"
  on public.card_progress for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own card progress"
  on public.card_progress for delete
  to authenticated
  using (auth.uid() = user_id);


-- 4. Indexes for query performance
create index idx_card_progress_user_due on public.card_progress (user_id, due_date);
create index idx_card_progress_user_state on public.card_progress (user_id, state);
create index idx_vocabulary_created on public.vocabulary (created_at desc);


-- 5. Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
