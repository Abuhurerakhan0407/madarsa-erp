-- Audit follow-up: exclude inactive roles, enforce membership scope, and pin conversion linkage.

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
    pg_catalog.hashtextextended('admission-staff:' || p_tenant_id::text || ':' || p_application_id::text, 0)
  );

  select a.* into v_application
  from public.applications a
  where a.tenant_id = p_tenant_id and a.id = p_application_id
  for update;
  if v_application.id is null then raise exception 'admission application not found'; end if;

  if p_action = 'start_review' then
    v_from := 'submitted'; v_to := 'verification'; v_permission := 'admissions.application.review';
  elsif p_action = 'complete_review' then
    v_from := 'verification'; v_to := 'decision'; v_permission := 'admissions.application.review';
  elsif p_action = 'offer' then
    v_from := 'decision'; v_to := 'offered'; v_permission := 'admissions.application.decide';
  elsif p_action = 'waitlist' then
    v_from := 'decision'; v_to := 'waitlisted'; v_permission := 'admissions.application.decide';
  else
    v_from := 'decision'; v_to := 'rejected'; v_permission := 'admissions.application.decide';
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
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.status = 'active'
      join public.role_permissions rp on rp.tenant_id = mr.tenant_id and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id
        and mr.membership_id = m.id
        and rp.permission_code = v_permission
    )
  order by m.created_at asc
  limit 1;
  if v_membership_id is null then raise exception 'admission action permission denied'; end if;

  if v_application.state <> v_from then raise exception 'admission state transition conflict'; end if;

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
  ) then raise exception 'pinned workflow transition unavailable'; end if;

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

  if v_workflow_instance_id is null or v_workflow_status <> 'active' or v_workflow_node <> v_from then
    raise exception 'admission workflow instance conflict';
  end if;

  if p_action = 'complete_review' then
    insert into public.application_reviews (
      tenant_id, application_id, review_type, outcome, notes, reviewer_membership_id, reviewed_revision
    ) values (
      p_tenant_id, p_application_id, 'final', 'pass', v_reason, v_membership_id, v_application.revision
    ) returning id into v_review_id;
  elsif p_action in ('offer','waitlist','reject') then
    insert into public.admission_decisions (
      tenant_id, application_id, outcome, reason, overrides, application_revision, decided_by_membership_id
    ) values (
      p_tenant_id,
      p_application_id,
      case p_action when 'offer' then 'offered' when 'waitlist' then 'waitlisted' else 'rejected' end,
      v_reason,
      '[]'::jsonb,
      v_application.revision,
      v_membership_id
    ) returning id into v_decision_id;
  end if;

  update public.applications
  set state = v_to,
      revision = v_application.revision + 1,
      updated_at = now()
  where tenant_id = p_tenant_id and id = p_application_id;

  update public.workflow_instances
  set current_node_key = v_to,
      status = case when v_to = 'rejected' then 'completed' else 'active' end,
      completed_at = case when v_to = 'rejected' then now() else null end,
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
    'admissions.application.' || p_action,
    'succeeded',
    'application',
    p_application_id::text,
    v_correlation_id,
    jsonb_build_object('state', v_from, 'revision', v_application.revision),
    jsonb_build_object('state', v_to, 'revision', v_application.revision + 1),
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
    'revision', v_application.revision + 1,
    'review_id', v_review_id,
    'decision_id', v_decision_id
  );
end;
$$;

