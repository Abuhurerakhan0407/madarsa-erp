create or replace function public.add_hostel_bed_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_hostel_id bigint,p_building_key text,p_floor_key text,p_room_key text,p_bed_key text,p_category text
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_building text:=lower(btrim(coalesce(p_building_key,'')));v_floor text:=lower(btrim(coalesce(p_floor_key,'')));v_room text:=lower(btrim(coalesce(p_room_key,'')));v_bed text:=lower(btrim(coalesce(p_bed_key,'')));begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.resident.manage');
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if not exists(select 1 from public.hostels h where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id and h.id=p_hostel_id and h.state='active') then raise exception 'active hostel in this branch required';end if;
  if v_building !~ '^[a-z0-9][a-z0-9_-]{0,63}$' or v_room !~ '^[a-z0-9][a-z0-9_-]{0,63}$' or v_bed !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then raise exception 'valid building, room and bed keys required';end if;
  if v_floor<>'' and v_floor !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then raise exception 'valid floor key required';end if;
  insert into public.hostel_beds(tenant_id,hostel_id,building_key,floor_key,room_key,bed_key,category,fee_item_id,state)
  values(p_tenant_id,p_hostel_id,v_building,nullif(v_floor,''),v_room,v_bed,nullif(left(btrim(coalesce(p_category,'')),64),''),null,'available') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.bed.add','succeeded','hostel_bed',v_id::text,gen_random_uuid(),jsonb_build_object('hostel_id',p_hostel_id,'building_key',v_building,'floor_key',nullif(v_floor,''),'room_key',v_room,'bed_key',v_bed,'fee_item_id',null));
  return jsonb_build_object('bed_id',v_id,'state','available','fee_item_id',null);
end;$fn$;

create or replace function public.allocate_hostel_bed_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_bed_id bigint,p_starts_on date,p_ends_on date
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_enrollment public.enrollments%rowtype;v_bed public.hostel_beds%rowtype;v_id bigint;begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.resident.manage');
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on<p_starts_on) then raise exception 'valid allocation dates required';end if;
  select e.* into v_enrollment from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status in('active','paused') order by e.starts_on desc,e.id desc limit 1;
  if v_enrollment.id is null then raise exception 'active student enrollment in this branch required';end if;
  select b.* into v_bed from public.hostel_beds b join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id
  where b.tenant_id=p_tenant_id and b.id=p_bed_id and h.branch_id=p_branch_id and h.state='active' for update of b;
  if v_bed.id is null then raise exception 'hostel bed not found in branch';end if;
  if v_bed.state<>'available' then raise exception 'hostel bed is not available';end if;
  if exists(select 1 from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and h.branch_id=p_branch_id and a.state in('allocated','occupied','temporary_leave')) then raise exception 'student already has an open hostel allocation';end if;
  insert into public.hostel_allocations(tenant_id,bed_id,student_person_id,enrollment_id,starts_on,ends_on,state,eligibility_snapshot,vacate_clearance)
  values(p_tenant_id,p_bed_id,p_student_person_id,v_enrollment.id,p_starts_on,p_ends_on,'occupied',jsonb_build_object('enrollment_id',v_enrollment.id,'session_id',v_enrollment.session_id,'program_id',v_enrollment.program_id,'group_id',v_enrollment.group_id,'branch_id',p_branch_id,'fee_item_id',v_bed.fee_item_id,'financial_clearance','deferred'),null) returning id into v_id;
  update public.hostel_beds set state='occupied' where tenant_id=p_tenant_id and id=p_bed_id;
  insert into public.hostel_allocation_events(tenant_id,allocation_id,event_type,from_state,to_state,reason,occurred_at)
  values(p_tenant_id,v_id,'allocated',null,jsonb_build_object('state','occupied','bed_id',p_bed_id),'operator allocation',now());
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.allocation.create','succeeded','hostel_allocation',v_id::text,gen_random_uuid(),jsonb_build_object('student_person_id',p_student_person_id,'bed_id',p_bed_id,'starts_on',p_starts_on,'ends_on',p_ends_on,'financial_clearance','deferred'));
  return jsonb_build_object('allocation_id',v_id,'state','occupied','fee_assignment_id',null,'financial_clearance','deferred');
end;$fn$;

create or replace function public.vacate_hostel_allocation_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_allocation_id bigint,p_ends_on date,p_clearance jsonb
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_allocation public.hostel_allocations%rowtype;v_clearance jsonb;begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.resident.manage');
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if p_clearance is null or jsonb_typeof(p_clearance)<>'object' or length(p_clearance::text)>8192 then raise exception 'vacate clearance must be a JSON object';end if;
  select a.* into v_allocation from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id
  where a.tenant_id=p_tenant_id and a.id=p_allocation_id and h.branch_id=p_branch_id for update of a;
  if v_allocation.id is null then raise exception 'hostel allocation not found in branch';end if;
  if v_allocation.state not in('allocated','occupied','temporary_leave') then raise exception 'hostel allocation is already closed';end if;
  if p_ends_on is null or p_ends_on<v_allocation.starts_on then raise exception 'valid vacate date required';end if;
  v_clearance:=p_clearance||jsonb_build_object('bed_released',true,'financial_clearance','deferred');
  update public.hostel_allocations set state='vacated',ends_on=p_ends_on,vacate_clearance=v_clearance where tenant_id=p_tenant_id and id=p_allocation_id;
  update public.hostel_beds set state='available' where tenant_id=p_tenant_id and id=v_allocation.bed_id;
  insert into public.hostel_allocation_events(tenant_id,allocation_id,event_type,from_state,to_state,reason,occurred_at)
  values(p_tenant_id,p_allocation_id,'vacated',jsonb_build_object('state',v_allocation.state),jsonb_build_object('state','vacated','ends_on',p_ends_on,'bed_id',v_allocation.bed_id),'operator vacate',now());
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.allocation.vacate','succeeded','hostel_allocation',p_allocation_id::text,gen_random_uuid(),jsonb_build_object('state','vacated','ends_on',p_ends_on,'clearance',v_clearance));
  return jsonb_build_object('allocation_id',p_allocation_id,'state','vacated','bed_state','available','financial_clearance','deferred');
end;$fn$;

revoke all on function public.add_hostel_bed_v1(uuid,bigint,bigint,bigint,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.allocate_hostel_bed_v1(uuid,bigint,bigint,bigint,bigint,date,date) from public,anon,authenticated;
revoke all on function public.vacate_hostel_allocation_v1(uuid,bigint,bigint,bigint,date,jsonb) from public,anon,authenticated;
grant execute on function public.add_hostel_bed_v1(uuid,bigint,bigint,bigint,text,text,text,text,text) to service_role;
grant execute on function public.allocate_hostel_bed_v1(uuid,bigint,bigint,bigint,bigint,date,date) to service_role;
grant execute on function public.vacate_hostel_allocation_v1(uuid,bigint,bigint,bigint,date,jsonb) to service_role;
