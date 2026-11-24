-- Run after 00_supabase_stub.sql and all migrations. Expected: see comments; every "ERROR" line is a refusal we want.
\set ON_ERROR_STOP 0
\set VERBOSITY terse
-- a = instructor, b = student in class, c = outsider
set role authenticated;
set request.uid = '00000000-0000-0000-0000-00000000000a';
select name, length(join_code) from public.create_class('Turma PPL 2026');
select join_code as code from public.classes \gset
insert into public.classes (instructor_id, name, join_code) values (auth.uid(), 'x', 'ABCDEF');
set request.uid = '00000000-0000-0000-0000-00000000000b';
select class_name from public.join_class(:'code', 'Maria');
select public.record_progress('cascais-local', 1::smallint, 2);
select public.record_exam('PPL', 18, 20, 600);
select public.record_exam('PPL', 21, 20, 600);
insert into public.exam_results (user_id, licence, score, right_count, total, seconds) values (auth.uid(),'PPL',100,20,20,1);
insert into public.progress values (auth.uid(),'x',1,0,1,now());
select count(*) as b_sees_classes from public.classes;
select * from public.class_report((select id from public.classes limit 1));
set request.uid = '00000000-0000-0000-0000-00000000000c';
select count(*) as c_sees_classes from public.classes;
select count(*) as c_sees_members from public.class_members;
select * from public.join_class('ZZZZZZ', 'Eve');
set request.uid = '00000000-0000-0000-0000-00000000000a';
select display_name, done, exams, best_exam, last_exam, last_active is not null as active from public.class_report((select id from public.classes limit 1));
select count(*) as a_sees_members from public.class_members;
select count(*) as a_sees_exams_directly from public.exam_results;
set role anon;
select * from public.create_class('anon');
