create index if not exists hr_employments_branch_state_idx
  on public.hr_employments(tenant_id,branch_id,state,starts_on desc);
create index if not exists hr_attendance_branch_date_idx
  on public.hr_attendance_records(tenant_id,attendance_date,employment_id);
create index if not exists hr_leave_employment_state_idx
  on public.hr_leave_requests(tenant_id,employment_id,state,starts_on desc);

-- Seed only the existing demo institution. Future tenants are configured during onboarding.
do $block$
declare
  v_tenant bigint;
  v_branch bigint;
  v_owner_membership bigint;
  v_evaluator_person bigint;
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

  if not exists(select 1 from public.number_sequences ns where ns.tenant_id=v_tenant and ns.branch_id=v_branch and ns.key='employee_default' and ns.status='published') then
    insert into public.number_sequences(tenant_id,branch_id,key,entity_type,pattern,next_value,padding,reset_period,reserved_values,status,effective_at,published_at,created_by_membership_id,published_by_membership_id,version)
    values(v_tenant,v_branch,'employee_default','employee','EMP-{BRANCH}-{YEAR}-{SEQ}',1,5,'never',array[]::bigint[],'published',clock_timestamp(),clock_timestamp(),v_owner_membership,v_owner_membership,1);
  end if;

  insert into public.hr_leave_types(tenant_id,key,labels,eligibility_rules,accrual_rules,carry_forward_rules,payroll_effect,approval_rules,version,state)
  select v_tenant,x.key,x.labels,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,x.payroll_effect,'{}'::jsonb,1,'active'
  from (values
    ('casual_leave',jsonb_build_object('en','Casual Leave','ur','اتفاقی رخصت','ar','إجازة عارضة'),'paid'),
    ('sick_leave',jsonb_build_object('en','Sick Leave','ur','بیماری کی رخصت','ar','إجازة مرضية'),'paid'),
    ('unpaid_leave',jsonb_build_object('en','Unpaid Leave','ur','بلا تنخواہ رخصت','ar','إجازة بدون راتب'),'unpaid')
  ) as x(key,labels,payroll_effect)
  where not exists(select 1 from public.hr_leave_types lt where lt.tenant_id=v_tenant and lt.key=x.key and lt.version=1);

  select ep.person_id into v_evaluator_person
  from public.employee_profiles ep
  where ep.tenant_id=v_tenant and ep.employee_number='DEMO-EXAM-001'
  order by ep.person_id limit 1;
  if v_evaluator_person is not null and not exists(select 1 from public.hr_employments e where e.tenant_id=v_tenant and e.employee_person_id=v_evaluator_person and e.state<>'archived') then
    insert into public.hr_employments(tenant_id,employee_person_id,branch_id,employee_number,department_key,designation_key,contract_type,manager_person_id,starts_on,payroll_eligible,state)
    values(v_tenant,v_evaluator_person,v_branch,'DEMO-EXAM-001','academics','exam_evaluator','permanent',null,date '2026-06-01',true,'active');
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
  v_sequence public.number_sequences%rowtype;
  v_branch_code text;
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

  select b.code into v_branch_code from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active';
  if v_branch_code is null then raise exception 'active branch not found'; end if;

  select ns.* into v_sequence
  from public.number_sequences ns
  where ns.tenant_id=p_tenant_id and ns.entity_type='employee' and ns.status='published'
    and (ns.branch_id=p_branch_id or ns.branch_id is null)
  order by (ns.branch_id=p_branch_id) desc,ns.version desc,ns.id desc
  for update limit 1;
  if not found then raise exception 'employee numbering is not configured'; end if;

  v_number:=replace(replace(replace(v_sequence.pattern,'{BRANCH}',upper(v_branch_code)),'{YEAR}',extract(year from p_joined_on)::int::text),'{SEQ}',lpad(v_sequence.next_value::text,v_sequence.padding,'0'));
  if exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.employee_number=v_number) then raise exception 'generated employee number already exists'; end if;

  v_department:=nullif(regexp_replace(lower(btrim(coalesce(p_department_key,''))),'[^a-z0-9]+','_','g'),'');
  v_designation_key:=trim(both '_' from regexp_replace(lower(btrim(p_designation)),'[^a-z0-9]+','_','g'));
  v_profile_employment_type:=case p_contract_type when 'part_time' then 'part_time' when 'volunteer' then 'volunteer' when 'casual' then 'contract' when 'consultant' then 'contract' else 'full_time' end;

  insert into public.persons(tenant_id,display_name,name_native,gender,preferred_locale,status)
  values(p_tenant_id,btrim(p_display_name),nullif(btrim(coalesce(p_name_native,'')),''),p_gender,p_preferred_locale,'active')
  returning id into v_person;

  insert into public.employee_profiles(person_id,tenant_id,employee_number,department_key,designation,employment_type,joined_on,status,qualification_summary)
  values(v_person,p_tenant_id,v_number,v_department,btrim(p_designation),v_profile_employment_type,p_joined_on,'active',nullif(btrim(coalesce(p_qualification_summary,'')),''));

  insert into public.hr_employments(tenant_id,employee_person_id,branch_id,employee_number,department_key,designation_key,contract_type,manager_person_id,starts_on,payroll_eligible,state)
  values(p_tenant_id,v_person,p_branch_id,v_number,v_department,v_designation_key,p_contract_type,null,p_joined_on,p_payroll_eligible,'active')
  returning id into v_employment;

  update public.number_sequences set next_value=next_value+1,updated_at=clock_timestamp() where id=v_sequence.id;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hr.employee.create','succeeded','hr_employment',v_employment::text,gen_random_uuid(),jsonb_build_object('person_id',v_person,'employee_number',v_number,'designation',btrim(p_designation),'contract_type',p_contract_type));

  return jsonb_build_object('employment_id',v_employment,'person_id',v_person,'employee_number',v_number);
