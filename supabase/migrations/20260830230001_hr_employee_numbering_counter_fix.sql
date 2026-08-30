do $block$
declare
  v_tenant bigint;
  v_branch bigint;
  v_owner_membership bigint;
begin
  select t.id into v_tenant from public.tenants t where t.slug='al-noor-islamic-academy' or t.name='Al-Noor Islamic Academy' order by t.id limit 1;
  if v_tenant is null then return; end if;
  select b.id into v_branch from public.branches b where b.tenant_id=v_tenant and b.code='MAIN' order by b.id limit 1;
  select m.id into v_owner_membership
  from public.memberships m
  join public.membership_roles mr on mr.tenant_id=m.tenant_id and mr.membership_id=m.id
  join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id
  where m.tenant_id=v_tenant and m.status='active' and r.key='institution_owner'
  order by m.id limit 1;
  if v_branch is null or v_owner_membership is null then return; end if;

  if not exists(select 1 from public.number_sequences ns where ns.tenant_id=v_tenant and ns.branch_id=v_branch and ns.key='employee_default' and ns.version=2) then
    update public.number_sequences
       set status='retired',updated_at=clock_timestamp()
     where tenant_id=v_tenant and branch_id=v_branch and key='employee_default' and status='published';

    insert into public.number_sequences(tenant_id,branch_id,key,entity_type,pattern,next_value,padding,reset_period,reserved_values,status,effective_at,published_at,created_by_membership_id,published_by_membership_id,version)
    values(v_tenant,v_branch,'employee_default','employee','EMP-{BRANCH}-{YYYY}-{SEQ}',1,5,'never',array[]::bigint[],'published',clock_timestamp(),clock_timestamp(),v_owner_membership,v_owner_membership,2);
  end if;
end;
$block$;

create or replace function public.create_hr_employee_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_display_name text,
  p_name_native text default null,
  p_gender text default null,
  p_preferred_locale text default 'en',
  p_department_key text default null,
  p_designation text default 'Staff Member',
  p_contract_type text default 'permanent',
  p_joined_on date default current_date,
  p_qualification_summary text default null,
  p_payroll_eligible boolean default true
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_number text;
  v_person bigint;
  v_employment bigint;
  v_department text;
  v_designation_key text;
  v_profile_employment_type text;
begin
  if length(btrim(coalesce(p_display_name,'')))<2 or length(btrim(p_display_name))>160 then raise exception 'employee name is invalid'; end if;
  if p_gender is not null and p_gender not in ('male','female','other','undisclosed') then raise exception 'employee gender is invalid'; end if;
  if p_preferred_locale not in ('en','ur','ar') then raise exception 'preferred locale is invalid'; end if;
  if p_contract_type not in ('permanent','fixed_term','part_time','casual','volunteer','consultant') then raise exception 'contract type is invalid'; end if;
  if length(btrim(coalesce(p_designation,'')))<2 or length(btrim(p_designation))>120 then raise exception 'designation is invalid'; end if;
  if p_qualification_summary is not null and length(p_qualification_summary)>1000 then raise exception 'qualification summary is too long'; end if;

  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hr.employee.manage'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'employee management permission denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch not found'; end if;

  v_department:=nullif(regexp_replace(lower(btrim(coalesce(p_department_key,''))),'[^a-z0-9]+','_','g'),'');
  v_designation_key:=trim(both '_' from regexp_replace(lower(btrim(p_designation)),'[^a-z0-9]+','_','g'));
  v_profile_employment_type:=case p_contract_type when 'part_time' then 'part_time' when 'volunteer' then 'volunteer' when 'casual' then 'contract' when 'consultant' then 'contract' else 'full_time' end;

  v_number:=private.reserve_formatted_number(p_tenant_id,'employee_default',p_branch_id,null,p_joined_on);
  if exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.employee_number=v_number) then raise exception 'generated employee number already exists'; end if;

  insert into public.persons(tenant_id,display_name,name_native,gender,preferred_locale,status,metadata)
  values(p_tenant_id,btrim(p_display_name),nullif(btrim(coalesce(p_name_native,'')),''),p_gender,p_preferred_locale,'active',jsonb_build_object('created_via','hr_workspace'))
  returning id into v_person;

  insert into public.employee_profiles(person_id,tenant_id,employee_number,department_key,designation,employment_type,joined_on,status,qualification_summary)
  values(v_person,p_tenant_id,v_number,v_department,btrim(p_designation),v_profile_employment_type,p_joined_on,'active',nullif(btrim(coalesce(p_qualification_summary,'')),''));

  insert into public.hr_employments(tenant_id,employee_person_id,branch_id,employee_number,department_key,designation_key,contract_type,manager_person_id,starts_on,payroll_eligible,state)
  values(p_tenant_id,v_person,p_branch_id,v_number,v_department,v_designation_key,p_contract_type,null,p_joined_on,p_payroll_eligible,'active')
  returning id into v_employment;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hr.employee.create','succeeded','hr_employment',v_employment::text,gen_random_uuid(),jsonb_build_object('person_id',v_person,'employee_number',v_number,'designation',btrim(p_designation),'contract_type',p_contract_type));

  return jsonb_build_object('employment_id',v_employment,'person_id',v_person,'employee_number',v_number);
end;
$fn$;

revoke all on function public.create_hr_employee_v1(uuid,bigint,bigint,text,text,text,text,text,text,text,date,text,boolean) from public,anon,authenticated;
grant execute on function public.create_hr_employee_v1(uuid,bigint,bigint,text,text,text,text,text,text,text,date,text,boolean) to service_role;