begin;

create or replace function public.save_staff_admission_draft_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_application_id bigint,
  p_session_id bigint,
  p_program_id bigint,
  p_group_id bigint,
  p_preferred_locale text,
  p_applicant_data jsonb,
  p_tracking_secret_hash text default null,
  p_photo_token_digest text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor bigint;
  v_application public.applications%rowtype;
  v_form_version_id bigint;
  v_workflow_version_id bigint;
  v_group_key text;
  v_revision integer;
  v_photo_id bigint;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then
    raise exception 'identity, tenant, and branch are required';
  end if;

  v_actor := private.resolve_staff_membership(
    p_identity_id,
    p_tenant_id,
    p_branch_id,
    array['admissions.application.review']
  );
  if v_actor is null then
    raise exception 'admission draft permission denied';
  end if;

  if p_preferred_locale not in ('en','ur') then
    raise exception 'preferred language is invalid';
  end if;
  if jsonb_typeof(p_applicant_data) <> 'object' or pg_column_size(p_applicant_data) > 32768 then
    raise exception 'admission draft data is invalid';
  end if;
  if not exists (
    select 1 from public.branches b
    where b.tenant_id = p_tenant_id and b.id = p_branch_id and b.status = 'active'
  ) then
    raise exception 'active branch is required';
  end if;
  if not exists (
    select 1 from public.academic_sessions s
    where s.tenant_id = p_tenant_id and s.id = p_session_id and s.status = 'active'
  ) then
    raise exception 'active academic session is required';
  end if;
  if not exists (
    select 1 from public.programs p
    where p.tenant_id = p_tenant_id
      and p.id = p_program_id
      and p.status = 'active'
      and (p.branch_id is null or p.branch_id = p_branch_id)
  ) then
    raise exception 'active program is not valid for this branch';
  end if;

  if p_group_id is not null then
    select g.key into v_group_key
    from public.academic_groups g
    where g.tenant_id = p_tenant_id
      and g.id = p_group_id
      and g.branch_id = p_branch_id
      and g.session_id = p_session_id
      and g.program_id = p_program_id
      and g.status = 'active';
    if v_group_key is null then
      raise exception 'selected class or group is unavailable';
    end if;
  end if;

  if p_application_id is null then
    if p_tracking_secret_hash is null or p_tracking_secret_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'valid draft tracking hash is required';
    end if;

    select fv.id into v_form_version_id
    from public.form_versions fv
    join public.form_definitions fd
      on fd.tenant_id = fv.tenant_id and fd.id = fv.form_definition_id
    where fv.tenant_id = p_tenant_id
      and fd.key = 'admission_application'
      and fd.entity_type = 'admission_application'
      and fd.status = 'active'
      and fv.status = 'published'
      and fv.published_at is not null
      and fv.effective_at is not null
    order by fv.version desc
    limit 1;

    select wv.id into v_workflow_version_id
    from public.workflow_versions wv
    join public.workflow_definitions wd
      on wd.tenant_id = wv.tenant_id and wd.id = wv.workflow_definition_id
    where wv.tenant_id = p_tenant_id
      and wd.key = 'admission_default'
      and wd.workflow_type = 'admission'
      and wd.status = 'active'
      and wv.status = 'published'
      and wv.published_at is not null
      and wv.effective_at is not null
      and coalesce((wv.validation_result->>'valid')::boolean, false)
      and wv.validation_result->>'start_key' = 'submitted'
    order by wv.version desc
    limit 1;

    if v_form_version_id is null or v_workflow_version_id is null then
      raise exception 'published admission configuration is required';
    end if;

    insert into public.applications (
      tenant_id, branch_id, session_id, program_id, form_version_id, workflow_version_id,
      tracking_secret_hash, applicant_data, state, revision, preferred_locale, consent
    ) values (
      p_tenant_id,
      p_branch_id,
      p_session_id,
      p_program_id,
      v_form_version_id,
      v_workflow_version_id,
      p_tracking_secret_hash,
      p_applicant_data || case when v_group_key is null
        then '{}'::jsonb
        else jsonb_build_object('group_key', v_group_key)
      end,
      'draft',
      1,
      p_preferred_locale,
      jsonb_build_object('staff_draft', true, 'saved_at', now())
    )
    returning * into v_application;

    insert into public.application_versions (
      tenant_id, application_id, revision, core_answers, custom_answers,
      validation_snapshot, submitted_by_identity_id
    ) values (
      p_tenant_id,
      v_application.id,
      v_application.revision,
      v_application.applicant_data,
      '{}'::jsonb,
      jsonb_build_object('valid', false, 'source', 'staff_admission_draft'),
      p_identity_id
    );
  else
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'staff-admission-draft:' || p_tenant_id::text || ':' || p_application_id::text,
        0
      )
    );

    select a.* into v_application
    from public.applications a
    where a.tenant_id = p_tenant_id
      and a.id = p_application_id
      and a.branch_id = p_branch_id
    for update;

    if v_application.id is null then
      raise exception 'admission draft not found';
    end if;
    if v_application.state <> 'draft' then
      raise exception 'only draft applications can be edited';
    end if;

    v_revision := v_application.revision + 1;

    update public.applications
    set session_id = p_session_id,
        program_id = p_program_id,
        applicant_data = p_applicant_data || case when v_group_key is null
          then '{}'::jsonb
          else jsonb_build_object('group_key', v_group_key)
        end,
        preferred_locale = p_preferred_locale,
        consent = coalesce(consent, '{}'::jsonb)
          || jsonb_build_object('staff_draft', true, 'saved_at', now()),
        revision = v_revision,
        updated_at = now()
    where tenant_id = p_tenant_id and id = p_application_id
    returning * into v_application;

    insert into public.application_versions (
      tenant_id, application_id, revision, core_answers, custom_answers,
      validation_snapshot, submitted_by_identity_id
    ) values (
      p_tenant_id,
      v_application.id,
      v_application.revision,
      v_application.applicant_data,
      '{}'::jsonb,
      jsonb_build_object('valid', false, 'source', 'staff_admission_draft'),
      p_identity_id
    );
  end if;

  if p_photo_token_digest is not null then
    if p_photo_token_digest !~ '^[0-9a-f]{64}$' then
      raise exception 'student photo token is invalid';
    end if;

    select u.id into v_photo_id
    from public.public_admission_photo_uploads u
    where u.tenant_id = p_tenant_id
      and u.token_digest = p_photo_token_digest
      and (u.application_id is null or u.application_id = v_application.id)
      and u.consumed_at is null
      and u.expires_at > now()
    order by u.created_at desc
    limit 1
    for update;

    if v_photo_id is null then
      raise exception 'student photo token is invalid or expired';
    end if;

    update public.public_admission_photo_uploads
    set application_id = v_application.id
    where id = v_photo_id;
  end if;

  insert into public.audit_events (
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id, after_state, metadata
  ) values (
    p_tenant_id,
    p_branch_id,
    p_identity_id,
    v_actor,
    'admissions.application.draft_saved',
    'succeeded',
    'application',
    v_application.id::text,
    gen_random_uuid(),
    jsonb_build_object('state','draft','revision',v_application.revision),
    jsonb_build_object(
      'session_id',p_session_id,
      'program_id',p_program_id,
      'group_id',p_group_id,
      'photo_bound',v_photo_id is not null
    )
  );

  return jsonb_build_object(
    'application_id', v_application.id,
    'tracking_id', v_application.tracking_id,
    'state', v_application.state,
    'revision', v_application.revision,
    'photo_bound', v_photo_id is not null
  );
