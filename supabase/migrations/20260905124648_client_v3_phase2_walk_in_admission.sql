create or replace function public.create_walk_in_admission_v3(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_display_name text,
  p_name_native text default null,
  p_date_of_birth date default null,
  p_age_years integer default null,
  p_gender text default null,
  p_preferred_locale text default 'en',
  p_session_id bigint default null,
  p_program_id bigint default null,
  p_group_id bigint default null,
  p_joined_on date default current_date,
  p_medical_summary text default null,
  p_accessibility_needs text default null,
  p_pickup_restrictions text default null,
  p_guardian jsonb default null,
  p_confirm_new_person boolean default false
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_guardian_name text := btrim(coalesce(p_guardian->>'name',''));
  v_guardian_phone text := btrim(coalesce(p_guardian->>'phone',''));
  v_result jsonb;
  v_person_id bigint;
  v_membership_id bigint;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_group_id is null then
    raise exception 'class or group is required';
  end if;

  if p_date_of_birth is null and (p_age_years is null or p_age_years < 1 or p_age_years > 120) then
    raise exception 'date of birth or age is required';
  end if;

  if p_guardian is null or length(v_guardian_name) < 2 then
    raise exception 'guardian name is required';
  end if;

  if length(v_guardian_phone) < 6 or length(v_guardian_phone) > 80 then
    raise exception 'guardian phone is required';
  end if;

  v_result := public.create_student_direct(
    p_identity_id => p_identity_id,
    p_tenant_id => p_tenant_id,
    p_branch_id => p_branch_id,
    p_display_name => p_display_name,
    p_name_native => p_name_native,
    p_date_of_birth => p_date_of_birth,
    p_gender => p_gender,
    p_preferred_locale => p_preferred_locale,
    p_session_id => p_session_id,
    p_program_id => p_program_id,
    p_group_id => p_group_id,
    p_joined_on => p_joined_on,
    p_medical_summary => p_medical_summary,
    p_accessibility_needs => p_accessibility_needs,
    p_pickup_restrictions => p_pickup_restrictions,
    p_guardian => p_guardian,
    p_confirm_new_person => p_confirm_new_person
  );

  if coalesce((v_result->>'duplicate_review_required')::boolean, false) then
    return v_result;
  end if;

  v_person_id := nullif(v_result->>'person_id','')::bigint;
  if v_person_id is null then
    raise exception 'created student linkage missing';
  end if;

  if p_date_of_birth is null and p_age_years is not null then
    update public.persons
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'reported_age_years', p_age_years,
        'reported_age_on', current_date,
        'reported_age_source', 'walk_in_admission'
      ),
      updated_at = now()
    where tenant_id = p_tenant_id and id = v_person_id;

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
            and mbs.branch_id = p_branch_id
        )
      )
    order by m.created_at asc
    limit 1;

    insert into public.audit_events(
      tenant_id, branch_id, actor_identity_id, actor_membership_id,
      action, outcome, entity_type, entity_id, correlation_id,
      after_state, metadata
    ) values (
      p_tenant_id, p_branch_id, p_identity_id, v_membership_id,
      'students.reported_age.record', 'succeeded', 'student', v_person_id::text, v_correlation_id,
      jsonb_build_object('reported_age_years', p_age_years, 'reported_age_on', current_date),
      jsonb_build_object('source', 'walk_in_admission')
    );
  end if;

  return v_result || jsonb_build_object('reported_age_years', p_age_years);
end;
$function$;

revoke all on function public.create_walk_in_admission_v3(uuid,bigint,bigint,text,text,date,integer,text,text,bigint,bigint,bigint,date,text,text,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.create_walk_in_admission_v3(uuid,bigint,bigint,text,text,date,integer,text,text,bigint,bigint,bigint,date,text,text,text,jsonb,boolean) to service_role;