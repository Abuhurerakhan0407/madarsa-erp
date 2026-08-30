create or replace function public.upsert_student_primary_guardian(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint,
  p_name text,
  p_relationship text,
  p_phone text default null,
  p_occupation text default null,
  p_education text default null,
  p_can_collect boolean default true
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_guardian_person_id bigint;
  v_relationship_id bigint;
  v_phone_contact_id bigint;
  v_name text := btrim(coalesce(p_name,''));
  v_phone text := nullif(btrim(coalesce(p_phone,'')),'');
  v_occupation text := nullif(btrim(coalesce(p_occupation,'')),'');
  v_education text := nullif(btrim(coalesce(p_education,'')),'');
  v_correlation_id uuid := gen_random_uuid();
  v_before jsonb;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_student_person_id is null then
    raise exception 'identity, tenant, branch, and student are required';
  end if;
  if length(v_name) not between 2 and 160 then raise exception 'guardian name must be between 2 and 160 characters'; end if;
  if p_relationship not in ('father','mother','guardian') then raise exception 'guardian relationship is invalid'; end if;
  if v_phone is not null and length(v_phone) > 80 then raise exception 'guardian phone is too long'; end if;
  if v_occupation is not null and length(v_occupation) > 160 then raise exception 'guardian occupation is too long'; end if;
  if v_education is not null and length(v_education) > 160 then raise exception 'guardian education is too long'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id
        and rp.permission_code in ('people.person.manage','students.profile.update')
      group by mr.membership_id having count(distinct rp.permission_code)=2
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'guardian management permission denied'; end if;

  if not exists(
    select 1 from public.student_profiles sp
    join public.enrollments e on e.tenant_id=sp.tenant_id and e.student_person_id=sp.person_id
    where sp.tenant_id=p_tenant_id and sp.person_id=p_student_person_id and e.branch_id=p_branch_id and e.status<>'cancelled'
  ) then raise exception 'student is not available in the active branch'; end if;

  select pr.id,pr.source_person_id into v_relationship_id,v_guardian_person_id
  from public.person_relationships pr
  where pr.tenant_id=p_tenant_id and pr.target_person_id=p_student_person_id and pr.is_primary=true and pr.status='verified'
  order by pr.updated_at desc limit 1;

  if v_guardian_person_id is not null then
    select jsonb_build_object(
      'guardian_person_id',v_guardian_person_id,
      'name',p.display_name,
      'relationship',pr.relationship_type,
      'can_collect',pr.can_collect_student,
      'occupation',gp.occupation,
      'education',gp.education
    ) into v_before
    from public.persons p
    join public.person_relationships pr on pr.tenant_id=p.tenant_id and pr.id=v_relationship_id
    left join public.guardian_profiles gp on gp.tenant_id=p.tenant_id and gp.person_id=p.id
    where p.tenant_id=p_tenant_id and p.id=v_guardian_person_id;

    update public.persons set display_name=v_name,updated_at=now() where tenant_id=p_tenant_id and id=v_guardian_person_id;
    insert into public.guardian_profiles(person_id,tenant_id,occupation,education,preferred_contact_type,portal_invitation_status)
    values(v_guardian_person_id,p_tenant_id,v_occupation,v_education,case when v_phone is null then null else 'phone' end,'not_invited')
    on conflict (person_id) do update set occupation=excluded.occupation,education=excluded.education,preferred_contact_type=coalesce(excluded.preferred_contact_type,public.guardian_profiles.preferred_contact_type),updated_at=now();
    update public.person_relationships set relationship_type=p_relationship,can_collect_student=coalesce(p_can_collect,true),updated_at=now()
      where tenant_id=p_tenant_id and id=v_relationship_id;
  else
    insert into public.persons(tenant_id,display_name,preferred_locale,status,metadata)
    values(p_tenant_id,v_name,'en','active',jsonb_build_object('created_via','student_guardian_workspace')) returning id into v_guardian_person_id;
    insert into public.guardian_profiles(person_id,tenant_id,occupation,education,preferred_contact_type,portal_invitation_status)
    values(v_guardian_person_id,p_tenant_id,v_occupation,v_education,case when v_phone is null then null else 'phone' end,'not_invited');
    update public.person_relationships set is_primary=false,updated_at=now()
      where tenant_id=p_tenant_id and target_person_id=p_student_person_id and is_primary=true;
    insert into public.person_relationships(tenant_id,source_person_id,target_person_id,relationship_type,status,is_primary,can_collect_student,portal_visibility,verified_at,verified_by_membership_id)
    values(p_tenant_id,v_guardian_person_id,p_student_person_id,p_relationship,'verified',true,coalesce(p_can_collect,true),'standard',now(),v_membership_id)
    returning id into v_relationship_id;
  end if;

  if v_phone is not null then
    select pc.id into v_phone_contact_id from public.person_contacts pc
    where pc.tenant_id=p_tenant_id and pc.person_id=v_guardian_person_id and pc.type='phone'
    order by pc.is_primary desc,pc.updated_at desc limit 1;
    if v_phone_contact_id is null then
      insert into public.person_contacts(tenant_id,person_id,type,label,value,normalized_value,is_primary,visibility)
      values(p_tenant_id,v_guardian_person_id,'phone','Primary',v_phone,regexp_replace(v_phone,'[^0-9+]','','g'),true,'staff');
    else
      update public.person_contacts set value=v_phone,normalized_value=regexp_replace(v_phone,'[^0-9+]','','g'),is_primary=true,updated_at=now()
      where tenant_id=p_tenant_id and id=v_phone_contact_id;
    end if;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'students.guardian.upsert','succeeded','student',p_student_person_id::text,v_correlation_id,v_before,
    jsonb_build_object('guardian_person_id',v_guardian_person_id,'name',v_name,'relationship',p_relationship,'phone_recorded',v_phone is not null,'occupation',v_occupation,'education',v_education,'can_collect',coalesce(p_can_collect,true)));

  return jsonb_build_object('updated',true,'guardian_person_id',v_guardian_person_id,'relationship_id',v_relationship_id);
end;
$function$;

revoke all on function public.upsert_student_primary_guardian(uuid,bigint,bigint,bigint,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.upsert_student_primary_guardian(uuid,bigint,bigint,bigint,text,text,text,text,text,boolean) to service_role;
