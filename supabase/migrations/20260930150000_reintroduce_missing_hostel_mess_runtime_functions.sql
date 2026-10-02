-- Reconcile staging/release migration drift for the Hostel & Mess runtime.
-- The original August runtime migration contains these functions; this corrective
-- migration makes the currently supported release state reproducible without
-- replaying the entire historical migration.

create or replace function public.create_mess_unit_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_key text,p_labels jsonb
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_key text:=lower(btrim(coalesce(p_key,'')));begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'mess.service.manage');
  if v_membership is null then raise exception 'mess service permission denied';end if;
  if v_key !~ '^[a-z0-9][a-z0-9_-]{1,63}$' then raise exception 'valid mess unit key required';end if;
  if p_labels is null or jsonb_typeof(p_labels)<>'object' or nullif(btrim(coalesce(p_labels->>'en','')),'') is null then raise exception 'English mess unit label required';end if;
  insert into public.mess_units(tenant_id,branch_id,key,labels,cost_account_id,state)
  values(p_tenant_id,p_branch_id,v_key,p_labels,null,'active') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'mess.unit.create','succeeded','mess_unit',v_id::text,gen_random_uuid(),jsonb_build_object('key',v_key,'labels',p_labels));
  return jsonb_build_object('mess_unit_id',v_id,'state','active');
end;$fn$;

create or replace function public.record_mess_attendance_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_meal_service_id bigint,p_person_id bigint,p_served_count integer,p_request_key text
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_existing public.mess_attendance%rowtype;begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'mess.service.manage');
  if v_membership is null then raise exception 'mess service permission denied';end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'valid mess attendance request key required';end if;
  if p_served_count is null or p_served_count<1 or p_served_count>20 then raise exception 'served count must be between 1 and 20';end if;
  select * into v_existing from public.mess_attendance a where a.tenant_id=p_tenant_id and a.idempotency_key=p_request_key;
  if v_existing.id is not null then return jsonb_build_object('attendance_id',v_existing.id,'served_count',v_existing.served_count,'unchanged',true);end if;
  if not exists(select 1 from public.mess_meal_services s join public.mess_units u on u.tenant_id=s.tenant_id and u.id=s.mess_unit_id where s.tenant_id=p_tenant_id and s.id=p_meal_service_id and u.branch_id=p_branch_id and s.state='open') then raise exception 'open meal service in this branch required';end if;
  if not exists(select 1 from public.persons p where p.tenant_id=p_tenant_id and p.id=p_person_id and p.status='active') then raise exception 'active person required';end if;
  if not (
    exists(select 1 from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where a.tenant_id=p_tenant_id and a.student_person_id=p_person_id and h.branch_id=p_branch_id and a.state in('allocated','occupied','temporary_leave'))
    or exists(select 1 from public.hr_employments he where he.tenant_id=p_tenant_id and he.employee_person_id=p_person_id and he.branch_id=p_branch_id and he.state in('active','on_leave'))
  ) then raise exception 'person is not eligible for this branch mess service';end if;
  insert into public.mess_attendance(tenant_id,meal_service_id,person_id,guest_key,served_count,subsidy_fund_id,idempotency_key)
  values(p_tenant_id,p_meal_service_id,p_person_id,null,p_served_count,null,p_request_key) returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'mess.attendance.record','succeeded','mess_attendance',v_id::text,gen_random_uuid(),jsonb_build_object('meal_service_id',p_meal_service_id,'person_id',p_person_id,'served_count',p_served_count));
  return jsonb_build_object('attendance_id',v_id,'served_count',p_served_count,'unchanged',false);
end;$fn$;

revoke all on function public.create_mess_unit_v1(uuid,bigint,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_mess_unit_v1(uuid,bigint,bigint,text,jsonb) to service_role;
revoke all on function public.record_mess_attendance_v1(uuid,bigint,bigint,bigint,bigint,integer,text) from public,anon,authenticated;
grant execute on function public.record_mess_attendance_v1(uuid,bigint,bigint,bigint,bigint,integer,text) to service_role;