end;
$$;

revoke all on function public.save_staff_admission_draft_v1(
  uuid,bigint,bigint,bigint,bigint,bigint,bigint,text,jsonb,text,text
) from public,anon,authenticated;
grant execute on function public.save_staff_admission_draft_v1(
  uuid,bigint,bigint,bigint,bigint,bigint,bigint,text,jsonb,text,text
) to service_role;

create or replace function public.discard_staff_admission_draft_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_application_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor bigint;
  v_application public.applications%rowtype;
begin
  v_actor := private.resolve_staff_membership(
    p_identity_id,
    p_tenant_id,
    p_branch_id,
    array['admissions.application.review']
  );
  if v_actor is null then
    raise exception 'admission draft permission denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'staff-admission-draft:' || p_tenant_id::text || ':' || p_application_id::text,
      0
    )
  );

  select a.* into v_application
  from public.applications a
  where a.tenant_id = p_tenant_id
    and a.id = p_application_id
    and a.branch_id = p_branch_id
  for update;

  if v_application.id is null then
    raise exception 'admission draft not found';
  end if;
  if v_application.state <> 'draft' then
    raise exception 'only draft applications can be discarded';
  end if;

  update public.applications
  set state = 'withdrawn',
      revision = v_application.revision + 1,
      updated_at = now()
  where tenant_id = p_tenant_id and id = p_application_id;

  insert into public.audit_events (
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id,
    before_state, after_state
  ) values (
    p_tenant_id,
    p_branch_id,
    p_identity_id,
    v_actor,
    'admissions.application.draft_discarded',
    'succeeded',
    'application',
    p_application_id::text,
    gen_random_uuid(),
    jsonb_build_object('state','draft','revision',v_application.revision),
    jsonb_build_object('state','withdrawn','revision',v_application.revision + 1)
  );

  return jsonb_build_object(
    'application_id', p_application_id,
    'state', 'withdrawn',
    'revision', v_application.revision + 1
  );
