-- Progress is written only through the app server (/api/progress), never straight from the browser.
-- Students keep read access to their own rows.
drop policy if exists "progress: insert own" on public.progress;
drop policy if exists "progress: update own" on public.progress;
revoke insert, update, delete on public.progress from anon, authenticated;

-- Records one finished level for the signed-in student: keeps the best (lowest)
-- error count and adds one run. The caller can't set runs, dates or another user's row.
create or replace function public.record_progress(p_sim_id text, p_level smallint, p_errors integer)
returns table (best_errors integer, runs integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_sim_id is null or length(p_sim_id) > 64 or p_sim_id !~ '^[a-z0-9-]+$' then
    raise exception 'bad simulation id' using errcode = '22023';
  end if;
  if p_level not between 1 and 3 or p_errors not between 0 and 200 then
    raise exception 'bad level or errors' using errcode = '22023';
  end if;

  return query
  insert into public.progress as p (user_id, sim_id, level, best_errors, runs, updated_at)
  values (uid, p_sim_id, p_level, p_errors, 1, now())
  on conflict (user_id, sim_id, level) do update
    set best_errors = least(p.best_errors, excluded.best_errors),
        runs        = p.runs + 1,
        updated_at  = now()
  returning p.best_errors, p.runs;
end;
$$;

revoke all on function public.record_progress(text, smallint, integer) from public, anon;
grant execute on function public.record_progress(text, smallint, integer) to authenticated;