revoke all on function public.progress_admission_staff(uuid, bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.progress_admission_staff(uuid, bigint, bigint, text, text) to service_role;

create or replace function public.setup_student_number_sequence(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_pattern text,
  p_start_value bigint,
  p_padding integer,
  p_reset_period text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_existing_id bigint;
  v_existing_version integer;
  v_existing_pattern text;
  v_existing_start bigint;
  v_existing_padding integer;
  v_existing_reset text;
  v_version integer;
  v_sequence_id bigint;
  v_scrubbed text;
  v_seq_count integer;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then
    raise exception 'identity, tenant, and branch are required';
  end if;

  p_pattern := btrim(coalesce(p_pattern, ''));
  if length(p_pattern) not between 3 and 160
     or p_pattern !~ '^[A-Za-z0-9_./{}-]+$' then
    raise exception 'invalid student number pattern';
  end if;

  v_seq_count := (length(p_pattern) - length(replace(p_pattern, '{SEQ}', ''))) / 5;
  if v_seq_count <> 1 then
    raise exception 'student number pattern must contain {SEQ} exactly once';
  end if;

  v_scrubbed := replace(p_pattern, '{SEQ}', '');
  v_scrubbed := replace(v_scrubbed, '{BRANCH}', '');
  v_scrubbed := replace(v_scrubbed, '{SESSION}', '');
  v_scrubbed := replace(v_scrubbed, '{YYYY}', '');
  v_scrubbed := replace(v_scrubbed, '{YY}', '');
  if v_scrubbed ~ '[{}]' then
    raise exception 'student number pattern contains an unsupported token';
  end if;

  if position('{BRANCH}' in p_pattern) = 0 then
    raise exception 'branch-scoped student number pattern requires {BRANCH}';
  end if;

  if p_reset_period not in ('never', 'yearly', 'session') then
    raise exception 'invalid student number reset period';
  end if;
  if p_reset_period = 'yearly'
     and position('{YYYY}' in p_pattern) = 0
     and position('{YY}' in p_pattern) = 0 then
    raise exception 'yearly reset requires {YYYY} or {YY}';
  end if;
  if p_reset_period = 'session' and position('{SESSION}' in p_pattern) = 0 then
    raise exception 'session reset requires {SESSION}';
  end if;

  if p_start_value is null or p_start_value < 1 or p_start_value > 999999999999 then
    raise exception 'invalid student number starting value';
  end if;
  if p_padding is null or p_padding < 1 or p_padding > 12 then
    raise exception 'invalid student number padding';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'student-numbering:' || p_tenant_id::text || ':' || p_branch_id::text,
      0
    )
  );

  select m.id
    into v_membership_id
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
      join public.roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.status = 'active'
      join public.role_permissions rp
        on rp.tenant_id = mr.tenant_id
       and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id
        and mr.membership_id = m.id
        and rp.permission_code in (
          'settings.configuration.manage',
          'settings.configuration.publish'
        )
      group by mr.membership_id
      having count(distinct rp.permission_code) = 2
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'student numbering permission denied';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.tenant_id = p_tenant_id
      and b.id = p_branch_id
      and b.status = 'active'
  ) then
    raise exception 'active tenant branch required';
  end if;

  if exists (
    select 1
    from public.number_sequences ns
    where ns.tenant_id = p_tenant_id
      and ns.branch_id is not distinct from p_branch_id
      and ns.key = 'student_default'
      and ns.entity_type <> 'student'
  ) then
    raise exception 'student number sequence key is already used by another entity';
  end if;

  select ns.id, ns.version, ns.pattern, ns.next_value, ns.padding, ns.reset_period
    into v_existing_id,
         v_existing_version,
         v_existing_pattern,
         v_existing_start,
         v_existing_padding,
         v_existing_reset
  from public.number_sequences ns
  where ns.tenant_id = p_tenant_id
    and ns.branch_id is not distinct from p_branch_id
    and ns.key = 'student_default'
    and ns.entity_type = 'student'
    and ns.status = 'published'
  order by ns.version desc
  limit 1;

  if v_existing_id is not null
     and v_existing_pattern = p_pattern
     and v_existing_start = p_start_value
     and v_existing_padding = p_padding
     and v_existing_reset = p_reset_period then
    return jsonb_build_object(
      'created', false,
      'sequence_id', v_existing_id,
      'version', v_existing_version,
      'pattern', v_existing_pattern,
      'reset_period', v_existing_reset
    );
  end if;

  if v_existing_id is not null then
    update public.number_sequences
       set status = 'retired',
           updated_at = now()
     where tenant_id = p_tenant_id
       and id = v_existing_id;
  end if;

  select coalesce(max(ns.version), 0) + 1
    into v_version
  from public.number_sequences ns
  where ns.tenant_id = p_tenant_id
    and ns.branch_id is not distinct from p_branch_id
    and ns.key = 'student_default';

  insert into public.number_sequences (
    tenant_id, branch_id, key, entity_type, version, pattern, next_value,
    padding, reset_period, reserved_values, status, effective_at, published_at,
    created_by_membership_id, published_by_membership_id
  ) values (
    p_tenant_id,
    p_branch_id,
    'student_default',
    'student',
    v_version,
    p_pattern,
    p_start_value,
    p_padding::smallint,
    p_reset_period,
    array[]::bigint[],
    'published',
    now(),
    now(),
    v_membership_id,
    v_membership_id
  ) returning id into v_sequence_id;

  insert into public.audit_events (
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id, after_state, metadata
  ) values (
    p_tenant_id,
    p_branch_id,
    p_identity_id,
    v_membership_id,
    'configuration.student_numbering.published',
    'succeeded',
    'number_sequence',
    v_sequence_id::text,
    v_correlation_id,
    jsonb_build_object(
      'key', 'student_default',
      'entity_type', 'student',
      'version', v_version,
      'pattern', p_pattern,
      'start_value', p_start_value,
      'padding', p_padding,
      'reset_period', p_reset_period,
      'status', 'published'
    ),
    jsonb_build_object(
      'superseded_sequence_id', v_existing_id,
      'branch_id', p_branch_id
    )
  );

  return jsonb_build_object(
    'created', true,
    'sequence_id', v_sequence_id,
    'version', v_version,
    'pattern', p_pattern,
    'reset_period', p_reset_period
  );
