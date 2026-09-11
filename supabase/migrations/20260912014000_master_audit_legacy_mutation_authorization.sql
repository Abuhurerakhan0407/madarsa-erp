-- FUR-AUD-005: close authorization drift across legacy mutation RPCs without rewriting
-- their business logic. Each original implementation is renamed and made non-callable by
-- API roles. A service-role-only SECURITY DEFINER wrapper performs the canonical active
-- membership / active-role / branch / delegation check through operator_has_permission_v1
-- before invoking the preserved implementation as the database owner.

create or replace function private.operator_has_all_permissions_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_permission_codes text[]
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(cardinality(p_permission_codes), 0) > 0
    and not exists (
      select 1
      from unnest(p_permission_codes) permission_code
      where not public.operator_has_permission_v1(
        p_identity_id,
        p_tenant_id,
        p_branch_id,
        permission_code
      )
    );
$$;

create or replace function private.operator_has_any_permission_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_permission_codes text[]
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from unnest(p_permission_codes) permission_code
    where public.operator_has_permission_v1(
      p_identity_id,
      p_tenant_id,
      p_branch_id,
      permission_code
    )
  );
$$;

revoke all on function private.operator_has_all_permissions_v1(uuid,bigint,bigint,text[]) from public, anon, authenticated, service_role;
revoke all on function private.operator_has_any_permission_v1(uuid,bigint,bigint,text[]) from public, anon, authenticated, service_role;

-- Wrap launch-relevant legacy mutations that previously joined membership_roles /
-- role_permissions directly and therefore could continue honoring a disabled role.
do $wrap$
declare
  v_spec record;
  v_oid oid;
  v_full_args text;
  v_identity_args text;
  v_result text;
  v_arg_count integer;
  v_call_args text;
  v_legacy_name text;
  v_wrapper_sql text;
