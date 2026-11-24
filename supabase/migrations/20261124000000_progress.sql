-- Training progress: one row per student, simulation and level.
create table if not exists public.progress (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  sim_id      text        not null,
  level       smallint    not null check (level between 1 and 3),
  best_errors integer     not null check (best_errors >= 0),
  runs        integer     not null default 1 check (runs >= 1),
  updated_at  timestamptz not null default now(),
  primary key (user_id, sim_id, level)
);

alter table public.progress enable row level security;

-- Each student sees and changes only their own rows.
create policy "progress: read own"   on public.progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "progress: insert own" on public.progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "progress: update own" on public.progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
