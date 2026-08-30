-- Production was hardened after the initial direct-student runtime was applied.
-- Fresh installs already receive the hardened lock-before-duplicate-check function
-- from 20260830144736_direct_student_runtime.sql. Keep this migration so repository
-- history remains aligned with production and reassert the intended execution ACL.

revoke all on function public.create_student_direct(
  uuid,bigint,bigint,text,text,date,text,text,bigint,bigint,bigint,date,text,text,text,jsonb,boolean
) from public, anon, authenticated;

grant execute on function public.create_student_direct(
  uuid,bigint,bigint,text,text,date,text,text,bigint,bigint,bigint,date,text,text,text,jsonb,boolean
) to service_role;

comment on function public.create_student_direct(
  uuid,bigint,bigint,text,text,date,text,text,bigint,bigint,bigint,date,text,text,text,jsonb,boolean
) is 'Authorized direct student creation. Duplicate screening is serialized with an advisory transaction lock before candidate evaluation.';
