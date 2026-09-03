create or replace function public.update_teacher_profile_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_employment_id bigint,
  p_display_name text,p_name_native text,p_email text,p_phone text,p_designation text,p_joined_on date
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_person_id bigint;
  v_membership bigint;
  v_email text:=lower(btrim(coalesce(p_email,'')));
  v_phone text:=btrim(coalesce(p_phone,''));
  v_designation text:=btrim(coalesce(p_designation,''));
begin
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage') then raise exception 'teacher management permission denied';end if;
  select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now()) order by m.id limit 1;
  select he.employee_person_id into v_person_id from public.hr_employments he where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.id=p_employment_id and he.state in('active','on_leave','suspended');
  if v_person_id is null then raise exception 'teacher employment not found';end if;
  if length(btrim(coalesce(p_display_name,'')))<2 or length(btrim(p_display_name))>160 then raise exception 'teacher name must be 2 to 160 characters';end if;
  if p_name_native is not null and length(btrim(p_name_native))>160 then raise exception 'native name is too long';end if;
  if v_designation='' or length(v_designation)>120 then raise exception 'designation must be 1 to 120 characters';end if;
  if p_joined_on is null or p_joined_on<date '1900-01-01' or p_joined_on>public.institution_local_date(p_tenant_id)+1 then raise exception 'valid joining date is required';end if;
  if length(v_email)>320 then raise exception 'teacher email is too long';end if;
  if v_email<>'' and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'valid teacher email required';end if;
  if length(v_phone)>40 then raise exception 'teacher phone is too long';end if;
  if v_phone<>'' and length(v_phone)<5 then raise exception 'valid teacher phone required';end if;

  update public.persons set display_name=btrim(p_display_name),name_native=nullif(btrim(coalesce(p_name_native,'')),''),updated_at=now() where tenant_id=p_tenant_id and id=v_person_id;
  update public.hr_employments set starts_on=p_joined_on,updated_at=now() where tenant_id=p_tenant_id and id=p_employment_id;
  update public.employee_profiles set designation=v_designation,joined_on=p_joined_on,updated_at=now() where tenant_id=p_tenant_id and person_id=v_person_id;

  if v_email='' then
    delete from public.person_contacts where tenant_id=p_tenant_id and person_id=v_person_id and type='email';
  elsif exists(select 1 from public.person_contacts pc where pc.tenant_id=p_tenant_id and pc.person_id=v_person_id and pc.type='email') then
    update public.person_contacts set value=v_email,normalized_value=v_email,is_primary=true,visibility='staff',updated_at=now()
    where id=(select pc.id from public.person_contacts pc where pc.tenant_id=p_tenant_id and pc.person_id=v_person_id and pc.type='email' order by pc.is_primary desc,pc.id limit 1);
  else
    insert into public.person_contacts(tenant_id,person_id,type,label,value,normalized_value,is_primary,is_verified,consent,visibility)
    values(p_tenant_id,v_person_id,'email','Work email',v_email,v_email,true,false,'{}'::jsonb,'staff');
  end if;

  if v_phone='' then
    delete from public.person_contacts where tenant_id=p_tenant_id and person_id=v_person_id and type='phone';
  elsif exists(select 1 from public.person_contacts pc where pc.tenant_id=p_tenant_id and pc.person_id=v_person_id and pc.type='phone') then
    update public.person_contacts set value=v_phone,normalized_value=regexp_replace(v_phone,'[^0-9+]','','g'),is_primary=true,visibility='staff',updated_at=now()
    where id=(select pc.id from public.person_contacts pc where pc.tenant_id=p_tenant_id and pc.person_id=v_person_id and pc.type='phone' order by pc.is_primary desc,pc.id limit 1);
  else
    insert into public.person_contacts(tenant_id,person_id,type,label,value,normalized_value,is_primary,is_verified,consent,visibility)
    values(p_tenant_id,v_person_id,'phone','Work phone',v_phone,regexp_replace(v_phone,'[^0-9+]','','g'),true,false,'{}'::jsonb,'staff');
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'teacher.profile.update','succeeded','person',v_person_id::text,gen_random_uuid(),jsonb_build_object('employment_id',p_employment_id,'designation',v_designation,'joined_on',p_joined_on,'email_present',v_email<>'','phone_present',v_phone<>''));
  return jsonb_build_object('employment_id',p_employment_id,'person_id',v_person_id,'updated',true);
end;
$$;
revoke all on function public.update_teacher_profile_v1(uuid,bigint,bigint,bigint,text,text,text,text,text,date) from public,anon,authenticated;
grant execute on function public.update_teacher_profile_v1(uuid,bigint,bigint,bigint,text,text,text,text,text,date) to service_role;
