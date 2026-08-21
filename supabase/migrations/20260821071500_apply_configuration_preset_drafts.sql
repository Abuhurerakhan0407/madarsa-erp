-- Apply an application-owned configuration preset as versioned tenant drafts.
-- The browser never receives permission to execute this function; a trusted server
-- verifies the user session, resolves preset contents, and calls with service_role.

create or replace function public.apply_configuration_preset_drafts(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_preset_key text,
  p_terminology jsonb,
  p_attendance_statuses jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_terminology_set_id bigint;
  v_terminology_version integer;
  v_attendance_set_id bigint;
  v_attendance_version integer;
  v_term jsonb;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null or p_tenant_id is null then
    raise exception 'identity and tenant are required';
  end if;

  if p_preset_key not in (
    'maktab',
    'hifz_academy',
    'dars_e_nizami',
    'islamic_school',
    'urdu_medium_school'
  ) then
    raise exception 'unsupported configuration preset';
  end if;

  if jsonb_typeof(p_terminology) <> 'array'
     or jsonb_array_length(p_terminology) < 1
     or jsonb_array_length(p_terminology) > 100 then
    raise exception 'invalid terminology preset payload';
  end if;

  if jsonb_typeof(p_attendance_statuses) <> 'array'
     or jsonb_array_length(p_attendance_statuses) < 1
     or jsonb_array_length(p_attendance_statuses) > 32 then
    raise exception 'invalid attendance preset payload';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('configuration-preset:' || p_tenant_id::text, 0)
  );

  select m.id
    into v_membership_id
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.identity_id = p_identity_id
    and m.status = 'active'
    and (m.ends_at is null or m.ends_at > now())
    and exists (
      select 1
      from public.membership_roles mr
      join public.role_permissions rp
        on rp.tenant_id = mr.tenant_id
       and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id
        and mr.membership_id = m.id
        and rp.permission_code = 'settings.configuration.manage'
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'configuration preset permission denied';
  end if;

  select coalesce(max(ts.version), 0) + 1
    into v_terminology_version
  from public.terminology_sets ts
  where ts.tenant_id = p_tenant_id
    and ts.key = 'preset_' || p_preset_key
    and ts.scope_type = 'tenant'
    and ts.scope_key = 'tenant';

  insert into public.terminology_sets (
    tenant_id,
    key,
    version,
    status,
    scope_type,
    scope_key,
    change_reason,
    created_by_membership_id
  )
  values (
    p_tenant_id,
    'preset_' || p_preset_key,
    v_terminology_version,
    'draft',
    'tenant',
    'tenant',
    'Created from configuration preset ' || p_preset_key,
    v_membership_id
  )
  returning id into v_terminology_set_id;

  for v_term in
    select value from jsonb_array_elements(p_terminology)
  loop
    if coalesce(v_term->>'concept_key', '') !~ '^[a-z][a-z0-9_]{1,63}$'
       or coalesce(v_term->>'locale', '') not in ('en', 'ur', 'ar')
       or length(btrim(coalesce(v_term->>'singular_label', ''))) not between 1 and 120
       or length(btrim(coalesce(v_term->>'plural_label', ''))) not between 1 and 120 then
      raise exception 'invalid terminology preset entry';
    end if;

    insert into public.terminology_entries (
      tenant_id,
      terminology_set_id,
      concept_key,
      locale,
      singular_label,
      plural_label
    )
    values (
      p_tenant_id,
      v_terminology_set_id,
      v_term->>'concept_key',
      v_term->>'locale',
      btrim(v_term->>'singular_label'),
      btrim(v_term->>'plural_label')
    );
  end loop;

  select coalesce(max(ast.version), 0) + 1
    into v_attendance_version
  from public.attendance_status_sets ast
  where ast.tenant_id = p_tenant_id
    and ast.key = 'student_default'
    and ast.subject_type = 'student';

  insert into public.attendance_status_sets (
    tenant_id,
    key,
    subject_type,
    version,
    status,
    statuses,
    rules,
    created_by_membership_id
  )
  values (
    p_tenant_id,
    'student_default',
    'student',
    v_attendance_version,
    'draft',
    p_attendance_statuses,
    jsonb_build_object('source_preset', p_preset_key),
    v_membership_id
  )
  returning id into v_attendance_set_id;

  insert into public.audit_events (
    tenant_id,
    actor_identity_id,
    actor_membership_id,
    action,
    outcome,
    entity_type,
    entity_id,
    correlation_id,
    after_state,
    metadata
  )
  values (
    p_tenant_id,
    p_identity_id,
    v_membership_id,
    'configuration.preset_draft',
    'succeeded',
    'configuration_preset',
    p_preset_key,
    v_correlation_id,
    jsonb_build_object(
      'terminology_set_id', v_terminology_set_id,
      'terminology_version', v_terminology_version,
      'attendance_status_set_id', v_attendance_set_id,
      'attendance_version', v_attendance_version
    ),
    jsonb_build_object('preset_key', p_preset_key)
  );

  return jsonb_build_object(
    'preset_key', p_preset_key,
    'terminology_set_id', v_terminology_set_id,
    'terminology_version', v_terminology_version,
    'attendance_status_set_id', v_attendance_set_id,
    'attendance_version', v_attendance_version
  );
end;
$$;

revoke all on function public.apply_configuration_preset_drafts(uuid, bigint, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_configuration_preset_drafts(uuid, bigint, text, jsonb, jsonb)
  to service_role;
