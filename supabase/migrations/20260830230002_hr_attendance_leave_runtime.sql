create or replace view public.hr_effective_attendance_v1 as
select
  a.id,a.tenant_id,a.employment_id,a.attendance_date,
  coalesce(c.corrected_status,a.status) as status,
  coalesce(nullif(c.corrected_times->>'check_in_at','')::timestamptz,a.check_in_at) as check_in_at,
  coalesce(nullif(c.corrected_times->>'check_out_at','')::timestamptz,a.check_out_at) as check_out_at,
  coalesce(nullif(c.corrected_times->>'source',''),a.source) as source,
  a.source_reference,a.approved_by_membership_id,a.idempotency_key,a.created_at,
  c.id as latest_correction_id,c.reason as correction_reason,c.created_at as corrected_at
from public.hr_attendance_records a
left join lateral (
  select hc.* from public.hr_attendance_corrections hc
  where hc.tenant_id=a.tenant_id and hc.attendance_record_id=a.id
  order by hc.created_at desc,hc.id desc limit 1
) c on true;

create or replace function public.record_hr_attendance_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_employment_id bigint,
  p_attendance_date date,
  p_status text,
  p_check_in_at timestamptz default null,
  p_check_out_at timestamptz default null,
  p_source text default 'manual',
  p_request_key text default null,
  p_reason text default null
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_record public.hr_attendance_records%rowtype;
  v_effective record;
  v_correction bigint;
  v_local_date date:=public.institution_local_date(p_tenant_id);
  v_status text:=lower(btrim(coalesce(p_status,'')));
  v_source text:=lower(btrim(coalesce(p_source,'')));
begin
  if v_status not in ('present','absent','late','leave','holiday','weekend','unmarked') then raise exception 'invalid staff attendance status'; end if;
  if v_source not in ('manual','device','import','leave','system') then raise exception 'invalid staff attendance source'; end if;
  if p_attendance_date is null or p_attendance_date>v_local_date then raise exception 'future staff attendance is not allowed'; end if;
  if p_check_out_at is not null and p_check_in_at is not null and p_check_out_at<p_check_in_at then raise exception 'check-out cannot be before check-in'; end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'valid attendance request key required'; end if;

  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hr.employee.manage')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'staff attendance permission denied'; end if;
  if not exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.id=p_employment_id and e.branch_id=p_branch_id and e.state in ('active','on_leave','suspended')) then raise exception 'employment not found in active branch'; end if;

  select * into v_record from public.hr_attendance_records a where a.tenant_id=p_tenant_id and a.employment_id=p_employment_id and a.attendance_date=p_attendance_date for update;
  if not found then
    insert into public.hr_attendance_records(tenant_id,employment_id,attendance_date,status,check_in_at,check_out_at,source,source_reference,approved_by_membership_id,idempotency_key)
    values(p_tenant_id,p_employment_id,p_attendance_date,v_status,p_check_in_at,p_check_out_at,v_source,null,v_membership,p_request_key)
    returning * into v_record;
    insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
    values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hr.attendance.mark','succeeded','hr_attendance_record',v_record.id::text,gen_random_uuid(),jsonb_build_object('employment_id',p_employment_id,'date',p_attendance_date,'status',v_status,'source',v_source));
    return jsonb_build_object('attendance_record_id',v_record.id,'corrected',false,'status',v_status);
  end if;

  select * into v_effective from public.hr_effective_attendance_v1 ea where ea.tenant_id=p_tenant_id and ea.id=v_record.id;
  if v_effective.status=v_status and v_effective.check_in_at is not distinct from p_check_in_at and v_effective.check_out_at is not distinct from p_check_out_at and v_effective.source=v_source then
    return jsonb_build_object('attendance_record_id',v_record.id,'corrected',v_effective.latest_correction_id is not null,'unchanged',true,'status',v_status);
  end if;
  if length(btrim(coalesce(p_reason,'')))<4 then raise exception 'attendance correction reason is required'; end if;

  insert into public.hr_attendance_corrections(tenant_id,attendance_record_id,corrected_status,corrected_times,reason,approved_by_membership_id)
  values(p_tenant_id,v_record.id,v_status,jsonb_build_object('check_in_at',p_check_in_at,'check_out_at',p_check_out_at,'source',v_source),btrim(p_reason),v_membership)
  returning id into v_correction;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hr.attendance.correct','succeeded','hr_attendance_correction',v_correction::text,gen_random_uuid(),jsonb_build_object('attendance_record_id',v_record.id,'employment_id',p_employment_id,'date',p_attendance_date,'status',v_status,'reason',btrim(p_reason)));
  return jsonb_build_object('attendance_record_id',v_record.id,'correction_id',v_correction,'corrected',true,'status',v_status);
