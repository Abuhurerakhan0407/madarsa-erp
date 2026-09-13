create or replace function public.request_admission_information_v3(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_application_id bigint,
  p_reason text
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_application public.applications%rowtype;
  v_membership_id bigint;
  v_review_id bigint;
  v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
  v_correlation_id uuid := gen_random_uuid();
  v_progress jsonb;
begin
  if p_identity_id is null or p_tenant_id is null or p_application_id is null then
    raise exception 'identity, tenant, and application are required';
  end if;
  if v_reason is null or length(v_reason) < 8 then
    raise exception 'information request must explain what is needed';
  end if;
  if length(v_reason) > 2000 then
    raise exception 'information request is too long';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admission-info:' || p_tenant_id::text || ':' || p_application_id::text, 0)
  );

  select a.* into v_application
  from public.applications a
  where a.tenant_id = p_tenant_id and a.id = p_application_id
  for update;
  if v_application.id is null then raise exception 'admission application not found'; end if;

  if v_application.state = 'submitted' then
    v_progress := public.progress_admission_staff(
      p_identity_id,
      p_tenant_id,
      p_application_id,
      'start_review',
      null
    );
    select a.* into v_application
    from public.applications a
    where a.tenant_id = p_tenant_id and a.id = p_application_id
    for update;
  end if;

  if v_application.state <> 'verification' then
    raise exception 'information can only be requested while an application is under review';
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
          and mbs.branch_id = v_application.branch_id
      )
    )
    and exists (
      select 1
      from public.membership_roles mr
      join public.roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.status = 'active'
      join public.role_permissions rp on rp.tenant_id = mr.tenant_id and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id
        and mr.membership_id = m.id
        and rp.permission_code = 'admissions.application.review'
    )
  order by m.created_at asc
  limit 1;
  if v_membership_id is null then raise exception 'admission review permission denied'; end if;

  insert into public.application_reviews(
    tenant_id, application_id, review_type, outcome, notes,
    reviewer_membership_id, reviewed_revision
  ) values (
    p_tenant_id, p_application_id, 'completeness', 'needs_information', v_reason,
    v_membership_id, v_application.revision
  ) returning id into v_review_id;

  insert into public.audit_events(
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id,
    before_state, after_state, metadata
  ) values (
    p_tenant_id, v_application.branch_id, p_identity_id, v_membership_id,
    'admissions.application.request_information', 'succeeded', 'application', p_application_id::text, v_correlation_id,
    jsonb_build_object('state', v_application.state, 'revision', v_application.revision),
    jsonb_build_object('state', v_application.state, 'revision', v_application.revision),
    jsonb_build_object('review_id', v_review_id, 'reason', v_reason)
  );

  return jsonb_build_object(
    'application_id', p_application_id,
    'state', v_application.state,
    'revision', v_application.revision,
    'review_id', v_review_id
  );
end;
$function$;

revoke all on function public.request_admission_information_v3(uuid,bigint,bigint,text) from public, anon, authenticated;
grant execute on function public.request_admission_information_v3(uuid,bigint,bigint,text) to service_role;
