begin;

create or replace function public.submit_public_admission_v2(
  p_tenant_slug text,
  p_session_key text,
  p_program_key text,
  p_preferred_locale text,
  p_answers jsonb,
  p_consent boolean,
  p_tracking_secret_hash text,
  p_source_hash text,
  p_photo_token_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_tenant_id bigint;
  v_application_id bigint;
  v_photo_id bigint;
begin
  if p_photo_token_digest is null or p_photo_token_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'valid student photo required';
  end if;

  select t.id into v_tenant_id
  from public.tenants t
  where t.slug = p_tenant_slug
    and t.state in ('onboarding','trial','active','grace')
  limit 1;

  if v_tenant_id is null then
    raise exception 'admissions unavailable';
  end if;

  select u.id into v_photo_id
  from public.public_admission_photo_uploads u
  where u.tenant_id = v_tenant_id
    and u.token_digest = p_photo_token_digest
    and u.application_id is null
    and u.consumed_at is null
    and u.expires_at > now()
  for update;

  if v_photo_id is null then
    raise exception 'valid student photo required';
  end if;

  v_result := public.submit_public_admission(
    p_tenant_slug,
    p_session_key,
    p_program_key,
    p_preferred_locale,
    p_answers,
    p_consent,
    p_tracking_secret_hash,
    p_source_hash
  );

  if coalesce((v_result->>'rate_limited')::boolean, false) then
    return v_result;
  end if;

  v_application_id := nullif(v_result->>'application_id','')::bigint;
  if v_application_id is null then
    raise exception 'application submission did not complete';
  end if;

  update public.public_admission_photo_uploads
  set application_id = v_application_id
  where id = v_photo_id;

  return v_result || jsonb_build_object('photo_bound', true);
end;
$$;

revoke all on function public.submit_public_admission_v2(text,text,text,text,jsonb,boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_public_admission_v2(text,text,text,text,jsonb,boolean,text,text,text) to service_role;

create or replace function public.convert_admission_to_student_v2(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_application_id bigint,
  p_guardian_identity_id uuid,
  p_confirm_new_person boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_person_id bigint;
  v_guardian_person_id bigint;
  v_linked_guardian_person_id bigint;
  v_email_guardian_person_id bigint;
  v_email_match_count integer := 0;
  v_membership_id bigint;
  v_application public.applications%rowtype;
  v_client_profile text;
  v_guardian_name text;
  v_guardian_email text;
  v_guardian_phone text;
  v_relationship text;
  v_native_name text;
  v_gender text;
  v_group_key text;
  v_group_id bigint;
  v_joining_date date;
  v_photo public.public_admission_photo_uploads%rowtype;
  v_auth_email text;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_guardian_identity_id is null then
    raise exception 'guardian portal identity required';
  end if;

  v_result := public.convert_admission_to_student(
    p_identity_id,
    p_tenant_id,
    p_application_id,
    p_confirm_new_person
  );

  if coalesce((v_result->>'duplicate_review_required')::boolean, false) then
    return v_result;
  end if;

  v_person_id := nullif(v_result->>'person_id','')::bigint;
  if v_person_id is null then
    raise exception 'converted student linkage missing';
  end if;

  select a.* into v_application
  from public.applications a
  where a.tenant_id = p_tenant_id and a.id = p_application_id
  for update;

  if v_application.id is null then
    raise exception 'admission application not found';
  end if;

  select t.client_profile into v_client_profile
  from public.tenants t
  where t.id = p_tenant_id;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.identity_id = p_identity_id
    and m.status = 'active'
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'active operator membership required';
  end if;

  v_guardian_name := btrim(coalesce(v_application.applicant_data->>'guardian_name',''));
  v_guardian_email := lower(btrim(coalesce(v_application.applicant_data->>'guardian_email','')));
  v_guardian_phone := btrim(coalesce(v_application.applicant_data->>'guardian_phone',''));
  v_relationship := lower(btrim(coalesce(v_application.applicant_data->>'guardian_relationship','guardian')));
  v_native_name := btrim(coalesce(v_application.applicant_data->>'native_name',''));
  v_gender := lower(btrim(coalesce(v_application.applicant_data->>'gender','')));
  v_group_key := btrim(coalesce(v_application.applicant_data->>'group_key',''));

  if length(v_guardian_name) not between 2 and 160 then
    raise exception 'valid guardian name required';
  end if;
  if v_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'valid guardian email required';
  end if;
  if v_relationship not in ('father','mother','guardian','other') then
    raise exception 'valid guardian relationship required';
  end if;
  if v_gender not in ('male','female','other','undisclosed') then
    raise exception 'valid student gender required';
  end if;
  if length(v_native_name) < 2 or length(v_native_name) > 160 then
    raise exception 'valid native student name required';
  end if;

  begin
    v_joining_date := (v_application.applicant_data->>'joining_date')::date;
  exception when others then
    raise exception 'valid joining date required';
  end;

  select lower(u.email) into v_auth_email
  from auth.users u
  where u.id = p_guardian_identity_id;

  if v_auth_email is null or v_auth_email <> v_guardian_email then
    raise exception 'guardian identity email mismatch';
  end if;

  select min(l.person_id)
    into v_linked_guardian_person_id
  from public.identity_person_links l
  where l.tenant_id = p_tenant_id
    and l.identity_id = p_guardian_identity_id
    and l.link_type = 'guardian'
    and l.status <> 'revoked';

  select count(distinct pc.person_id), min(pc.person_id)
    into v_email_match_count, v_email_guardian_person_id
  from public.person_contacts pc
  join public.guardian_profiles gp
    on gp.tenant_id = pc.tenant_id and gp.person_id = pc.person_id
  where pc.tenant_id = p_tenant_id
    and pc.type = 'email'
    and lower(coalesce(pc.normalized_value, pc.value)) = v_guardian_email;

  if v_email_match_count > 1 then
    raise exception 'guardian email matches multiple records';
  end if;

  if v_linked_guardian_person_id is not null
     and v_email_guardian_person_id is not null
     and v_linked_guardian_person_id <> v_email_guardian_person_id then
    raise exception 'guardian identity is linked to a different guardian record';
  end if;

  v_guardian_person_id := coalesce(v_linked_guardian_person_id, v_email_guardian_person_id);

  if v_guardian_person_id is null then
    insert into public.persons (
      tenant_id, display_name, preferred_locale, status, metadata
    ) values (
      p_tenant_id,
      v_guardian_name,
      v_application.preferred_locale,
      'active',
      jsonb_build_object('source','admission_conversion_guardian','application_id',p_application_id)
    ) returning id into v_guardian_person_id;
  else
    update public.persons
    set display_name = case when length(display_name) < 2 then v_guardian_name else display_name end,
        updated_at = now()
    where tenant_id = p_tenant_id and id = v_guardian_person_id;
  end if;

  insert into public.guardian_profiles (
    person_id, tenant_id, preferred_contact_type, portal_invitation_status
  ) values (
    v_guardian_person_id, p_tenant_id, 'email', 'active'
  )
  on conflict (person_id) do update
    set preferred_contact_type = 'email',
        portal_invitation_status = 'active',
        updated_at = now();

  if not exists (
    select 1 from public.person_contacts pc
    where pc.tenant_id = p_tenant_id
      and pc.person_id = v_guardian_person_id
      and pc.type = 'email'
      and lower(coalesce(pc.normalized_value,pc.value)) = v_guardian_email
  ) then
    insert into public.person_contacts (
      tenant_id, person_id, type, label, value, normalized_value,
      is_primary, is_verified, consent, visibility
    ) values (
      p_tenant_id, v_guardian_person_id, 'email', 'Portal login', v_guardian_email, v_guardian_email,
      true, true, jsonb_build_object('source','admission_application'), 'portal'
    );
  else
    update public.person_contacts
    set is_primary = true,
        is_verified = true,
        visibility = 'portal',
        updated_at = now()
    where tenant_id = p_tenant_id
      and person_id = v_guardian_person_id
      and type = 'email'
      and lower(coalesce(normalized_value,value)) = v_guardian_email;
  end if;

  if length(v_guardian_phone) >= 6 then
    if not exists (
      select 1 from public.person_contacts pc
      where pc.tenant_id = p_tenant_id
        and pc.person_id = v_guardian_person_id
        and pc.type = 'phone'
        and coalesce(pc.normalized_value,pc.value) = regexp_replace(v_guardian_phone,'[^0-9+]','','g')
    ) then
      insert into public.person_contacts (
        tenant_id, person_id, type, label, value, normalized_value,
        is_primary, is_verified, consent, visibility
      ) values (
        p_tenant_id, v_guardian_person_id, 'phone', 'Guardian phone', v_guardian_phone,
        regexp_replace(v_guardian_phone,'[^0-9+]','','g'), false, false,
        jsonb_build_object('source','admission_application'), 'staff'
      );
    end if;
  end if;

  insert into public.person_relationships (
    tenant_id, source_person_id, target_person_id, relationship_type,
    status, is_primary, can_collect_student, portal_visibility,
    restriction_flags, verified_at, verified_by_membership_id
  ) values (
    p_tenant_id, v_guardian_person_id, v_person_id, v_relationship,
    'verified', true, true, 'standard', '{}'::jsonb, now(), v_membership_id
  )
  on conflict (tenant_id, source_person_id, target_person_id, relationship_type)
  do update set
    status = 'verified',
    is_primary = true,
    can_collect_student = true,
    portal_visibility = 'standard',
    verified_at = now(),
    verified_by_membership_id = v_membership_id,
    updated_at = now();

  insert into public.identity_person_links (
    tenant_id, identity_id, person_id, link_type, status,
    verified_at, verified_by_membership_id
  ) values (
    p_tenant_id, p_guardian_identity_id, v_guardian_person_id, 'guardian', 'verified',
    now(), v_membership_id
  )
  on conflict (tenant_id, identity_id, person_id, link_type)
  do update set
    status = 'verified',
    verified_at = now(),
    verified_by_membership_id = v_membership_id,
    updated_at = now();

  if v_group_key = '' then
    raise exception 'class or group selection required';
  end if;

  select g.id into v_group_id
  from public.academic_groups g
  where g.tenant_id = p_tenant_id
    and g.branch_id = v_application.branch_id
    and g.session_id = v_application.session_id
    and g.program_id = v_application.program_id
    and g.key = v_group_key
    and g.status = 'active'
  limit 1;

  if v_group_id is null then
    raise exception 'selected class or group is unavailable';
  end if;

  select u.* into v_photo
  from public.public_admission_photo_uploads u
  where u.tenant_id = p_tenant_id
    and u.application_id = p_application_id
    and u.consumed_at is null
    and u.expires_at > now()
  order by u.created_at desc
  limit 1
  for update;

  if v_client_profile = 'client-v2' and v_photo.id is null then
    raise exception 'student photo required before conversion';
  end if;

  update public.persons
  set name_native = v_native_name,
      gender = v_gender,
      photo_storage_path = coalesce(v_photo.storage_path, photo_storage_path),
      updated_at = now()
  where tenant_id = p_tenant_id and id = v_person_id;

  update public.student_profiles
  set joined_on = v_joining_date,
      medical_summary = nullif(btrim(coalesce(v_application.applicant_data->>'medical_summary','')),''),
      accessibility_needs = nullif(btrim(coalesce(v_application.applicant_data->>'accessibility_needs','')),''),
      pickup_restrictions = nullif(btrim(coalesce(v_application.applicant_data->>'pickup_restrictions','')),''),
      updated_at = now()
  where tenant_id = p_tenant_id and person_id = v_person_id;

  update public.enrollments
  set group_id = v_group_id,
      starts_on = v_joining_date,
      updated_at = now()
  where tenant_id = p_tenant_id
    and id = nullif(v_result->>'enrollment_id','')::bigint
    and student_person_id = v_person_id;

  if v_photo.id is not null then
    update public.public_admission_photo_uploads
    set consumed_at = now()
    where id = v_photo.id;
  end if;

  insert into public.audit_events (
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id, after_state, metadata
  ) values (
    p_tenant_id,
    v_application.branch_id,
    p_identity_id,
    v_membership_id,
    'admissions.identity.provisioned',
    'succeeded',
    'application',
    p_application_id::text,
    v_correlation_id,
    jsonb_build_object(
      'student_person_id',v_person_id,
      'guardian_person_id',v_guardian_person_id,
      'group_id',v_group_id,
      'photo_attached',v_photo.id is not null,
      'guardian_identity_linked',true
    ),
    jsonb_build_object('guardian_email',v_guardian_email,'relationship',v_relationship)
  );

  return v_result || jsonb_build_object(
    'guardian_person_id', v_guardian_person_id,
    'guardian_identity_id', p_guardian_identity_id,
    'guardian_email', v_guardian_email,
    'guardian_linked', true,
    'group_id', v_group_id,
    'photo_attached', v_photo.id is not null
  );
end;
$$;

revoke all on function public.convert_admission_to_student_v2(uuid,bigint,bigint,uuid,boolean) from public, anon, authenticated;
grant execute on function public.convert_admission_to_student_v2(uuid,bigint,bigint,uuid,boolean) to service_role;

commit;