end;
$fn$;

create or replace function public.get_hr_attendance_workspace_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_attendance_date date default null,p_search text default null
) returns jsonb
language plpgsql stable set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_date date:=coalesce(p_attendance_date,public.institution_local_date(p_tenant_id));
  v_rows jsonb;
  v_summary jsonb;
begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hr.employee.read')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'staff attendance read permission denied'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.display_name),'[]'::jsonb) into v_rows from (
    select e.id employment_id,e.employee_person_id person_id,e.employee_number,p.display_name,p.name_native,e.department_key,e.designation_key,e.state employment_state,
      a.id attendance_record_id,coalesce(a.status,'unmarked') status,a.check_in_at,a.check_out_at,a.source,a.latest_correction_id,a.correction_reason
    from public.hr_employments e
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id
    left join public.hr_effective_attendance_v1 a on a.tenant_id=e.tenant_id and a.employment_id=e.id and a.attendance_date=v_date
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.state in ('active','on_leave','suspended')
      and (p_search is null or btrim(p_search)='' or p.display_name ilike '%'||btrim(p_search)||'%' or e.employee_number ilike '%'||btrim(p_search)||'%')
  ) x;
  select jsonb_build_object('total',count(*),'marked',count(*) filter(where a.id is not null),'present',count(*) filter(where a.status='present'),'absent',count(*) filter(where a.status='absent'),'late',count(*) filter(where a.status='late'),'leave',count(*) filter(where a.status='leave'),'unmarked',count(*) filter(where a.id is null)) into v_summary
  from public.hr_employments e left join public.hr_effective_attendance_v1 a on a.tenant_id=e.tenant_id and a.employment_id=e.id and a.attendance_date=v_date where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.state in ('active','on_leave','suspended');
  return jsonb_build_object('date',v_date,'summary',v_summary,'rows',v_rows,'can_manage',true);
end;
$fn$;

create or replace function public.submit_hr_leave_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_employment_id bigint,p_leave_type_id bigint,p_starts_on date,p_ends_on date,p_reason text default null
) returns jsonb
language plpgsql set search_path to ''
as $fn$
declare v_membership bigint;v_leave bigint;v_units numeric;begin
  if p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on then raise exception 'valid leave dates are required'; end if;
  if p_reason is not null and length(p_reason)>1000 then raise exception 'leave reason is too long'; end if;
  select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hr.employee.manage') order by m.created_at limit 1;
  if v_membership is null then raise exception 'leave management permission denied'; end if;
  if not exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.id=p_employment_id and e.branch_id=p_branch_id and e.state in ('active','on_leave')) then raise exception 'employment not found in active branch'; end if;
  if not exists(select 1 from public.hr_leave_types lt where lt.tenant_id=p_tenant_id and lt.id=p_leave_type_id and lt.state='active') then raise exception 'active leave type required'; end if;
  if exists(select 1 from public.hr_leave_requests lr where lr.tenant_id=p_tenant_id and lr.employment_id=p_employment_id and lr.state in ('submitted','approved') and daterange(lr.starts_on,lr.ends_on,'[]') && daterange(p_starts_on,p_ends_on,'[]')) then raise exception 'overlapping leave request exists'; end if;
  v_units:=(p_ends_on-p_starts_on)+1;
  insert into public.hr_leave_requests(tenant_id,employment_id,leave_type_id,starts_on,ends_on,requested_units,reason,state)
  values(p_tenant_id,p_employment_id,p_leave_type_id,p_starts_on,p_ends_on,v_units,nullif(btrim(coalesce(p_reason,'')),''),'submitted') returning id into v_leave;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hr.leave.submit','succeeded','hr_leave_request',v_leave::text,gen_random_uuid(),jsonb_build_object('employment_id',p_employment_id,'starts_on',p_starts_on,'ends_on',p_ends_on,'requested_units',v_units));
  return jsonb_build_object('leave_request_id',v_leave,'state','submitted','requested_units',v_units);
end;
$fn$;

