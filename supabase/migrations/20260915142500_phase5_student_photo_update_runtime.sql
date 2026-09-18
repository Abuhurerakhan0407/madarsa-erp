create or replace function public.update_student_photo_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_person_id bigint,
  p_storage_path text
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_membership_id bigint;
  v_previous_storage_path text;
  v_correlation_id uuid := gen_random_uuid();
  v_expected_prefix text := p_tenant_id::text || '/students/photos/' || p_person_id::text || '/';
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_person_id is null then
    raise exception 'identity, tenant, branch, and student are required';
  end if;
  if p_storage_path is null
    or p_storage_path !~ '^[0-9]+/students/photos/[0-9]+/[a-f0-9]{36}\.(jpg|png|webp)$'
    or left(p_storage_path, length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'student photo storage path is invalid';
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
      select 1
      from public.membership_roles mr
      join public.role_permissions rp
        on rp.tenant_id = mr.tenant_id
       and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id
        and mr.membership_id = m.id
        and rp.permission_code in ('people.person.manage', 'students.profile.update')
      group by mr.membership_id
      having count(distinct rp.permission_code) = 2
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'student photo update permission denied';
  end if;

  if not exists (
    select 1
    from public.student_profiles sp
    where sp.tenant_id = p_tenant_id
      and sp.person_id = p_person_id
      and exists (
        select 1
        from public.enrollments e
        where e.tenant_id = p_tenant_id
          and e.student_person_id = p_person_id
          and e.branch_id = p_branch_id
          and e.status <> 'cancelled'
      )
  ) then
    raise exception 'student is not available in the active branch';
  end if;

  select p.photo_storage_path into v_previous_storage_path
  from public.persons p
  where p.tenant_id = p_tenant_id and p.id = p_person_id
  for update;

  if not found then
    raise exception 'student is not available in the active branch';
  end if;

  update public.persons
  set photo_storage_path = p_storage_path,
      updated_at = now()
  where tenant_id = p_tenant_id and id = p_person_id;

  insert into public.audit_events(
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id,
    before_state, after_state, metadata
  ) values (
    p_tenant_id, p_branch_id, p_identity_id, v_membership_id,
    'students.profile.photo.update', 'succeeded', 'student', p_person_id::text, v_correlation_id,
    jsonb_build_object('photo_available', v_previous_storage_path is not null),
    jsonb_build_object('photo_available', true),
    jsonb_build_object('source', 'staff_admission_photo')
  );

  return jsonb_build_object(
    'updated', true,
    'person_id', p_person_id,
    'previous_storage_path', v_previous_storage_path
  );
end;
$function$;

revoke all on function public.update_student_photo_v1(uuid,bigint,bigint,bigint,text) from public, anon, authenticated;
grant execute on function public.update_student_photo_v1(uuid,bigint,bigint,bigint,text) to service_role;
