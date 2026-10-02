create or replace function public.complete_online_admission_details_v3(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_application_id bigint,
  p_native_name text,
  p_gender text,
  p_guardian_name text,
  p_guardian_relationship text,
  p_guardian_phone text,
  p_guardian_email text,
  p_group_key text,
  p_joining_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_application public.applications%rowtype;
  v_membership_id bigint;
  v_group_id bigint;
  v_session_start date;
  v_session_end date;
  v_native_name text := btrim(coalesce(p_native_name,''));
  v_gender text := lower(btrim(coalesce(p_gender,'')));
  v_guardian_name text := btrim(coalesce(p_guardian_name,''));
  v_relationship text := lower(btrim(coalesce(p_guardian_relationship,'')));
  v_phone text := btrim(coalesce(p_guardian_phone,''));
  v_email text := lower(btrim(coalesce(p_guardian_email,'')));
  v_group_key text := btrim(coalesce(p_group_key,''));
  v_correlation_id uuid := gen_random_uuid();
  v_before jsonb;
begin
  if p_identity_id is null or p_tenant_id is null or p_application_id is null then
    raise exception 'identity, tenant, and application are required';
  end if;
  if length(v_native_name) not between 2 and 160 then raise exception 'valid native student name required'; end if;
  if v_gender not in ('male','female','other','undisclosed') then raise exception 'valid student gender required'; end if;
  if length(v_guardian_name) not between 2 and 160 then raise exception 'valid guardian name required'; end if;
  if v_relationship not in ('father','mother','guardian','other') then raise exception 'valid guardian relationship required'; end if;
  if length(v_phone) < 6 or length(v_phone) > 80 then raise exception 'valid guardian phone required'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'valid guardian email required'; end if;
  if v_group_key = '' then raise exception 'class or group selection required'; end if;
  if p_joining_date is null then raise exception 'joining date required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admission-complete:' || p_tenant_id::text || ':' || p_application_id::text, 0));

  select a.* into v_application
  from public.applications a
  where a.tenant_id=p_tenant_id and a.id=p_application_id
  for update;
  if v_application.id is null then raise exception 'admission application not found'; end if;
  if v_application.state not in ('submitted','verification','decision','offered','payment_pending') then
    raise exception 'application can no longer be edited for admission';
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id
    and m.identity_id=p_identity_id
    and m.status='active'
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes mbs
      where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=v_application.branch_id
    ))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='admissions.application.review'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'admission review permission denied'; end if;

  select s.starts_on,s.ends_on into v_session_start,v_session_end
  from public.academic_sessions s
  where s.tenant_id=p_tenant_id and s.id=v_application.session_id and s.status='active';
  if v_session_start is null then raise exception 'active academic session required'; end if;
  if p_joining_date < v_session_start or p_joining_date > v_session_end then raise exception 'joining date must fall within the academic session'; end if;

  select g.id into v_group_id
  from public.academic_groups g
  where g.tenant_id=p_tenant_id
    and g.branch_id=v_application.branch_id
    and g.session_id=v_application.session_id
    and g.program_id=v_application.program_id
    and g.key=v_group_key
    and g.status='active'
  limit 1;
  if v_group_id is null then raise exception 'selected class or group is unavailable'; end if;

  v_before := jsonb_build_object('revision',v_application.revision,'applicant_data',v_application.applicant_data);

  update public.applications
  set applicant_data = coalesce(applicant_data,'{}'::jsonb) || jsonb_build_object(
      'native_name',v_native_name,
      'gender',v_gender,
      'guardian_name',v_guardian_name,
      'guardian_relationship',v_relationship,
      'guardian_phone',v_phone,
      'guardian_email',v_email,
      'group_key',v_group_key,
      'joining_date',p_joining_date::text
    ),
    revision = revision + 1,
    updated_at = now()
  where tenant_id=p_tenant_id and id=p_application_id;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,
    action,outcome,entity_type,entity_id,correlation_id,before_state,after_state,metadata
  ) values (
    p_tenant_id,v_application.branch_id,p_identity_id,v_membership_id,
    'admissions.application.complete_details','succeeded','application',p_application_id::text,v_correlation_id,
    v_before,
    jsonb_build_object('revision',v_application.revision+1,'group_id',v_group_id,'joining_date',p_joining_date),
    jsonb_build_object('updated_fields',jsonb_build_array('native_name','gender','guardian_name','guardian_relationship','guardian_phone','guardian_email','group_key','joining_date'))
  );

  return jsonb_build_object('application_id',p_application_id,'revision',v_application.revision+1,'group_id',v_group_id,'group_key',v_group_key);
end;
$function$;

revoke all on function public.complete_online_admission_details_v3(uuid,bigint,bigint,text,text,text,text,text,text,text,date) from public, anon, authenticated;
grant execute on function public.complete_online_admission_details_v3(uuid,bigint,bigint,text,text,text,text,text,text,text,date) to service_role;

create or replace function public.register_admission_photo_v3(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_application_id bigint,
  p_token_digest text,
  p_storage_path text,
  p_content_type text,
  p_size_bytes bigint,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_application public.applications%rowtype;
  v_membership_id bigint;
  v_upload_id bigint;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null or p_tenant_id is null or p_application_id is null then raise exception 'identity, tenant, and application are required'; end if;
  if p_token_digest !~ '^[0-9a-f]{64}$' then raise exception 'invalid photo token digest'; end if;
  if p_storage_path !~ '^[0-9]+/admissions/intake/[a-zA-Z0-9._-]+$' then raise exception 'invalid photo storage path'; end if;
  if p_content_type not in ('image/jpeg','image/png','image/webp') then raise exception 'invalid photo content type'; end if;
  if p_size_bytes < 1 or p_size_bytes > 5242880 then raise exception 'invalid photo size'; end if;
  if p_expires_at is null or p_expires_at <= now() then raise exception 'invalid photo expiry'; end if;

  select a.* into v_application from public.applications a where a.tenant_id=p_tenant_id and a.id=p_application_id for update;
  if v_application.id is null then raise exception 'admission application not found'; end if;
  if v_application.state not in ('submitted','verification','decision','offered','payment_pending') then raise exception 'application can no longer accept a student photo'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=v_application.branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='admissions.application.review'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'admission review permission denied'; end if;

  insert into public.public_admission_photo_uploads(
    tenant_id,token_digest,storage_path,content_type,size_bytes,expires_at,application_id
  ) values (
    p_tenant_id,p_token_digest,p_storage_path,p_content_type,p_size_bytes,p_expires_at,p_application_id
  ) returning id into v_upload_id;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state,metadata
  ) values (
    p_tenant_id,v_application.branch_id,p_identity_id,v_membership_id,
    'admissions.application.photo_attached','succeeded','application',p_application_id::text,v_correlation_id,
    jsonb_build_object('photo_upload_id',v_upload_id,'content_type',p_content_type,'size_bytes',p_size_bytes),
    jsonb_build_object('storage_path',p_storage_path)
  );

  return jsonb_build_object('application_id',p_application_id,'photo_upload_id',v_upload_id);
end;
$function$;

revoke all on function public.register_admission_photo_v3(uuid,bigint,bigint,text,text,text,bigint,timestamptz) from public, anon, authenticated;
grant execute on function public.register_admission_photo_v3(uuid,bigint,bigint,text,text,text,bigint,timestamptz) to service_role;