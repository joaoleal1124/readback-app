-- Schools: instructors create classes, students join with a code, and instructors
-- see their students' progress and exam results. Students never see each other.

create table if not exists public.classes (
  id            uuid        primary key default gen_random_uuid(),
  instructor_id uuid        not null references auth.users (id) on delete cascade,
  name          text        not null check (length(name) between 1 and 80),
  join_code     text        not null unique check (join_code ~ '^[A-Z2-9]{6}$'),
  created_at    timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id     uuid        not null references public.classes (id) on delete cascade,
  student_id   uuid        not null references auth.users (id) on delete cascade,
  display_name text        not null check (length(display_name) between 1 and 60),
  joined_at    timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index if not exists class_members_student on public.class_members (student_id);

create table if not exists public.exam_results (
  id          bigint      generated always as identity primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  licence     text        not null check (licence in ('PPL', 'ATPL')),
  score       smallint    not null check (score between 0 and 100),
  right_count smallint    not null check (right_count >= 0),
  total       smallint    not null check (total between 1 and 50 and right_count <= total),
  seconds     integer     not null check (seconds between 0 and 7200),
  created_at  timestamptz not null default now()
);
create index if not exists exam_results_user on public.exam_results (user_id, created_at desc);

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.exam_results enable row level security;

-- Helpers that read the tables without RLS, so the policies below don't call each other in a loop.
create or replace function public.is_class_instructor(p_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes c where c.id = p_class_id and c.instructor_id = (select auth.uid()));
$$;

create or replace function public.is_class_member(p_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members m where m.class_id = p_class_id and m.student_id = (select auth.uid()));
$$;

revoke all on function public.is_class_instructor(uuid) from public, anon;
revoke all on function public.is_class_member(uuid) from public, anon;
grant execute on function public.is_class_instructor(uuid) to authenticated;
grant execute on function public.is_class_member(uuid) to authenticated;

-- classes: the instructor manages them; members can read the class they joined
create policy "classes: instructor reads" on public.classes for select to authenticated
  using (instructor_id = (select auth.uid()));
create policy "classes: member reads" on public.classes for select to authenticated
  using ((select public.is_class_member(id)));
create policy "classes: instructor deletes" on public.classes for delete to authenticated
  using (instructor_id = (select auth.uid()));

-- members: a student sees and leaves their own memberships; the instructor sees and removes students
create policy "members: own or instructor reads" on public.class_members for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_class_instructor(class_id)));
create policy "members: own or instructor removes" on public.class_members for delete to authenticated
  using (student_id = (select auth.uid()) or (select public.is_class_instructor(class_id)));

-- exam results: each student reads their own (instructors use class_report)
create policy "exams: read own" on public.exam_results for select to authenticated
  using (user_id = (select auth.uid()));

-- writes go through the functions below only (RLS has no insert or update policies; this is belt and braces)
revoke insert, update on public.classes, public.class_members, public.exam_results from anon, authenticated;

-- Creates a class with a fresh join code for the signed-in instructor.
create or replace function public.create_class(p_name text)
returns table (id uuid, name text, join_code text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 80 then
    raise exception 'bad class name' using errcode = '22023';
  end if;
  if (select count(*) from public.classes c where c.instructor_id = uid) >= 50 then
    raise exception 'too many classes' using errcode = '54000';
  end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes c where c.join_code = code);
  end loop;
  return query
  insert into public.classes as c (instructor_id, name, join_code)
  values (uid, trim(p_name), code)
  returning c.id, c.name, c.join_code;
end;
$$;

-- Joins the class with this code under the name the instructor will see.
create or replace function public.join_class(p_code text, p_display_name text)
returns table (class_id uuid, class_name text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  cls public.classes;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_display_name is null or length(trim(p_display_name)) not between 1 and 60 then
    raise exception 'bad name' using errcode = '22023';
  end if;
  select * into cls from public.classes c where c.join_code = upper(trim(p_code));
  if not found then raise exception 'unknown code' using errcode = 'P0002'; end if;
  insert into public.class_members (class_id, student_id, display_name)
  values (cls.id, uid, trim(p_display_name))
  on conflict (class_id, student_id) do update set display_name = excluded.display_name;
  return query select cls.id, cls.name;
end;
$$;

-- Stores a finished exam for the signed-in student after checking the numbers add up.
create or replace function public.record_exam(p_licence text, p_right integer, p_total integer, p_seconds integer)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_licence not in ('PPL', 'ATPL') or p_total not between 1 and 50 or p_right not between 0 and p_total
     or p_seconds not between 0 and 7200 then
    raise exception 'bad exam result' using errcode = '22023';
  end if;
  insert into public.exam_results (user_id, licence, score, right_count, total, seconds)
  values (uid, p_licence, round(p_right * 100.0 / p_total), p_right, p_total, p_seconds);
end;
$$;

-- One row per student of a class the caller teaches: completed levels, last activity and exams.
create or replace function public.class_report(p_class_id uuid)
returns table (
  student_id   uuid,
  display_name text,
  joined_at    timestamptz,
  done         text[],
  last_active  timestamptz,
  exams        integer,
  best_exam    integer,
  last_exam    integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.instructor_id = (select auth.uid())) then
    raise exception 'not your class' using errcode = '42501';
  end if;
  return query
  select
    m.student_id,
    m.display_name,
    m.joined_at,
    coalesce((select array_agg(p.sim_id || ':' || p.level) from public.progress p where p.user_id = m.student_id), '{}'),
    greatest(
      (select max(p.updated_at) from public.progress p where p.user_id = m.student_id),
      (select max(e.created_at) from public.exam_results e where e.user_id = m.student_id)
    ),
    (select count(*)::int from public.exam_results e where e.user_id = m.student_id),
    (select max(e.score)::int from public.exam_results e where e.user_id = m.student_id),
    (select e.score::int from public.exam_results e where e.user_id = m.student_id order by e.created_at desc limit 1)
  from public.class_members m
  where m.class_id = p_class_id
  order by m.display_name;
end;
$$;

revoke all on function public.create_class(text) from public, anon;
revoke all on function public.join_class(text, text) from public, anon;
revoke all on function public.record_exam(text, integer, integer, integer) from public, anon;
revoke all on function public.class_report(uuid) from public, anon;
grant execute on function public.create_class(text) to authenticated;
grant execute on function public.join_class(text, text) to authenticated;
grant execute on function public.record_exam(text, integer, integer, integer) to authenticated;
grant execute on function public.class_report(uuid) to authenticated;
