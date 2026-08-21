-- Create the minimum governed prerequisites required for live admissions.
-- Public/browser roles never execute this transaction directly. The trusted app server
-- resolves the authenticated identity and tenant, then invokes with service_role.

create or replace function public.setup_admissions_foundation(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_session_key text,
  p_session_labels jsonb,
  p_starts_on date,
  p_ends_on date,
  p_program_key text,
  p_program_labels jsonb,
  p_program_type text,
  p_form_sections jsonb,
  p_workflow_nodes jsonb,
  p_workflow_transitions jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_session_id bigint;
  v_program_id bigint;
  v_form_definition_id bigint;
  v_form_version_id bigint;
  v_workflow_definition_id bigint;
  v_workflow_version_id bigint;
  v_version integer;
  v_created_session boolean := false;
  v_created_program boolean := false;
  v_created_form boolean := false;
  v_created_workflow boolean := false;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then
    raise exception 'identity, tenant, and branch are required';
  end if;

  if p_session_key !~ '^[a-z0-9][a-z0-9_-]{1,63}$'
     or p_program_key !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'invalid stable key';
  end if;

  if p_program_type not in ('general','hifz','nazra','qaida','dars_e_nizami','custom') then
    raise exception 'invalid program type';
  end if;

  if p_starts_on is null or p_ends_on is null or p_ends_on <= p_starts_on
     or p_ends_on > (p_starts_on + interval '5 years')::date then
    raise exception 'invalid academic session dates';
  end if;

  if jsonb_typeof(p_session_labels) <> 'object'
     or jsonb_typeof(p_program_labels) <> 'object'
     or length(btrim(coalesce(p_session_labels->>'en',''))) not between 1 and 120
     or length(btrim(coalesce(p_session_labels->>'ur',''))) not between 1 and 120
     or length(btrim(coalesce(p_session_labels->>'ar',''))) not between 1 and 120
     or length(btrim(coalesce(p_program_labels->>'en',''))) not between 1 and 120
     or length(btrim(coalesce(p_program_labels->>'ur',''))) not between 1 and 120
     or length(btrim(coalesce(p_program_labels->>'ar',''))) not between 1 and 120 then
    raise exception 'invalid multilingual labels';
  end if;

  if jsonb_typeof(p_form_sections) <> 'array'
     or jsonb_array_length(p_form_sections) < 1
     or jsonb_array_length(p_form_sections) > 20 then
    raise exception 'invalid admission form sections';
  end if;

  if jsonb_typeof(p_workflow_nodes) <> 'array'
     or jsonb_array_length(p_workflow_nodes) < 2
     or jsonb_array_length(p_workflow_nodes) > 32
     or jsonb_typeof(p_workflow_transitions) <> 'array'
     or jsonb_array_length(p_workflow_transitions) < 1
     or jsonb_array_length(p_workflow_transitions) > 96 then
    raise exception 'invalid admission workflow';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admissions-foundation:' || p_tenant_id::text, 0)
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
        and rp.permission_code in (
          'academics.structure.manage',
          'settings.configuration.manage',
          'settings.configuration.publish'
        )
      group by mr.membership_id
      having count(distinct rp.permission_code) = 3
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'admissions foundation permission denied';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.tenant_id = p_tenant_id and b.id = p_branch_id and b.status = 'active'
  ) then
    raise exception 'active tenant branch required';
  end if;

  select s.id
    into v_session_id
  from public.academic_sessions s
  where s.tenant_id = p_tenant_id and s.key = p_session_key
  limit 1;

  if v_session_id is null then
    insert into public.academic_sessions (
      tenant_id, key, labels, starts_on, ends_on, status, is_default
    ) values (
      p_tenant_id,
      p_session_key,
      p_session_labels,
      p_starts_on,
      p_ends_on,
      'active',
      not exists (
        select 1 from public.academic_sessions s
        where s.tenant_id = p_tenant_id and s.is_default and s.status in ('draft','active','closing')
      )
    ) returning id into v_session_id;
    v_created_session := true;
  elsif exists (
    select 1 from public.academic_sessions s
    where s.id = v_session_id and s.tenant_id = p_tenant_id
      and (s.starts_on <> p_starts_on or s.ends_on <> p_ends_on or s.status in ('closed','archived'))
  ) then
    raise exception 'academic session key already exists with incompatible dates or state';
  end if;

  select p.id
    into v_program_id
  from public.programs p
  where p.tenant_id = p_tenant_id and p.key = p_program_key
  limit 1;

  if v_program_id is null then
    insert into public.programs (
      tenant_id, branch_id, key, labels, program_type, allows_concurrent_enrollment, status
    ) values (
      p_tenant_id,
      p_branch_id,
      p_program_key,
      p_program_labels,
      p_program_type,
      true,
      'active'
    ) returning id into v_program_id;
    v_created_program := true;
  elsif exists (
    select 1 from public.programs p
    where p.id = v_program_id and p.tenant_id = p_tenant_id
      and (p.program_type <> p_program_type or p.status <> 'active')
  ) then
    raise exception 'program key already exists with incompatible type or state';
  end if;

  select fd.id
    into v_form_definition_id
  from public.form_definitions fd
  where fd.tenant_id = p_tenant_id and fd.key = 'admission_application'
  limit 1;

  if v_form_definition_id is null then
    insert into public.form_definitions (
      tenant_id, key, entity_type, audience, status
    ) values (
      p_tenant_id, 'admission_application', 'admission_application', 'public', 'active'
    ) returning id into v_form_definition_id;
  end if;

  select fv.id
    into v_form_version_id
  from public.form_versions fv
  where fv.tenant_id = p_tenant_id
    and fv.form_definition_id = v_form_definition_id
    and fv.status = 'published'
  order by fv.version desc
  limit 1;

  if v_form_version_id is null then
    select coalesce(max(fv.version),0) + 1
      into v_version
    from public.form_versions fv
    where fv.tenant_id = p_tenant_id and fv.form_definition_id = v_form_definition_id;

    insert into public.form_versions (
      tenant_id, form_definition_id, version, status, labels, sections,
      submission_rules, validation_result, effective_at, published_at,
      created_by_membership_id, published_by_membership_id
    ) values (
      p_tenant_id,
      v_form_definition_id,
      v_version,
      'published',
      jsonb_build_object(
        'en','Admission application',
        'ur','داخلہ درخواست',
        'ar','طلب الالتحاق'
      ),
      p_form_sections,
      jsonb_build_object(
        'allowed_locales', jsonb_build_array('en','ur','ar'),
        'requires_consent', true,
        'source', 'guided_admissions_foundation'
      ),
      jsonb_build_object('valid', true, 'source', 'guided_admissions_foundation'),
      now(), now(), v_membership_id, v_membership_id
    ) returning id into v_form_version_id;
    v_created_form := true;
  end if;

  select wd.id
    into v_workflow_definition_id
  from public.workflow_definitions wd
  where wd.tenant_id = p_tenant_id and wd.key = 'admission_default'
  limit 1;

  if v_workflow_definition_id is null then
    insert into public.workflow_definitions (
      tenant_id, key, workflow_type, labels, status
    ) values (
      p_tenant_id,
      'admission_default',
      'admission',
      jsonb_build_object(
        'en','Default admission workflow',
        'ur','بنیادی داخلہ طریقۂ کار',
        'ar','مسار القبول الافتراضي'
      ),
      'active'
    ) returning id into v_workflow_definition_id;
  end if;

  select wv.id
    into v_workflow_version_id
  from public.workflow_versions wv
  where wv.tenant_id = p_tenant_id
    and wv.workflow_definition_id = v_workflow_definition_id
    and wv.status = 'published'
  order by wv.version desc
  limit 1;

  if v_workflow_version_id is null then
    select coalesce(max(wv.version),0) + 1
      into v_version
    from public.workflow_versions wv
    where wv.tenant_id = p_tenant_id and wv.workflow_definition_id = v_workflow_definition_id;

    insert into public.workflow_versions (
      tenant_id, workflow_definition_id, version, status, nodes, transitions,
      validation_result, impact_summary, effective_at, published_at,
      created_by_membership_id, published_by_membership_id
    ) values (
      p_tenant_id,
      v_workflow_definition_id,
      v_version,
      'published',
      p_workflow_nodes,
      p_workflow_transitions,
      jsonb_build_object('valid', true, 'start_key', 'submitted', 'source', 'guided_admissions_foundation'),
      jsonb_build_object('new_applications_only', true),
      now(), now(), v_membership_id, v_membership_id
    ) returning id into v_workflow_version_id;
    v_created_workflow := true;
  end if;

  insert into public.audit_events (
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id, after_state, metadata
  ) values (
    p_tenant_id,
    p_branch_id,
    p_identity_id,
    v_membership_id,
    'admissions.foundation_setup',
    'succeeded',
    'admissions_foundation',
    p_session_key || ':' || p_program_key,
    v_correlation_id,
    jsonb_build_object(
      'session_id', v_session_id,
      'program_id', v_program_id,
      'form_version_id', v_form_version_id,
      'workflow_version_id', v_workflow_version_id
    ),
    jsonb_build_object(
      'created_session', v_created_session,
      'created_program', v_created_program,
      'created_form', v_created_form,
      'created_workflow', v_created_workflow
    )
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'program_id', v_program_id,
    'form_version_id', v_form_version_id,
    'workflow_version_id', v_workflow_version_id,
    'created', jsonb_build_object(
      'session', v_created_session,
      'program', v_created_program,
      'form', v_created_form,
      'workflow', v_created_workflow
    )
  );
end;
$$;

revoke all on function public.setup_admissions_foundation(
  uuid, bigint, bigint, text, jsonb, date, date, text, jsonb, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.setup_admissions_foundation(
  uuid, bigint, bigint, text, jsonb, date, date, text, jsonb, text, jsonb, jsonb, jsonb
) to service_role;
