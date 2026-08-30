create or replace function public.update_student_core(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_person_id bigint,
  p_display_name text,
  p_name_native text default null,
  p_date_of_birth date default null,
  p_gender text default null,
  p_preferred_locale text default 'en',
  p_medical_summary text default null,
  p_accessibility_needs text default null,
  p_pickup_restrictions text default null
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_name text := btrim(coalesce(p_display_name, ''));
  v_before jsonb;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_person_id is null then
    raise exception 'identity, tenant, branch, and student are required';
  end if;
  if length(v_name) not between 2 and 160 then raise exception 'student name must be between 2 and 160 characters'; end if;
  if p_preferred_locale not in ('en','ur','ar') then raise exception 'preferred language is invalid'; end if;
  if p_gender is not null and p_gender not in ('male','female','other','undisclosed') then raise exception 'gender is invalid'; end if;
  if p_date_of_birth is not null and p_date_of_birth > current_date then raise exception 'date of birth cannot be in the future'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at <= now()) and (m.ends_at is null or m.ends_at > now())
    and (m.all_branches or exists (select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id))
    and exists (
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id
        and rp.permission_code in ('people.person.manage','students.profile.update')
      group by mr.membership_id having count(distinct rp.permission_code)=2
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'student update permission denied'; end if;

  if not exists (
    select 1 from public.student_profiles sp
    join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
    where sp.tenant_id=p_tenant_id and sp.person_id=p_person_id
      and exists (select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.student_person_id=p_person_id and e.branch_id=p_branch_id)
  ) then raise exception 'student is not available in the active branch'; end if;

  select jsonb_build_object(
    'display_name',p.display_name,'name_native',p.name_native,'date_of_birth',p.date_of_birth,'gender',p.gender,'preferred_locale',p.preferred_locale,
    'medical_summary',sp.medical_summary,'accessibility_needs',sp.accessibility_needs,'pickup_restrictions',sp.pickup_restrictions
  ) into v_before
  from public.persons p join public.student_profiles sp on sp.tenant_id=p.tenant_id and sp.person_id=p.id
  where p.tenant_id=p_tenant_id and p.id=p_person_id;

  update public.persons set display_name=v_name, name_native=nullif(btrim(coalesce(p_name_native,'')),''), date_of_birth=p_date_of_birth, gender=p_gender, preferred_locale=p_preferred_locale, updated_at=now()
  where tenant_id=p_tenant_id and id=p_person_id;

  update public.student_profiles set medical_summary=nullif(btrim(coalesce(p_medical_summary,'')),''), accessibility_needs=nullif(btrim(coalesce(p_accessibility_needs,'')),''), pickup_restrictions=nullif(btrim(coalesce(p_pickup_restrictions,'')),''), updated_at=now()
  where tenant_id=p_tenant_id and person_id=p_person_id;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'students.profile.update','succeeded','student',p_person_id::text,v_correlation_id,v_before,
    jsonb_build_object('display_name',v_name,'name_native',nullif(btrim(coalesce(p_name_native,'')),''),'date_of_birth',p_date_of_birth,'gender',p_gender,'preferred_locale',p_preferred_locale,'medical_summary',nullif(btrim(coalesce(p_medical_summary,'')),''),'accessibility_needs',nullif(btrim(coalesce(p_accessibility_needs,'')),''),'pickup_restrictions',nullif(btrim(coalesce(p_pickup_restrictions,'')),'')));

  return jsonb_build_object('updated',true,'person_id',p_person_id);
end;
$function$;

revoke all on function public.update_student_core(uuid,bigint,bigint,bigint,text,text,date,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.update_student_core(uuid,bigint,bigint,bigint,text,text,date,text,text,text,text,text) to service_role;
