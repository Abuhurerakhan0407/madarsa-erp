-- Convert an accepted admission application into a permanent SIS student atomically.
-- The browser never writes persons, profiles, enrollments, workflow state, or number counters directly.

create or replace function public.convert_admission_to_student(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_application_id bigint,
  p_confirm_new_person boolean default false
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
  v_session_start date;
  v_session_end date;
  v_session_status text;
  v_program_branch_id bigint;
  v_program_status text;
  v_applicant_name text;
  v_normalized_name text;
  v_dob_text text;
  v_date_of_birth date;
  v_candidate_count integer := 0;
  v_person_id bigint;
  v_person_status text;
  v_student_number text;
  v_student_profile_exists boolean := false;
  v_enrollment_id bigint;
  v_enrollment_start date;
  v_correlation_id uuid := gen_random_uuid();
  v_confirm_new_person boolean := coalesce(p_confirm_new_person, false);
begin
  if p_identity_id is null or p_tenant_id is null or p_application_id is null then
    raise exception 'identity, tenant, and application are required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'admission-conversion:' || p_tenant_id::text || ':' || p_application_id::text,
      0
    )
  );

  select a.* into v_application
  from public.applications a
  where a.tenant_id = p_tenant_id and a.id = p_application_id
  for update;

  if v_application.id is null then
    raise exception 'admission application not found';
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
      join public.role_permissions rp
        on rp.tenant_id = mr.tenant_id
       and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id
        and mr.membership_id = m.id
        and rp.permission_code in (
          'admissions.application.convert',
          'academics.enrollment.manage',
          'students.profile.update',
          'people.person.manage'
        )
      group by mr.membership_id
      having count(distinct rp.permission_code) = 4
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'admission conversion permission denied';
  end if;

  if v_application.state = 'enrolled' then
    if v_application.converted_at is null or v_application.applicant_person_id is null then
      raise exception 'enrolled application is missing conversion linkage';
    end if;

    select sp.student_number into v_student_number
    from public.student_profiles sp
    where sp.tenant_id = p_tenant_id
      and sp.person_id = v_application.applicant_person_id;

    select e.id into v_enrollment_id
    from public.enrollments e
    where e.tenant_id = p_tenant_id
      and e.student_person_id = v_application.applicant_person_id
      and e.branch_id = v_application.branch_id
      and e.session_id = v_application.session_id
      and e.program_id = v_application.program_id
    order by e.id desc
    limit 1;

    if v_student_number is null or v_enrollment_id is null then
      raise exception 'enrolled application conversion linkage is inconsistent';
    end if;

    return jsonb_build_object(
      'converted', false,
      'idempotent', true,
      'duplicate_review_required', false,
      'application_id', v_application.id,
      'person_id', v_application.applicant_person_id,
      'student_number', v_student_number,
      'enrollment_id', v_enrollment_id,
      'state', 'enrolled',
      'revision', v_application.revision
    );
  end if;

  if v_application.state not in ('offered', 'payment_pending') then
    raise exception 'application must be offered or payment pending before conversion';
  end if;

  if not exists (
    select 1
    from public.workflow_versions wv
    cross join lateral jsonb_array_elements(wv.transitions) transition(value)
    where wv.tenant_id = p_tenant_id
      and wv.id = v_application.workflow_version_id
      and wv.status = 'published'
      and transition.value->>'from' = v_application.state
      and transition.value->>'to' = 'enrolled'
      and transition.value->>'permission' = 'admissions.application.convert'
  ) then
    raise exception 'pinned workflow conversion transition unavailable';
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
     or v_workflow_node <> v_application.state then
    raise exception 'admission workflow instance conflict';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.tenant_id = p_tenant_id
      and b.id = v_application.branch_id
      and b.status = 'active'
  ) then
    raise exception 'active application branch required';
  end if;

  select s.starts_on, s.ends_on, s.status
    into v_session_start, v_session_end, v_session_status
  from public.academic_sessions s
  where s.tenant_id = p_tenant_id and s.id = v_application.session_id;

  if v_session_start is null
     or v_session_status <> 'active'
     or current_date > v_session_end then
    raise exception 'active academic session required for conversion';
  end if;

  select p.branch_id, p.status
    into v_program_branch_id, v_program_status
  from public.programs p
  where p.tenant_id = p_tenant_id and p.id = v_application.program_id;

  if v_program_status is null
     or v_program_status <> 'active'
     or (v_program_branch_id is not null and v_program_branch_id <> v_application.branch_id) then
    raise exception 'active application program is not valid for this branch';
  end if;

  if not exists (
    select 1 from public.number_sequences ns
    where ns.tenant_id = p_tenant_id
      and ns.branch_id is not distinct from v_application.branch_id
      and ns.key = 'student_default'
      and ns.entity_type = 'student'
      and ns.status = 'published'
      and ns.effective_at is not null
      and ns.effective_at <= now()
  ) then
    raise exception 'published student numbering required before conversion';
  end if;

  v_applicant_name := btrim(coalesce(v_application.applicant_data->>'applicant_name', ''));
  if length(v_applicant_name) not between 2 and 160 then
    raise exception 'valid applicant name required before conversion';
  end if;
  v_normalized_name := lower(regexp_replace(v_applicant_name, '\s+', ' ', 'g'));

  v_dob_text := nullif(btrim(coalesce(v_application.applicant_data->>'date_of_birth', '')), '');
  if v_dob_text is not null then
    if v_dob_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'invalid applicant date of birth';
    end if;
    begin
      v_date_of_birth := v_dob_text::date;
    exception when others then
      raise exception 'invalid applicant date of birth';
    end;
  end if;

  if v_application.applicant_person_id is not null then
    select p.id, p.status into v_person_id, v_person_status
    from public.persons p
    where p.tenant_id = p_tenant_id
      and p.id = v_application.applicant_person_id
    for update;

    if v_person_id is null or v_person_status in ('merged', 'archived', 'deceased') then
      raise exception 'linked applicant person is unavailable for conversion';
    end if;
  else
    select count(*)::integer into v_candidate_count
    from public.persons p
    where p.tenant_id = p_tenant_id
      and p.status not in ('merged', 'archived')
      and lower(regexp_replace(btrim(p.display_name), '\s+', ' ', 'g')) = v_normalized_name
      and (v_date_of_birth is null or p.date_of_birth is not distinct from v_date_of_birth);

    if v_candidate_count > 0 and not v_confirm_new_person then
      update public.applications
      set duplicate_review_status = 'possible',
          updated_at = now()
      where tenant_id = p_tenant_id and id = p_application_id;

      insert into public.audit_events (
        tenant_id, branch_id, actor_identity_id, actor_membership_id,
        action, outcome, entity_type, entity_id, correlation_id,
        before_state, after_state, metadata
      ) values (
        p_tenant_id,
        v_application.branch_id,
        p_identity_id,
        v_membership_id,
        'admissions.application.duplicate_review_required',
        'denied',
        'application',
        p_application_id::text,
        v_correlation_id,
        jsonb_build_object('duplicate_review_status', v_application.duplicate_review_status),
        jsonb_build_object('duplicate_review_status', 'possible'),
        jsonb_build_object('candidate_count', v_candidate_count)
      );

      return jsonb_build_object(
        'converted', false,
        'idempotent', false,
        'duplicate_review_required', true,
        'candidate_count', v_candidate_count,
        'application_id', p_application_id,
        'state', v_application.state,
        'revision', v_application.revision
      );
    end if;

    insert into public.persons (
      tenant_id, display_name, date_of_birth, preferred_locale, status, metadata
    ) values (
      p_tenant_id,
      v_applicant_name,
      v_date_of_birth,
      v_application.preferred_locale,
      'active',
      jsonb_build_object(
        'source', 'admission_conversion',
        'application_id', p_application_id,
        'application_tracking_id', v_application.tracking_id
      )
    ) returning id into v_person_id;
  end if;

  select exists (
    select 1 from public.student_profiles sp
    where sp.tenant_id = p_tenant_id and sp.person_id = v_person_id
  ) into v_student_profile_exists;

  if v_student_profile_exists then
    select sp.student_number into v_student_number
    from public.student_profiles sp
    where sp.tenant_id = p_tenant_id and sp.person_id = v_person_id;

    if exists (
      select 1 from public.enrollments e
      where e.tenant_id = p_tenant_id
        and e.student_person_id = v_person_id
        and e.session_id = v_application.session_id
        and e.program_id = v_application.program_id
        and e.status in ('planned', 'active', 'paused')
    ) then
      raise exception 'student already has enrollment for application session and program';
    end if;
  else
    v_student_number := private.reserve_formatted_number(
      p_tenant_id,
      'student_default',
      v_application.branch_id,
      v_application.session_id,
      greatest(current_date, v_session_start)
    );

    insert into public.student_profiles (
      person_id, tenant_id, student_number, joined_on, status
    ) values (
      v_person_id,
      p_tenant_id,
      v_student_number,
      greatest(current_date, v_session_start),
      'active'
    );
  end if;

  v_enrollment_start := greatest(current_date, v_session_start);

  insert into public.enrollments (
    tenant_id, branch_id, student_person_id, session_id, program_id,
    starts_on, status, version
  ) values (
    p_tenant_id,
    v_application.branch_id,
    v_person_id,
    v_application.session_id,
    v_application.program_id,
    v_enrollment_start,
    'active',
    1
  ) returning id into v_enrollment_id;

  insert into public.enrollment_events (
    tenant_id, enrollment_id, event_type, from_state, to_state,
    reason, actor_membership_id, correlation_id
  ) values (
    p_tenant_id,
    v_enrollment_id,
    'created',
    null,
    jsonb_build_object(
      'status', 'active',
      'branch_id', v_application.branch_id,
      'session_id', v_application.session_id,
      'program_id', v_application.program_id,
      'version', 1
    ),
    'Created from accepted admission application',
    v_membership_id,
    v_correlation_id
  );

  update public.applications
  set applicant_person_id = v_person_id,
      duplicate_review_status = case
        when v_candidate_count > 0 and v_confirm_new_person then 'resolved'
        else 'clear'
      end,
      state = 'enrolled',
      revision = v_application.revision + 1,
      converted_at = now(),
      updated_at = now()
  where tenant_id = p_tenant_id and id = p_application_id;

  update public.workflow_instances
  set current_node_key = 'enrolled',
      status = 'completed',
      completed_at = now(),
      updated_at = now()
  where tenant_id = p_tenant_id and id = v_workflow_instance_id;

  insert into public.audit_events (
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id,
    before_state, after_state, metadata
  ) values (
    p_tenant_id,
    v_application.branch_id,
    p_identity_id,
    v_membership_id,
    'admissions.application.convert',
    'succeeded',
    'application',
    p_application_id::text,
    v_correlation_id,
    jsonb_build_object(
      'state', v_application.state,
      'revision', v_application.revision,
      'duplicate_review_status', v_application.duplicate_review_status
    ),
    jsonb_build_object(
      'state', 'enrolled',
      'revision', v_application.revision + 1,
      'person_id', v_person_id,
      'student_number', v_student_number,
      'enrollment_id', v_enrollment_id
    ),
    jsonb_build_object(
      'workflow_version_id', v_application.workflow_version_id,
      'workflow_instance_id', v_workflow_instance_id,
      'required_permissions', jsonb_build_array(
        'admissions.application.convert',
        'academics.enrollment.manage',
        'students.profile.update',
        'people.person.manage'
      ),
      'confirmed_new_person', v_confirm_new_person,
      'candidate_count', v_candidate_count
    )
  );

  return jsonb_build_object(
    'converted', true,
    'idempotent', false,
    'duplicate_review_required', false,
    'application_id', p_application_id,
    'person_id', v_person_id,
    'student_number', v_student_number,
    'enrollment_id', v_enrollment_id,
    'state', 'enrolled',
    'revision', v_application.revision + 1
  );
end;
$$;

revoke all on function public.convert_admission_to_student(uuid, bigint, bigint, boolean)
  from public, anon, authenticated;
grant execute on function public.convert_admission_to_student(uuid, bigint, bigint, boolean)
  to service_role;