end;
$$;

revoke all on function public.setup_student_number_sequence(uuid, bigint, bigint, text, bigint, integer, text) from public, anon, authenticated;
grant execute on function public.setup_student_number_sequence(uuid, bigint, bigint, text, bigint, integer, text) to service_role;

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
      join public.roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.status = 'active'
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
    from public.admission_conversions c
    join public.enrollments e on e.tenant_id = c.tenant_id and e.id = c.enrollment_id
    where c.tenant_id = p_tenant_id and c.application_id = v_application.id
      and c.student_person_id = v_application.applicant_person_id
      and e.student_person_id = c.student_person_id
      and e.branch_id = v_application.branch_id
      and e.session_id = v_application.session_id
      and e.program_id = v_application.program_id;

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

  insert into public.admission_conversions (
    tenant_id, application_id, student_person_id, enrollment_id,
    idempotency_key, converted_by_membership_id
  ) values (
    p_tenant_id, p_application_id, v_person_id, v_enrollment_id,
    'admission-conversion:' || v_application.tracking_id::text, v_membership_id
  );

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

revoke all on function public.convert_admission_to_student(uuid, bigint, bigint, boolean) from public, anon, authenticated;
grant execute on function public.convert_admission_to_student(uuid, bigint, bigint, boolean) to service_role;

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
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
    and (
      m.all_branches or exists (
        select 1 from public.membership_branch_scopes mbs
        where mbs.tenant_id = m.tenant_id and mbs.membership_id = m.id
          and mbs.branch_id = p_branch_id
      )
    )
    and exists (
      select 1
      from public.membership_roles mr
      join public.roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.status = 'active'
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
      and (
        s.starts_on <> p_starts_on
        or s.ends_on <> p_ends_on
        or s.labels <> p_session_labels
        or s.status <> 'active'
      )
  ) then
    raise exception 'academic session key already exists with incompatible labels, dates, or state';
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
      and (
        p.branch_id is distinct from p_branch_id
        or p.labels <> p_program_labels
        or p.program_type <> p_program_type
        or p.status <> 'active'
      )
  ) then
    raise exception 'program key already exists with incompatible branch, labels, type, or state';
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
  elsif exists (
    select 1 from public.form_definitions fd
    where fd.id = v_form_definition_id and fd.tenant_id = p_tenant_id
      and (
        fd.entity_type <> 'admission_application'
        or fd.audience <> 'public'
        or fd.status <> 'active'
      )
  ) then
    raise exception 'admission form definition already exists with incompatible audience, entity, or state';
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
  elsif exists (
    select 1 from public.workflow_definitions wd
    where wd.id = v_workflow_definition_id and wd.tenant_id = p_tenant_id
      and (wd.workflow_type <> 'admission' or wd.status <> 'active')
  ) then
    raise exception 'admission workflow definition already exists with incompatible type or state';
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

