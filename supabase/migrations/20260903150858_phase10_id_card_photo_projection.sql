begin;

-- Project canonical private photo availability through the existing batch engine.
create or replace function public.get_student_id_card_batch(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_session_id bigint default null,
  p_group_id bigint default null,
  p_person_ids bigint[] default null
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_sessions jsonb := '[]'::jsonb;
  v_groups jsonb := '[]'::jsonb;
  v_students jsonb := '[]'::jsonb;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then
    raise exception 'identity, tenant, and branch are required';
  end if;
  if p_person_ids is not null and cardinality(p_person_ids) > 250 then
    raise exception 'bulk ID card selection is limited to 250 students';
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.identity_id = p_identity_id
    and m.status = 'active'
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
    and (
      m.all_branches
      or exists (
        select 1 from public.membership_branch_scopes mbs
        where mbs.tenant_id = m.tenant_id
          and mbs.membership_id = m.id
          and mbs.branch_id = p_branch_id
      )
    )
    and exists (
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id = mr.tenant_id and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id and mr.membership_id = m.id
        and rp.permission_code = 'students.profile.read'
    )
    and exists (
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id = mr.tenant_id and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id and mr.membership_id = m.id
        and rp.permission_code = 'document.job.manage'
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then raise exception 'bulk ID card permission denied'; end if;
  if not exists (
    select 1 from public.branches b
    where b.tenant_id = p_tenant_id and b.id = p_branch_id and b.status = 'active'
  ) then raise exception 'active branch is required'; end if;

  if p_session_id is not null and not exists (
    select 1 from public.academic_sessions s
    where s.tenant_id = p_tenant_id and s.id = p_session_id and s.status = 'active'
  ) then raise exception 'active academic session is required'; end if;

  if p_group_id is not null and not exists (
    select 1 from public.academic_groups g
    where g.tenant_id = p_tenant_id and g.branch_id = p_branch_id and g.id = p_group_id and g.status = 'active'
      and (p_session_id is null or g.session_id = p_session_id)
  ) then raise exception 'active class/group is required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'key', s.key,
    'labels', s.labels
  ) order by s.starts_on desc, s.id desc), '[]'::jsonb)
  into v_sessions
  from public.academic_sessions s
  where s.tenant_id = p_tenant_id
    and s.status = 'active'
    and exists (
      select 1 from public.academic_groups g
      where g.tenant_id = p_tenant_id and g.branch_id = p_branch_id
        and g.session_id = s.id and g.status = 'active'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'session_id', g.session_id,
    'program_id', g.program_id,
    'key', g.key,
    'labels', g.labels
  ) order by g.id asc), '[]'::jsonb)
  into v_groups
  from public.academic_groups g
  where g.tenant_id = p_tenant_id
    and g.branch_id = p_branch_id
    and g.status = 'active'
    and (p_session_id is null or g.session_id = p_session_id);

  if p_group_id is not null or p_person_ids is not null then
    with eligible as (
      select distinct on (sp.person_id)
        sp.person_id,
        sp.student_number,
        sp.status,
        p.display_name,
        p.name_native,
        p.date_of_birth,
        p.photo_storage_path,
        e.program_id,
        e.group_id,
        e.created_at
      from public.enrollments e
      join public.student_profiles sp on sp.tenant_id = e.tenant_id and sp.person_id = e.student_person_id
      join public.persons p on p.tenant_id = sp.tenant_id and p.id = sp.person_id
      where e.tenant_id = p_tenant_id
        and e.branch_id = p_branch_id
        and (p_group_id is null or e.group_id = p_group_id)
        and e.status = 'active'
        and sp.status = 'active'
        and (p_session_id is null or e.session_id = p_session_id)
        and (p_person_ids is null or sp.person_id = any(p_person_ids))
      order by sp.person_id, e.created_at desc, e.id desc
    ), enriched as (
      select e.*,
        pr.key as program_key,
        pr.labels as program_labels,
        ag.key as group_key,
        ag.labels as group_labels,
        guardian.display_name as guardian_name
      from eligible e
      left join public.programs pr on pr.tenant_id = p_tenant_id and pr.id = e.program_id
      left join public.academic_groups ag on ag.tenant_id = p_tenant_id and ag.id = e.group_id
      left join lateral (
        select gp.display_name
        from public.person_relationships r
        join public.persons gp on gp.tenant_id = r.tenant_id and gp.id = r.source_person_id
        where r.tenant_id = p_tenant_id
          and r.target_person_id = e.person_id
          and r.status = 'verified'
          and r.is_primary = true
        order by r.created_at asc, r.id asc
        limit 1
      ) guardian on true
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'person_id', person_id,
      'student_number', student_number,
      'name', display_name,
      'native_name', name_native,
      'date_of_birth', date_of_birth,
      'status', status,
      'program_key', program_key,
      'program_labels', program_labels,
      'group_key', group_key,
      'group_labels', group_labels,
      'guardian_name', guardian_name,
      'photo_storage_path', photo_storage_path
    ) order by student_number asc, display_name asc), '[]'::jsonb)
    into v_students
    from enriched;
  end if;

  return jsonb_build_object(
    'sessions', v_sessions,
    'groups', v_groups,
    'students', v_students,
    'limit', 250
  );
end;
$function$;

revoke all on function public.get_student_id_card_batch(uuid,bigint,bigint,bigint,bigint,bigint[]) from public,anon,authenticated;
grant execute on function public.get_student_id_card_batch(uuid,bigint,bigint,bigint,bigint,bigint[]) to service_role;

commit;