end;
$fn$;

create or replace function public.get_hr_employees_workspace_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_search text default null,
  p_state text default null,
  p_page integer default 1,
  p_page_size integer default 40
) returns jsonb
language plpgsql
stable
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_can_manage boolean:=false;
  v_total bigint;
  v_rows jsonb;
  v_summary jsonb;
  v_offset integer:=greatest(coalesce(p_page,1)-1,0)*least(greatest(coalesce(p_page_size,40),1),100);
begin
  select m.id,
    exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hr.employee.manage')
  into v_membership,v_can_manage
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hr.employee.read')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'employee read permission denied'; end if;

  select count(*) into v_total
  from public.hr_employments e join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
    and (p_state is null or p_state='' or e.state=p_state)
    and (p_search is null or btrim(p_search)='' or p.display_name ilike '%'||btrim(p_search)||'%' or e.employee_number ilike '%'||btrim(p_search)||'%' or coalesce(e.department_key,'') ilike '%'||btrim(p_search)||'%' or e.designation_key ilike '%'||btrim(p_search)||'%');

  select coalesce(jsonb_agg(to_jsonb(x) order by x.display_name),'[]'::jsonb) into v_rows
  from (
    select e.id employment_id,e.employee_person_id person_id,e.employee_number,p.display_name,p.name_native,e.department_key,
      e.designation_key,e.contract_type,e.starts_on,e.ends_on,e.payroll_eligible,e.state,
      ar.status attendance_today,ar.check_in_at,ar.check_out_at,ar.source attendance_source,
      (select count(*) from public.hr_leave_requests lr where lr.tenant_id=e.tenant_id and lr.employment_id=e.id and lr.state='submitted') pending_leave_requests
    from public.hr_employments e
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id
    left join public.hr_attendance_records ar on ar.tenant_id=e.tenant_id and ar.employment_id=e.id and ar.attendance_date=current_date
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and (p_state is null or p_state='' or e.state=p_state)
      and (p_search is null or btrim(p_search)='' or p.display_name ilike '%'||btrim(p_search)||'%' or e.employee_number ilike '%'||btrim(p_search)||'%' or coalesce(e.department_key,'') ilike '%'||btrim(p_search)||'%' or e.designation_key ilike '%'||btrim(p_search)||'%')
    order by p.display_name,e.id
    limit least(greatest(coalesce(p_page_size,40),1),100) offset v_offset
  ) x;

  select jsonb_build_object(
    'total',count(*),
    'active',count(*) filter(where state='active'),
    'on_leave',count(*) filter(where state='on_leave'),
    'attendance_marked_today',(select count(*) from public.hr_attendance_records ar join public.hr_employments he on he.tenant_id=ar.tenant_id and he.id=ar.employment_id where ar.tenant_id=p_tenant_id and he.branch_id=p_branch_id and ar.attendance_date=current_date),
    'leave_pending',(select count(*) from public.hr_leave_requests lr join public.hr_employments he on he.tenant_id=lr.tenant_id and he.id=lr.employment_id where lr.tenant_id=p_tenant_id and he.branch_id=p_branch_id and lr.state='submitted')
  ) into v_summary from public.hr_employments where tenant_id=p_tenant_id and branch_id=p_branch_id;

  return jsonb_build_object('summary',v_summary,'total',v_total,'page',greatest(coalesce(p_page,1),1),'page_size',least(greatest(coalesce(p_page_size,40),1),100),'can_manage',v_can_manage,'rows',v_rows);
end;
$fn$;

revoke all on function public.create_hr_employee_v1(uuid,bigint,bigint,text,text,text,text,text,text,text,date,text,boolean) from public,anon,authenticated;
grant execute on function public.create_hr_employee_v1(uuid,bigint,bigint,text,text,text,text,text,text,text,date,text,boolean) to service_role;
revoke all on function public.get_hr_employees_workspace_v1(uuid,bigint,bigint,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_hr_employees_workspace_v1(uuid,bigint,bigint,text,text,integer,integer) to service_role;