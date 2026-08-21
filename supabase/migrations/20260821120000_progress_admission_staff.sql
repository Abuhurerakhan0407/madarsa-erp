-- Governed staff progression for admission applications.
-- Browser roles never execute this transaction directly. The trusted app server
-- resolves the authenticated identity and tenant, then invokes with service_role.
-- Every requested transition must exist in the application's pinned workflow version.

create or replace function public.progress_admission_staff(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_application_id bigint,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_application public.applications%rowtype;
  v_workflow_instance_id bigint;
  v_workflow_node text;
  v_workflow_status text;
  v_from text;
  v_to text;
  v_permission text;
  v_review_id bigint;
  v_decision_id bigint;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null or p_tenant_id is null or p_application_id is null then
    raise exception 'identity, tenant, and application are required';
  end if;

  if p_action not in ('start_review','complete_review','offer','waitlist','reject') then
    raise exception 'invalid admission action';
  end if;

  if v_reason is not null and length(v_reason) > 2000 then
    raise exception 'reason is too long';
  end if;

  if p_action in ('offer','waitlist','reject') and coalesce(length(v_reason), 0) < 8 then
    raise exception 'decision reason must contain at least 8 characters';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'admission-staff:' || p_tenant_id::text || ':' || p_application_id::text,
      0
    )
  );

  select a.*
    into v_application
  from public.applications a
  where a.tenant_id = p_tenant_id
    and a.id = p_application_id
  for update;

  if v_application.id is null then
    raise exception 'admission application not found';
  end if;

  if p_action = 'start_review' then
    v_from := 'submitted';
    v_to := 'verification';
    v_permission := 'admissions.application.review';
  elsif p_action = 'complete_review' then
    v_from := 'verification';
    v_to := 'decision';
    v_permission := 'admissions.application.review';
  elsif p_action = 'offer' then
    v_from := 'decision';
    v_to := 'offered';
    v_permission := 'admissions.application.decide';
  elsif p_action = 'waitlist' then
    v_from := 'decision';
    v_to := 'waitlisted';
    v_permission := 'admissions.application.decide';
  else
    v_from := 'decision';
    v_to := 'rejected';
    v_permission := 'admissions.application.decide';
  end if;

  if v_application.state <> v_from then
    raise exception 'admission state transition conflict';
  end if;

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
        and rp.permission_code = v_permission
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'admission action permission denied';
  end if;

  if not exists (
    select 1
    from public.workflow_versions wv
    cross join lateral jsonb_array_elements(wv.transitions) transition(value)
    where wv.tenant_id = p_tenant_id
      and wv.id = v_application.workflow_version_id
      and wv.status = 'published'
      and transition.value->>'from' = v_from
      and transition.value->>'to' = v_to
      and transition.value->>'permission' = v_permission
  ) then
    raise exception 'pinned workflow transition unavailable';
  end if;

  select wi.id, wi.current_node_key, wi.status
    into v_workflow_instance_id, v_workflow_node, v_workflow_status
  from public.workflow_instances wi
  where wi.tenant_id = p_tenant_id
    and wi.workflow_version_id = v_application.workflow_version_id
    and wi.subject_type = 'admission_application'
    and wi.subject_key = v_application.tracking_id::text
  order by wi.id desc
  limit 1
  for update;

  if v_workflow_instance_id is null
     or v_workflow_status <> 'active'
     or v_workflow_node <> v_from then
    raise exception 'admission workflow instance conflict';
  end if;

  if p_action = 'complete_review' then
    insert into public.application_reviews (
      tenant_id, application_id, review_type, outcome, notes,
      reviewer_membership_id, reviewed_revision
    ) values (
      p_tenant_id,
      p_application_id,
      'final',
      'pass',
      v_reason,
      v_membership_id,
      v_application.revision
    ) returning id into v_review_id;
  elsif p_action in ('offer','waitlist','reject') then
    insert into public.admission_decisions (
      tenant_id, application_id, outcome, reason, overrides,
      application_revision, decided_by_membership_id
    ) values (
      p_tenant_id,
      p_application_id,
      case p_action
        when 'offer' then 'offered'
        when 'waitlist' then 'waitlisted'
        else 'rejected'
      end,
      v_reason,
      '[]'::jsonb,
      v_application.revision,
      v_membership_id
    ) returning id into v_decision_id;
  end if;

  update public.applications
  set state = v_to,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = p_application_id;

  update public.workflow_instances
  set current_node_key = v_to,
      status = case when v_to = 'rejected' then 'completed' else 'active' end,
      completed_at = case when v_to = 'rejected' then now() else null end,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = v_workflow_instance_id;

  insert into public.audit_events (
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id,
    before_state, after_state, metadata
  ) values (
    p_tenant_id,
    v_application.branch_id,
    p_identity_id,
    v_membership_id,
    'admissions.application.' || p_action,
    'succeeded',
    'application',
    p_application_id::text,
    v_correlation_id,
    jsonb_build_object('state', v_from, 'revision', v_application.revision),
    jsonb_build_object('state', v_to, 'revision', v_application.revision),
    jsonb_build_object(
      'workflow_version_id', v_application.workflow_version_id,
      'workflow_instance_id', v_workflow_instance_id,
      'required_permission', v_permission,
      'review_id', v_review_id,
      'decision_id', v_decision_id
    )
  );

  return jsonb_build_object(
    'application_id', p_application_id,
    'state', v_to,
    'review_id', v_review_id,
    'decision_id', v_decision_id
  );
end;
$$;

revoke all on function public.progress_admission_staff(uuid, bigint, bigint, text, text)
  from public, anon, authenticated;

grant execute on function public.progress_admission_staff(uuid, bigint, bigint, text, text)
  to service_role;