revoke all on function public.setup_admissions_foundation(uuid, bigint, bigint, text, jsonb, date, date, text, jsonb, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.setup_admissions_foundation(uuid, bigint, bigint, text, jsonb, date, date, text, jsonb, text, jsonb, jsonb, jsonb) to service_role;

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
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
    and exists (
      select 1
      from public.membership_roles mr
      join public.roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.status = 'active'
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

revoke all on function public.apply_configuration_preset_drafts(uuid, bigint, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_configuration_preset_drafts(uuid, bigint, text, jsonb, jsonb) to service_role;

-- Preserve the original conversion event, never choose the latest matching enrollment.
-- Abort if any historical conversion cannot be proven uniquely from the audit trail.
do $backfill$
begin
  if exists (
    select 1 from public.applications a
    where a.state = 'enrolled' and not exists (
      select 1 from public.admission_conversions c where c.tenant_id=a.tenant_id and c.application_id=a.id
    ) and (
      select count(distinct (e.id, ev.actor_membership_id))
      from public.audit_events ev
      join public.enrollments e on e.tenant_id=ev.tenant_id and e.id=(ev.after_state->>'enrollment_id')::bigint
      join public.memberships m on m.tenant_id=ev.tenant_id and m.id=ev.actor_membership_id
      where ev.tenant_id=a.tenant_id and ev.entity_id=a.id::text
        and ev.action='admissions.application.convert' and ev.outcome='succeeded'
        and (ev.after_state->>'person_id')::bigint=a.applicant_person_id
        and e.student_person_id=a.applicant_person_id and e.branch_id=a.branch_id
        and e.session_id=a.session_id and e.program_id=a.program_id
    ) <> 1
  ) then
    raise exception 'Historical conversion linkage requires manual review';
  end if;

  insert into public.admission_conversions (
    tenant_id, application_id, student_person_id, enrollment_id,
    idempotency_key, converted_by_membership_id, converted_at
  )
  select distinct on (a.tenant_id,a.id)
    a.tenant_id,a.id,a.applicant_person_id,e.id,
    'admission-conversion:' || a.tracking_id::text,ev.actor_membership_id,ev.occurred_at
  from public.applications a
  join public.audit_events ev on ev.tenant_id=a.tenant_id and ev.entity_id=a.id::text
    and ev.action='admissions.application.convert' and ev.outcome='succeeded'
  join public.enrollments e on e.tenant_id=ev.tenant_id and e.id=(ev.after_state->>'enrollment_id')::bigint
  join public.memberships m on m.tenant_id=ev.tenant_id and m.id=ev.actor_membership_id
  where a.state='enrolled' and (ev.after_state->>'person_id')::bigint=a.applicant_person_id
    and e.student_person_id=a.applicant_person_id and e.branch_id=a.branch_id
    and e.session_id=a.session_id and e.program_id=a.program_id
    and not exists(select 1 from public.admission_conversions c where c.tenant_id=a.tenant_id and c.application_id=a.id)
  order by a.tenant_id,a.id,ev.occurred_at;
end;
$backfill$;