end;
$$;

revoke all on function public.discard_staff_admission_draft_v1(uuid,bigint,bigint,bigint)
  from public,anon,authenticated;
grant execute on function public.discard_staff_admission_draft_v1(uuid,bigint,bigint,bigint)
  to service_role;

create or replace function public.finalize_staff_admission_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_application_id bigint,
  p_session_id bigint,
  p_program_id bigint,
  p_group_id bigint,
  p_preferred_locale text,
  p_applicant_data jsonb,
  p_photo_token_digest text default null,
  p_confirm_new_person boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_saved jsonb;
  v_result jsonb;
  v_applicant_name text;
  v_native_name text;
  v_guardian_name text;
  v_guardian_email text;
  v_relationship text;
  v_gender text;
  v_joining_date date;
  v_dob date;
  v_candidate_count integer := 0;
  v_client_profile text;
  v_photo_exists boolean := false;
  v_workflow_instance_id bigint;
  v_revision integer;
begin
  if p_application_id is null then
    raise exception 'saved admission draft required before final submission';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'staff-admission-finalize:' || p_tenant_id::text || ':' || p_application_id::text,
      0
    )
  );

  select a.* into v_application
  from public.applications a
  where a.tenant_id = p_tenant_id
    and a.id = p_application_id
    and a.branch_id = p_branch_id
  for update;

  if v_application.id is null then
    raise exception 'admission draft not found';
  end if;

  if v_application.state = 'enrolled' then
    return public.convert_admission_to_student(
      p_identity_id,
      p_tenant_id,
      p_application_id,
      true
    );
  end if;

  if v_application.state <> 'draft' then
    raise exception 'admission draft state changed';
  end if;

  v_saved := public.save_staff_admission_draft_v1(
    p_identity_id,
    p_tenant_id,
    p_branch_id,
    p_application_id,
    p_session_id,
    p_program_id,
    p_group_id,
    p_preferred_locale,
    p_applicant_data,
    null,
    p_photo_token_digest
  );

  select a.* into v_application
  from public.applications a
  where a.tenant_id = p_tenant_id and a.id = p_application_id
  for update;

  v_applicant_name := btrim(coalesce(v_application.applicant_data->>'applicant_name',''));
  v_native_name := btrim(coalesce(v_application.applicant_data->>'native_name',''));
  v_guardian_name := btrim(coalesce(v_application.applicant_data->>'guardian_name',''));
  v_guardian_email := lower(btrim(coalesce(v_application.applicant_data->>'guardian_email','')));
  v_relationship := lower(btrim(coalesce(v_application.applicant_data->>'guardian_relationship','')));
  v_gender := lower(btrim(coalesce(v_application.applicant_data->>'gender','')));

  if length(v_applicant_name) not between 2 and 160 then
    raise exception 'valid student name required';
  end if;
  if length(v_native_name) not between 2 and 160 then
    raise exception 'valid native student name required';
  end if;
  if v_gender not in ('male','female','other','undisclosed') then
    raise exception 'valid student gender required';
  end if;
  if length(v_guardian_name) not between 2 and 160 then
    raise exception 'valid guardian name required';
  end if;
  if v_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'valid guardian email required';
  end if;
  if v_relationship not in ('father','mother','guardian','other') then
    raise exception 'valid guardian relationship required';
  end if;
  if coalesce(v_application.applicant_data->>'group_key','') = '' then
    raise exception 'class or group selection required';
  end if;

  begin
    v_joining_date := (v_application.applicant_data->>'joining_date')::date;
  exception when others then
    raise exception 'valid joining date required';
  end;

  if v_joining_date is null then
    raise exception 'valid joining date required';
  end if;

  begin
    v_dob := nullif(v_application.applicant_data->>'date_of_birth','')::date;
  exception when others then
    raise exception 'valid date of birth required';
  end;

  select t.client_profile into v_client_profile
  from public.tenants t
  where t.id = p_tenant_id;

  select exists (
    select 1
    from public.public_admission_photo_uploads u
    where u.tenant_id = p_tenant_id
      and u.application_id = p_application_id
      and u.consumed_at is null
      and u.expires_at > now()
  ) into v_photo_exists;

  if v_client_profile = 'client-v2' and not v_photo_exists then
    raise exception 'student photo required before admission';
  end if;

  select count(*)::integer into v_candidate_count
  from public.persons p
  where p.tenant_id = p_tenant_id
    and p.status not in ('merged','archived')
    and lower(regexp_replace(btrim(p.display_name),'\s+',' ','g'))
      = lower(regexp_replace(v_applicant_name,'\s+',' ','g'))
    and (v_dob is null or p.date_of_birth is not distinct from v_dob);

  if v_candidate_count > 0 and not coalesce(p_confirm_new_person,false) then
    update public.applications
    set duplicate_review_status = 'possible',
        updated_at = now()
    where tenant_id = p_tenant_id and id = p_application_id;

    return jsonb_build_object(
      'converted', false,
      'duplicate_review_required', true,
      'candidate_count', v_candidate_count,
      'application_id', p_application_id,
      'state', 'draft',
      'revision', v_application.revision
    );
  end if;

  v_revision := v_application.revision + 1;
  update public.applications
  set state = 'submitted',
      revision = v_revision,
      submitted_at = now(),
      duplicate_review_status = case
        when v_candidate_count > 0 then 'resolved'
        else 'clear'
      end,
      consent = coalesce(consent,'{}'::jsonb)
        || jsonb_build_object('staff_confirmed',true,'submitted_at',now()),
      updated_at = now()
  where tenant_id = p_tenant_id and id = p_application_id;

  insert into public.application_versions (
    tenant_id, application_id, revision, core_answers, custom_answers,
    validation_snapshot, submitted_by_identity_id
  ) values (
    p_tenant_id,
    p_application_id,
    v_revision,
    v_application.applicant_data,
    '{}'::jsonb,
    jsonb_build_object('valid',true,'source','staff_admission_final'),
    p_identity_id
  );

  insert into public.workflow_instances (
    tenant_id, branch_id, workflow_version_id, subject_type, subject_key,
    current_node_key, status, context
  ) values (
    p_tenant_id,
    p_branch_id,
    v_application.workflow_version_id,
    'admission_application',
    v_application.tracking_id::text,
    'submitted',
    'active',
    jsonb_build_object(
      'application_id',p_application_id,
      'tracking_id',v_application.tracking_id,
      'source','staff_direct_admission'
    )
  )
  returning id into v_workflow_instance_id;

  insert into public.audit_events (
    tenant_id, branch_id, actor_identity_id,
    action, outcome, entity_type, entity_id, correlation_id,
    before_state, after_state, metadata
  ) values (
    p_tenant_id,
    p_branch_id,
    p_identity_id,
    'admissions.application.submitted_staff',
    'succeeded',
    'application',
    p_application_id::text,
    gen_random_uuid(),
    jsonb_build_object('state','draft','revision',v_application.revision),
    jsonb_build_object('state','submitted','revision',v_revision),
    jsonb_build_object('workflow_instance_id',v_workflow_instance_id)
  );

  perform public.progress_admission_staff(
    p_identity_id,p_tenant_id,p_application_id,'start_review',null
  );
  perform public.progress_admission_staff(
    p_identity_id,p_tenant_id,p_application_id,'complete_review','Staff direct admission review'
  );
  perform public.progress_admission_staff(
    p_identity_id,p_tenant_id,p_application_id,'offer','Staff direct admission approved'
  );

  v_result := public.convert_admission_to_student_v3(
    p_identity_id,
    p_tenant_id,
    p_application_id,
    true
  );

  return v_result || jsonb_build_object(
    'draft_finalized', true,
    'duplicate_review_required', false
  );
end;
$$;

revoke all on function public.finalize_staff_admission_v1(
  uuid,bigint,bigint,bigint,bigint,bigint,bigint,text,jsonb,text,boolean
) from public,anon,authenticated;
grant execute on function public.finalize_staff_admission_v1(
  uuid,bigint,bigint,bigint,bigint,bigint,bigint,text,jsonb,text,boolean
) to service_role;

commit;