create or replace function public.decide_hr_leave_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_leave_request_id bigint,p_decision text,p_reason text default null
) returns jsonb
language plpgsql set search_path to ''
as $fn$
declare v_membership bigint;v_leave public.hr_leave_requests%rowtype;v_decision text:=lower(btrim(coalesce(p_decision,'')));begin
  if v_decision not in ('approved','rejected') then raise exception 'leave decision is invalid'; end if;
  if v_decision='rejected' and length(btrim(coalesce(p_reason,'')))<4 then raise exception 'rejection reason is required'; end if;
  select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hr.employee.manage') order by m.created_at limit 1;
  if v_membership is null then raise exception 'leave decision permission denied'; end if;
  select lr.* into v_leave from public.hr_leave_requests lr join public.hr_employments e on e.tenant_id=lr.tenant_id and e.id=lr.employment_id where lr.tenant_id=p_tenant_id and lr.id=p_leave_request_id and e.branch_id=p_branch_id for update;
  if not found then raise exception 'leave request not found'; end if;
  if v_leave.state<>'submitted' then raise exception 'leave request is not awaiting decision'; end if;
  update public.hr_leave_requests set state=v_decision,decided_by_membership_id=v_membership,decided_at=clock_timestamp(),decision_reason=nullif(btrim(coalesce(p_reason,'')),'') where tenant_id=p_tenant_id and id=p_leave_request_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hr.leave.decide','succeeded','hr_leave_request',p_leave_request_id::text,gen_random_uuid(),jsonb_build_object('decision',v_decision,'reason',nullif(btrim(coalesce(p_reason,'')),'')));
  return jsonb_build_object('leave_request_id',p_leave_request_id,'state',v_decision);
end;
$fn$;

create or replace function public.get_hr_leave_workspace_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_state text default null) returns jsonb language plpgsql stable set search_path to '' as $fn$ declare v_membership bigint;v_types jsonb;v_rows jsonb;begin
  select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hr.employee.read') order by m.created_at limit 1;
  if v_membership is null then raise exception 'leave read permission denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',lt.id,'key',lt.key,'labels',lt.labels,'payroll_effect',lt.payroll_effect) order by lt.key),'[]'::jsonb) into v_types from public.hr_leave_types lt where lt.tenant_id=p_tenant_id and lt.state='active';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_on desc,x.id desc),'[]'::jsonb) into v_rows from (select lr.id,lr.employment_id,e.employee_person_id person_id,e.employee_number,p.display_name,lr.leave_type_id,lt.key leave_type_key,lt.labels leave_type_labels,lr.starts_on,lr.ends_on,lr.requested_units,lr.reason,lr.state,lr.decided_at,lr.decision_reason from public.hr_leave_requests lr join public.hr_employments e on e.tenant_id=lr.tenant_id and e.id=lr.employment_id join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id join public.hr_leave_types lt on lt.tenant_id=lr.tenant_id and lt.id=lr.leave_type_id where lr.tenant_id=p_tenant_id and e.branch_id=p_branch_id and (p_state is null or p_state='' or lr.state=p_state)) x;
  return jsonb_build_object('leave_types',v_types,'rows',v_rows,'can_manage',true);
end;$fn$;

revoke all on public.hr_effective_attendance_v1 from public,anon,authenticated;
grant select on public.hr_effective_attendance_v1 to service_role;
revoke all on function public.record_hr_attendance_v1(uuid,bigint,bigint,bigint,date,text,timestamptz,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.record_hr_attendance_v1(uuid,bigint,bigint,bigint,date,text,timestamptz,timestamptz,text,text,text) to service_role;
revoke all on function public.get_hr_attendance_workspace_v1(uuid,bigint,bigint,date,text) from public,anon,authenticated;
grant execute on function public.get_hr_attendance_workspace_v1(uuid,bigint,bigint,date,text) to service_role;
revoke all on function public.submit_hr_leave_v1(uuid,bigint,bigint,bigint,bigint,date,date,text) from public,anon,authenticated;
grant execute on function public.submit_hr_leave_v1(uuid,bigint,bigint,bigint,bigint,date,date,text) to service_role;
revoke all on function public.decide_hr_leave_v1(uuid,bigint,bigint,bigint,text,text) from public,anon,authenticated;
grant execute on function public.decide_hr_leave_v1(uuid,bigint,bigint,bigint,text,text) to service_role;
revoke all on function public.get_hr_leave_workspace_v1(uuid,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.get_hr_leave_workspace_v1(uuid,bigint,bigint,text) to service_role;