begin
  for v_spec in
    select * from (values
      ('approve_exam_results_v1', array['assessment.results.approve']::text[], 'all'),
      ('calculate_exam_results_v1', array['assessment.results.approve']::text[], 'all'),
      ('configure_whatsapp_channel_v1', array['notification.policy.manage']::text[], 'all'),
      ('create_exam_series_v1', array['assessment.setup.manage']::text[], 'all'),
      ('create_exam_series_v2', array['assessment.setup.manage']::text[], 'all'),
      ('create_hr_employee_v1', array['hr.employee.manage']::text[], 'all'),
      ('create_student_direct', array['people.person.manage','students.profile.update','academics.enrollment.manage']::text[], 'all'),
      ('decide_hr_leave_v1', array['hr.employee.manage']::text[], 'all'),
      ('import_students_batch_core_v1', array['people.person.manage','students.profile.update','academics.enrollment.manage']::text[], 'all'),
      ('map_attendance_device_subject_v1', array['attendance.student.mark','hr.employee.manage']::text[], 'any'),
      ('moderate_exam_mark_v1', array['assessment.marks.moderate']::text[], 'all'),
      ('plan_student_rollover_batch_core_v1', array['academics.enrollment.manage','students.profile.read']::text[], 'all'),
      ('prepare_next_academic_session_core_v1', array['academics.structure.manage']::text[], 'all'),
      ('publish_exam_results_v1', array['assessment.results.publish']::text[], 'all'),
      ('queue_guardian_whatsapp_v1', array['notification.message.send']::text[], 'all'),
      ('record_exam_mark_v1', array['assessment.marks.enter']::text[], 'all'),
      ('record_hr_attendance_v1', array['hr.employee.manage']::text[], 'all'),
      ('rotate_attendance_device_token_v1', array['attendance.student.mark','hr.employee.manage']::text[], 'any'),
      ('set_guardian_whatsapp_consent_v1', array['notification.message.send','notification.policy.manage']::text[], 'any'),
      ('submit_hr_leave_v1', array['hr.employee.manage']::text[], 'all'),
      ('update_hr_employee_v1', array['hr.employee.manage']::text[], 'all'),
      ('update_student_core', array['people.person.manage','students.profile.update']::text[], 'all'),
      ('upsert_guardian_whatsapp_template_v1', array['notification.policy.manage']::text[], 'all')
    ) as specs(function_name, permission_codes, permission_mode)
  loop
    select p.oid,
           pg_get_function_arguments(p.oid),
           pg_get_function_identity_arguments(p.oid),
           pg_get_function_result(p.oid),
           p.pronargs
      into v_oid, v_full_args, v_identity_args, v_result, v_arg_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = v_spec.function_name;

    if v_oid is null then
      raise exception 'Phase 0 authorization wrapper target missing: %', v_spec.function_name;
    end if;

    if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=v_spec.function_name) <> 1 then
      raise exception 'Phase 0 authorization wrapper target unexpectedly overloaded: %', v_spec.function_name;
    end if;

    v_legacy_name := '__phase0_legacy_' || v_spec.function_name;
    if length(v_legacy_name) > 63 then
      raise exception 'Phase 0 legacy function name is too long: %', v_legacy_name;
    end if;

    execute format(
      'alter function public.%I(%s) rename to %I',
      v_spec.function_name,
      v_identity_args,
      v_legacy_name
    );

    execute format(
      'revoke all on function public.%I(%s) from public, anon, authenticated, service_role',
      v_legacy_name,
      v_identity_args
    );

    select string_agg(format('$%s', i), ', ' order by i)
      into v_call_args
    from generate_series(1, v_arg_count) i;

    v_wrapper_sql := format(
      'create function public.%I(%s) returns %s language plpgsql security definer set search_path to '''' as $body$ begin if not private.operator_has_%s_permissions_v1($1,$2,$3,%L::text[]) then raise exception ''authorization revoked or permission denied''; end if; return public.%I(%s); end; $body$',
      v_spec.function_name,
      v_full_args,
      v_result,
      v_spec.permission_mode,
      v_spec.permission_codes::text,
      v_legacy_name,
      v_call_args
    );
    execute v_wrapper_sql;

    execute format(
      'revoke all on function public.%I(%s) from public, anon, authenticated',
      v_spec.function_name,
      v_identity_args
    );
    execute format(
      'grant execute on function public.%I(%s) to service_role',
      v_spec.function_name,
      v_identity_args
    );
  end loop;
end;
$wrap$;

-- Emergency attendance revocation has a subject-specific permission, so its wrapper
-- resolves the target first and requires the correct *active* permission instead of an
-- imprecise any-of check.
alter function public.revoke_emergency_manual_attendance_v1(uuid,bigint,bigint,bigint,text)
  rename to __phase0_legacy_revoke_emergency_manual_attendance_v1;

revoke all on function public.__phase0_legacy_revoke_emergency_manual_attendance_v1(uuid,bigint,bigint,bigint,text)
  from public, anon, authenticated, service_role;

create function public.revoke_emergency_manual_attendance_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_authorization_id bigint,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_subject_type text;
  v_permission text;
begin
  select a.subject_type
    into v_subject_type
  from public.attendance_manual_authorizations a
  where a.tenant_id = p_tenant_id
    and a.branch_id = p_branch_id
    and a.id = p_authorization_id;

  if v_subject_type is null then
    raise exception 'emergency attendance authorization not found';
  end if;

  v_permission := case v_subject_type
    when 'student' then 'attendance.student.approve'
    when 'staff' then 'hr.employee.manage'
    else null
  end;

  if v_permission is null
     or not public.operator_has_permission_v1(
       p_identity_id,
       p_tenant_id,
       p_branch_id,
       v_permission
     ) then
    raise exception 'authorization revoked or permission denied';
  end if;

  return public.__phase0_legacy_revoke_emergency_manual_attendance_v1(
    p_identity_id,
    p_tenant_id,
    p_branch_id,
    p_authorization_id,
    p_reason
  );
end;
$$;

revoke all on function public.revoke_emergency_manual_attendance_v1(uuid,bigint,bigint,bigint,text)
  from public, anon, authenticated;
grant execute on function public.revoke_emergency_manual_attendance_v1(uuid,bigint,bigint,bigint,text)
  to service_role;
