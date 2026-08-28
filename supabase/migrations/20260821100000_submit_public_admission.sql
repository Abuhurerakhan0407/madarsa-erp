-- Guarded public admissions submission. The anonymous browser never executes this RPC directly.
-- The trusted app server validates the published form, hashes the source and tracking secret,
-- then invokes with service_role. Tenant/program/session/form/workflow are resolved again here.

create or replace function public.submit_public_admission(
  p_tenant_slug text,
  p_session_key text,
  p_program_key text,
  p_preferred_locale text,
  p_answers jsonb,
  p_consent boolean,
  p_tracking_secret_hash text,
  p_source_hash text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_tenant_id bigint;
  v_primary_branch_id bigint;
  v_branch_id bigint;
  v_session_id bigint;
  v_program_id bigint;
  v_form_definition_id bigint;
  v_form_version_id bigint;
  v_form_sections jsonb;
  v_workflow_definition_id bigint;
  v_workflow_version_id bigint;
  v_application_id bigint;
  v_tracking_id uuid;
  v_workflow_instance_id bigint;
  v_required_key text;
  v_recent_attempts integer;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_tenant_slug is null or p_tenant_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid tenant slug';
  end if;
  if p_session_key is null or p_session_key !~ '^[a-z0-9][a-z0-9_-]{1,63}$'
     or p_program_key is null or p_program_key !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'invalid academic selection';
  end if;
  if p_preferred_locale not in ('en','ur','ar') then
    raise exception 'invalid preferred locale';
  end if;
  if p_consent is distinct from true then
    raise exception 'consent required';
  end if;
  if p_tracking_secret_hash is null or p_tracking_secret_hash !~ '^[0-9a-f]{64}$'
     or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid security hash';
  end if;
  if jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 32768 then
    raise exception 'invalid application answers';
  end if;
  if exists (
    select 1 from jsonb_each(p_answers) answer
    where jsonb_typeof(answer.value) <> 'string'
  ) then
    raise exception 'application answers must be strings';
  end if;

  select t.id, t.primary_branch_id
    into v_tenant_id, v_primary_branch_id
  from public.tenants t
  where t.slug = p_tenant_slug
    and t.state in ('onboarding','trial','active','grace')
  limit 1;

  if v_tenant_id is null or v_primary_branch_id is null then
    raise exception 'admissions unavailable';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.tenant_id = v_tenant_id
      and b.id = v_primary_branch_id
      and b.status = 'active'
  ) then
    raise exception 'admissions branch unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'public-admission:' || v_tenant_id::text || ':' || p_source_hash,
      0
    )
  );

  select count(*)::integer
    into v_recent_attempts
  from public.security_rate_limit_events e
  where e.tenant_id = v_tenant_id
    and e.action_key = 'public_admission_submit'
    and e.source_hash = p_source_hash
    and e.occurred_at >= now() - interval '15 minutes';

  if v_recent_attempts >= 5 then
    insert into public.security_rate_limit_events (
      tenant_id, action_key, source_hash, decision, limit_snapshot, correlation_id
    ) values (
      v_tenant_id,
      'public_admission_submit',
      p_source_hash,
      'throttled',
      jsonb_build_object('limit', 5, 'window_minutes', 15, 'observed', v_recent_attempts),
      v_correlation_id
    );

    return jsonb_build_object('rate_limited', true);
  end if;

  select s.id
    into v_session_id
  from public.academic_sessions s
  where s.tenant_id = v_tenant_id
    and s.key = p_session_key
    and s.status = 'active'
  limit 1;

  if v_session_id is null then
    raise exception 'academic session unavailable';
  end if;

  select p.id, coalesce(p.branch_id, v_primary_branch_id)
    into v_program_id, v_branch_id
  from public.programs p
  where p.tenant_id = v_tenant_id
    and p.key = p_program_key
    and p.status = 'active'
    and (p.branch_id is null or p.branch_id = v_primary_branch_id)
  limit 1;

  if v_program_id is null or v_branch_id is null then
    raise exception 'program unavailable';
  end if;

  select fd.id
    into v_form_definition_id
  from public.form_definitions fd
  where fd.tenant_id = v_tenant_id
    and fd.key = 'admission_application'
    and fd.entity_type = 'admission_application'
    and fd.audience = 'public'
    and fd.status = 'active'
  limit 1;

  if v_form_definition_id is null then
    raise exception 'published admission form unavailable';
  end if;

  select fv.id, fv.sections
    into v_form_version_id, v_form_sections
  from public.form_versions fv
  where fv.tenant_id = v_tenant_id
    and fv.form_definition_id = v_form_definition_id
    and fv.status = 'published'
    and fv.published_at is not null
    and fv.effective_at is not null
  order by fv.version desc
  limit 1;

  if v_form_version_id is null or jsonb_typeof(v_form_sections) <> 'array' then
    raise exception 'published admission form unavailable';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_answers) submitted(key)
    where not exists (
      select 1
      from jsonb_array_elements(v_form_sections) section(value)
      cross join lateral jsonb_array_elements(section.value->'fields') field(value)
      where field.value->>'key' = submitted.key
    )
  ) then
    raise exception 'unknown admission form field';
  end if;

  for v_required_key in
    select field.value->>'key'
    from jsonb_array_elements(v_form_sections) section(value)
    cross join lateral jsonb_array_elements(section.value->'fields') field(value)
    where coalesce((field.value->>'required')::boolean, false)
  loop
    if length(btrim(coalesce(p_answers->>v_required_key, ''))) = 0 then
      raise exception 'required admission field missing';
    end if;
  end loop;

  select wd.id
    into v_workflow_definition_id
  from public.workflow_definitions wd
  where wd.tenant_id = v_tenant_id
    and wd.key = 'admission_default'
    and wd.workflow_type = 'admission'
    and wd.status = 'active'
  limit 1;

  if v_workflow_definition_id is null then
    raise exception 'published admission workflow unavailable';
  end if;

  select wv.id
    into v_workflow_version_id
  from public.workflow_versions wv
  where wv.tenant_id = v_tenant_id
    and wv.workflow_definition_id = v_workflow_definition_id
    and wv.status = 'published'
    and wv.published_at is not null
    and wv.effective_at is not null
    and coalesce((wv.validation_result->>'valid')::boolean, false)
    and wv.validation_result->>'start_key' = 'submitted'
  order by wv.version desc
  limit 1;

  if v_workflow_version_id is null then
    raise exception 'published admission workflow unavailable';
  end if;

  insert into public.security_rate_limit_events (
    tenant_id, action_key, source_hash, decision, limit_snapshot, correlation_id
  ) values (
    v_tenant_id,
    'public_admission_submit',
    p_source_hash,
    'allowed',
    jsonb_build_object('limit', 5, 'window_minutes', 15, 'observed', v_recent_attempts),
    v_correlation_id
  );

  insert into public.applications (
    tenant_id, branch_id, session_id, program_id, form_version_id, workflow_version_id,
    tracking_secret_hash, applicant_data, state, revision, preferred_locale, consent,
    submitted_at
  ) values (
    v_tenant_id,
    v_branch_id,
    v_session_id,
    v_program_id,
    v_form_version_id,
    v_workflow_version_id,
    p_tracking_secret_hash,
    p_answers,
    'submitted',
    1,
    p_preferred_locale,
    jsonb_build_object('privacy', true, 'submitted_at', now()),
    now()
  ) returning id, tracking_id into v_application_id, v_tracking_id;

  insert into public.application_versions (
    tenant_id, application_id, revision, core_answers, custom_answers, validation_snapshot
  ) values (
    v_tenant_id,
    v_application_id,
    1,
    p_answers,
    '{}'::jsonb,
    jsonb_build_object(
      'valid', true,
      'form_version_id', v_form_version_id,
      'source', 'public_admission_intake'
    )
  );

  insert into public.workflow_instances (
    tenant_id, branch_id, workflow_version_id, subject_type, subject_key,
    current_node_key, status, context
  ) values (
    v_tenant_id,
    v_branch_id,
    v_workflow_version_id,
    'admission_application',
    v_tracking_id::text,
    'submitted',
    'active',
    jsonb_build_object('application_id', v_application_id, 'tracking_id', v_tracking_id)
  ) returning id into v_workflow_instance_id;

  insert into public.audit_events (
    tenant_id, branch_id, action, outcome, entity_type, entity_id,
    correlation_id, after_state, metadata
  ) values (
    v_tenant_id,
    v_branch_id,
    'admissions.application.submitted_public',
    'succeeded',
    'application',
    v_application_id::text,
    v_correlation_id,
    jsonb_build_object(
      'state', 'submitted',
      'revision', 1,
      'workflow_instance_id', v_workflow_instance_id
    ),
    jsonb_build_object(
      'session_id', v_session_id,
      'program_id', v_program_id,
      'form_version_id', v_form_version_id,
      'workflow_version_id', v_workflow_version_id,
      'preferred_locale', p_preferred_locale
    )
  );

  return jsonb_build_object(
    'rate_limited', false,
    'application_id', v_application_id,
    'tracking_id', v_tracking_id,
    'state', 'submitted'
  );
end;
$$;

revoke all on function public.submit_public_admission(
  text, text, text, text, jsonb, boolean, text, text
) from public, anon, authenticated;

grant execute on function public.submit_public_admission(
  text, text, text, text, jsonb, boolean, text, text
) to service_role;
