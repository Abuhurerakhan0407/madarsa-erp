do $$
begin
  if pg_catalog.to_regprocedure('public.get_student_lifecycle_center_core_v1(uuid,bigint,bigint)') is null
    or pg_catalog.to_regprocedure('public.prepare_next_academic_session_core_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date)') is null
    or pg_catalog.to_regprocedure('public.import_students_batch_core_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text)') is null
    or pg_catalog.to_regprocedure('public.plan_student_rollover_batch_core_v1(uuid,bigint,bigint,bigint[],bigint,bigint,text,text)') is null then
    raise exception 'student lifecycle core runtime is incomplete';
  end if;
end $$;

create or replace function public.get_student_lifecycle_center_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint)
returns jsonb language plpgsql stable set search_path to pg_catalog, extensions
as $fn$ begin
  if public.resolve_student_lifecycle_membership_v1(p_identity_id,p_tenant_id,p_branch_id,array['students.profile.read','academics.enrollment.manage','academics.structure.read']) is null then
    raise exception 'student lifecycle workspace permission denied';
  end if;
  return public.get_student_lifecycle_center_core_v1(p_identity_id,p_tenant_id,p_branch_id);
end;$fn$;

create or replace function public.prepare_next_academic_session_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_source_session_id bigint,p_key text,p_labels jsonb,p_starts_on date,p_ends_on date
) returns jsonb language plpgsql set search_path to pg_catalog, extensions
as $fn$ begin
  if public.resolve_student_lifecycle_membership_v1(p_identity_id,p_tenant_id,p_branch_id,array['academics.structure.manage']) is null then
    raise exception 'academic structure permission denied';
  end if;
  return public.prepare_next_academic_session_core_v1(p_identity_id,p_tenant_id,p_branch_id,p_source_session_id,p_key,p_labels,p_starts_on,p_ends_on);
end;$fn$;

create or replace function public.import_students_batch_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_session_id bigint,p_program_id bigint,p_group_id bigint,p_joined_on date,p_rows jsonb,p_request_key text
) returns jsonb language plpgsql set search_path to pg_catalog, extensions
as $fn$ begin
  if public.resolve_student_lifecycle_membership_v1(p_identity_id,p_tenant_id,p_branch_id,array['people.person.manage','students.profile.update','academics.enrollment.manage']) is null then
    raise exception 'student import permission denied';
  end if;
  return public.import_students_batch_core_v1(p_identity_id,p_tenant_id,p_branch_id,p_session_id,p_program_id,p_group_id,p_joined_on,p_rows,p_request_key);
end;$fn$;

create or replace function public.plan_student_rollover_batch_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_ids bigint[],p_target_session_id bigint,p_target_group_id bigint,p_mode text,p_request_key text
) returns jsonb language plpgsql set search_path to pg_catalog, extensions
as $fn$
declare v_target_start date;begin
  if public.resolve_student_lifecycle_membership_v1(p_identity_id,p_tenant_id,p_branch_id,array['academics.enrollment.manage','students.profile.read']) is null then
    raise exception 'student rollover permission denied';
  end if;
  select s.starts_on into v_target_start from public.academic_sessions s where s.tenant_id=p_tenant_id and s.id=p_target_session_id and s.status in('draft','active');
  if v_target_start is null then raise exception 'target academic session is unavailable';end if;
  if exists(
    select 1
    from unnest(coalesce(p_student_person_ids,array[]::bigint[])) x(student_person_id)
    join lateral (
      select s.ends_on
      from public.enrollments e join public.academic_sessions s on s.tenant_id=e.tenant_id and s.id=e.session_id
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=x.student_person_id and e.status in('active','paused')
      order by e.starts_on desc,e.id desc limit 1
    ) current_session on true
    where v_target_start<=current_session.ends_on
  ) then raise exception 'target session must start after each selected student current session ends';end if;
  perform pg_advisory_xact_lock(hashtextextended('student-rollover-group:'||p_tenant_id::text||':'||p_branch_id::text||':'||p_target_session_id::text||':'||p_target_group_id::text,0));
  return public.plan_student_rollover_batch_core_v1(p_identity_id,p_tenant_id,p_branch_id,p_student_person_ids,p_target_session_id,p_target_group_id,p_mode,p_request_key);
end;$fn$;

revoke all on function public.get_student_lifecycle_center_core_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.prepare_next_academic_session_core_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date) from public,anon,authenticated;
revoke all on function public.import_students_batch_core_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text) from public,anon,authenticated;
revoke all on function public.plan_student_rollover_batch_core_v1(uuid,bigint,bigint,bigint[],bigint,bigint,text,text) from public,anon,authenticated;
revoke all on function public.get_student_lifecycle_center_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.prepare_next_academic_session_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date) from public,anon,authenticated;
revoke all on function public.import_students_batch_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text) from public,anon,authenticated;
revoke all on function public.plan_student_rollover_batch_v1(uuid,bigint,bigint,bigint[],bigint,bigint,text,text) from public,anon,authenticated;

grant execute on function public.get_student_lifecycle_center_core_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.prepare_next_academic_session_core_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date) to service_role;
grant execute on function public.import_students_batch_core_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text) to service_role;
grant execute on function public.plan_student_rollover_batch_core_v1(uuid,bigint,bigint,bigint[],bigint,bigint,text,text) to service_role;
grant execute on function public.get_student_lifecycle_center_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.prepare_next_academic_session_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date) to service_role;
grant execute on function public.import_students_batch_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text) to service_role;
grant execute on function public.plan_student_rollover_batch_v1(uuid,bigint,bigint,bigint[],bigint,bigint,text,text) to service_role;
