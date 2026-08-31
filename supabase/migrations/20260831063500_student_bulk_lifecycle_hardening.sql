grant usage,select on sequence public.student_bulk_operation_jobs_id_seq to service_role;
grant usage,select on sequence public.student_bulk_operation_items_id_seq to service_role;

create unique index if not exists enrollments_one_open_record_per_session_idx
on public.enrollments(tenant_id,branch_id,student_person_id,session_id)
where status <> 'cancelled';

create or replace function public.resolve_student_lifecycle_membership_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_permissions text[]
) returns bigint
language plpgsql stable set search_path to pg_catalog, extensions
as $fn$
declare v_membership bigint;v_required integer;begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then return null;end if;
  if p_permissions is null or coalesce(array_length(p_permissions,1),0)=0 then return null;end if;
  select count(distinct x)::integer into v_required from unnest(p_permissions)x where x is not null;
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1
      from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code=any(p_permissions)
      group by mr.membership_id
      having count(distinct rp.permission_code)=v_required
    )
  order by m.created_at limit 1;
  return v_membership;
end;$fn$;

drop function if exists public.get_student_lifecycle_center_core_v1(uuid,bigint,bigint);
drop function if exists public.prepare_next_academic_session_core_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date);
drop function if exists public.import_students_batch_core_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text);
drop function if exists public.plan_student_rollover_batch_core_v1(uuid,bigint,bigint,bigint[],bigint,bigint,text,text);

alter function public.get_student_lifecycle_center_v1(uuid,bigint,bigint) rename to get_student_lifecycle_center_core_v1;
alter function public.prepare_next_academic_session_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date) rename to prepare_next_academic_session_core_v1;
alter function public.import_students_batch_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text) rename to import_students_batch_core_v1;
alter function public.plan_student_rollover_batch_v1(uuid,bigint,bigint,bigint[],bigint,bigint,text,text) rename to plan_student_rollover_batch_core_v1;

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

revoke all on function public.resolve_student_lifecycle_membership_v1(uuid,bigint,bigint,text[]) from public,anon,authenticated;
revoke all on function public.get_student_lifecycle_center_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.prepare_next_academic_session_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date) from public,anon,authenticated;
revoke all on function public.import_students_batch_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text) from public,anon,authenticated;
revoke all on function public.plan_student_rollover_batch_v1(uuid,bigint,bigint,bigint[],bigint,bigint,text,text) from public,anon,authenticated;
grant execute on function public.resolve_student_lifecycle_membership_v1(uuid,bigint,bigint,text[]) to service_role;
grant execute on function public.get_student_lifecycle_center_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.prepare_next_academic_session_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date) to service_role;
grant execute on function public.import_students_batch_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text) to service_role;
grant execute on function public.plan_student_rollover_batch_v1(uuid,bigint,bigint,bigint[],bigint,bigint,text,text) to service_role;