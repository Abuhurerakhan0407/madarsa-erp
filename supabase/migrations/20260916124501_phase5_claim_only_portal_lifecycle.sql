begin;

create or replace function public.convert_admission_to_student_v3(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_application_id bigint,
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
  v_correlation_id uuid := gen_random_uuid();
begin
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

  v_guardian_person_id := v_email_guardian_person_id;

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
    v_guardian_person_id, p_tenant_id, 'email', 'not_invited'
  )
  on conflict (person_id) do update
    set preferred_contact_type = 'email',
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
      p_tenant_id, v_guardian_person_id, 'email', 'Portal contact', v_guardian_email, v_guardian_email,
      true, false, jsonb_build_object('source','admission_application'), 'portal'
    );
  else
    update public.person_contacts
    set is_primary = true,
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
    'admissions.guardian.prepared',
    'succeeded',
    'application',
    p_application_id::text,
    v_correlation_id,
    jsonb_build_object(
      'student_person_id',v_person_id,
      'guardian_person_id',v_guardian_person_id,
      'group_id',v_group_id,
      'photo_attached',v_photo.id is not null,
      'portal_claim_required',true
    ),
    jsonb_build_object('guardian_email',v_guardian_email,'relationship',v_relationship)
  );

  return v_result || jsonb_build_object(
    'guardian_person_id', v_guardian_person_id,
    'guardian_email', v_guardian_email,
    'guardian_linked', false,
    'portal_claim_required', true,
    'group_id', v_group_id,
    'photo_attached', v_photo.id is not null
  );
end;
$$;

revoke all on function public.convert_admission_to_student_v3(uuid,bigint,bigint,boolean) from public, anon, authenticated;
grant execute on function public.convert_admission_to_student_v3(uuid,bigint,bigint,boolean) to service_role;

commit;
