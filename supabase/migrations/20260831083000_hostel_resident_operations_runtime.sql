create or replace function public.resolve_hostel_resident_membership_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint
) returns bigint
language plpgsql stable set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hostel.resident.manage'
    )
  order by m.created_at limit 1;
  return v_membership;
end;$fn$;

create or replace function public.get_hostel_resident_center_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint
) returns jsonb
language plpgsql stable set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_hostels jsonb;v_beds jsonb;v_allocations jsonb;v_students jsonb;v_employees jsonb;begin
  v_membership:=public.resolve_hostel_resident_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required';end if;

  select coalesce(jsonb_agg(row_to_json(x) order by x.label,x.id),'[]'::jsonb) into v_hostels from(
    select h.id,h.key,h.labels,coalesce(nullif(btrim(h.labels->>'en'),''),'Hostel') label,h.warden_person_id,p.display_name warden_name,h.rules,h.state,
      (select count(*)::int from public.hostel_beds b where b.tenant_id=h.tenant_id and b.hostel_id=h.id and b.state<>'inactive') bed_count,
      (select count(*)::int from public.hostel_beds b where b.tenant_id=h.tenant_id and b.hostel_id=h.id and b.state='available') available_beds
    from public.hostels h left join public.persons p on p.tenant_id=h.tenant_id and p.id=h.warden_person_id
    where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id and h.state<>'archived'
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.hostel_id,x.building_key,x.room_key,x.bed_key,x.id),'[]'::jsonb) into v_beds from(
    select b.id,b.hostel_id,b.building_key,b.floor_key,b.room_key,b.bed_key,b.category,b.state,
      coalesce(nullif(btrim(h.labels->>'en'),''),'Hostel') hostel_label,
      (select a.id from public.hostel_allocations a where a.tenant_id=b.tenant_id and a.bed_id=b.id and a.state in('allocated','occupied','temporary_leave') order by a.created_at desc,a.id desc limit 1) active_allocation_id
    from public.hostel_beds b join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id
    where b.tenant_id=p_tenant_id and h.branch_id=p_branch_id and h.state='active' and b.state<>'inactive'
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.starts_on desc,x.id desc),'[]'::jsonb) into v_allocations from(
    select a.id,a.bed_id,a.student_person_id,a.enrollment_id,a.starts_on,a.ends_on,a.state,a.eligibility_snapshot,a.vacate_clearance,a.created_at,
      p.display_name,sp.student_number,b.building_key,b.floor_key,b.room_key,b.bed_key,coalesce(nullif(btrim(h.labels->>'en'),''),'Hostel') hostel_label
    from public.hostel_allocations a
    join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id
    join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id and h.branch_id=p_branch_id
    join public.persons p on p.tenant_id=a.tenant_id and p.id=a.student_person_id
    join public.student_profiles sp on sp.tenant_id=a.tenant_id and sp.person_id=a.student_person_id
    where a.tenant_id=p_tenant_id order by a.starts_on desc,a.id desc limit 100
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.display_name,x.person_id),'[]'::jsonb) into v_students from(
    select distinct on(e.student_person_id) e.student_person_id person_id,e.id enrollment_id,p.display_name,sp.student_number,e.session_id,e.group_id,e.starts_on
    from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status in('active','paused') and sp.status in('active','admitted')
    order by e.student_person_id,e.starts_on desc,e.id desc
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.display_name,x.person_id),'[]'::jsonb) into v_employees from(
    select distinct he.employee_person_id person_id,p.display_name,he.employee_number,he.designation_key
    from public.hr_employments he join public.persons p on p.tenant_id=he.tenant_id and p.id=he.employee_person_id
    where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.state in('active','on_leave') and p.status='active'
  )x;

  return jsonb_build_object('hostels',v_hostels,'beds',v_beds,'allocations',v_allocations,'students',v_students,'employees',v_employees);
end;$fn$;

create or replace function public.create_hostel_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_key text,p_labels jsonb,p_warden_person_id bigint
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_key text:=lower(btrim(coalesce(p_key,'')));v_id bigint;begin
  v_membership:=public.resolve_hostel_resident_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if v_key !~ '^[a-z0-9][a-z0-9_-]{1,63}$' then raise exception 'valid hostel key required';end if;
  if p_labels is null or jsonb_typeof(p_labels)<>'object' or nullif(btrim(coalesce(p_labels->>'en','')),'') is null then raise exception 'English hostel label required';end if;
  if p_warden_person_id is not null and not exists(select 1 from public.hr_employments he where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.employee_person_id=p_warden_person_id and he.state in('active','on_leave')) then raise exception 'warden must be active staff in this branch';end if;
  insert into public.hostels(tenant_id,branch_id,key,labels,warden_person_id,rules,state)
  values(p_tenant_id,p_branch_id,v_key,p_labels,p_warden_person_id,'{}'::jsonb,'active') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.create','succeeded','hostel',v_id::text,gen_random_uuid(),jsonb_build_object('key',v_key,'warden_person_id',p_warden_person_id));
  return jsonb_build_object('hostel_id',v_id,'state','active');
end;$fn$;

create or replace function public.add_hostel_bed_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_hostel_id bigint,p_building_key text,p_floor_key text,p_room_key text,p_bed_key text,p_category text
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_building text:=lower(btrim(coalesce(p_building_key,'')));v_room text:=lower(btrim(coalesce(p_room_key,'')));v_bed text:=lower(btrim(coalesce(p_bed_key,'')));begin
  v_membership:=public.resolve_hostel_resident_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if not exists(select 1 from public.hostels h where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id and h.id=p_hostel_id and h.state='active') then raise exception 'active hostel in this branch required';end if;
  if v_building !~ '^[a-z0-9][a-z0-9_-]{0,63}$' or v_room !~ '^[a-z0-9][a-z0-9_-]{0,63}$' or v_bed !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then raise exception 'valid building, room and bed keys required';end if;
  insert into public.hostel_beds(tenant_id,hostel_id,building_key,floor_key,room_key,bed_key,category,fee_item_id,state)
  values(p_tenant_id,p_hostel_id,v_building,nullif(lower(btrim(coalesce(p_floor_key,''))),''),v_room,v_bed,nullif(btrim(coalesce(p_category,'')),''),null,'available') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.bed.add','succeeded','hostel_bed',v_id::text,gen_random_uuid(),jsonb_build_object('hostel_id',p_hostel_id,'building_key',v_building,'room_key',v_room,'bed_key',v_bed,'fee_item_id',null));
  return jsonb_build_object('bed_id',v_id,'state','available','fee_item_id',null);
end;$fn$;

create or replace function public.allocate_hostel_bed_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_bed_id bigint,p_starts_on date,p_ends_on date
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_enrollment public.enrollments%rowtype;v_bed public.hostel_beds%rowtype;v_hostel public.hostels%rowtype;v_id bigint;begin
  v_membership:=public.resolve_hostel_resident_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on<p_starts_on) then raise exception 'valid allocation dates required';end if;
  select e.* into v_enrollment from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status in('active','paused') order by e.starts_on desc,e.id desc limit 1;
  if v_enrollment.id is null then raise exception 'active student enrollment in this branch required';end if;
  select b.* into v_bed from public.hostel_beds b join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where b.tenant_id=p_tenant_id and b.id=p_bed_id and h.branch_id=p_branch_id and h.state='active' for update of b;
  if v_bed.id is null then raise exception 'hostel bed not found in branch';end if;
  if v_bed.state<>'available' then raise exception 'hostel bed is not available';end if;
  select h.* into v_hostel from public.hostels h where h.tenant_id=p_tenant_id and h.id=v_bed.hostel_id;
  if exists(select 1 from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and h.branch_id=p_branch_id and a.state in('allocated','occupied','temporary_leave')) then raise exception 'student already has an open hostel allocation';end if;
  insert into public.hostel_allocations(tenant_id,bed_id,student_person_id,enrollment_id,starts_on,ends_on,state,eligibility_snapshot,vacate_clearance)
  values(p_tenant_id,p_bed_id,p_student_person_id,v_enrollment.id,p_starts_on,p_ends_on,'occupied',jsonb_build_object('branch_id',p_branch_id,'enrollment_id',v_enrollment.id,'enrollment_status',v_enrollment.status,'hostel_id',v_hostel.id,'fee_item_id',v_bed.fee_item_id),null) returning id into v_id;
  update public.hostel_beds set state='occupied' where tenant_id=p_tenant_id and id=p_bed_id;
  insert into public.hostel_allocation_events(tenant_id,allocation_id,event_type,from_state,to_state,reason)
  values(p_tenant_id,v_id,'allocated',null,jsonb_build_object('state','occupied','bed_id',p_bed_id,'starts_on',p_starts_on,'ends_on',p_ends_on),'governed allocation');
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.allocation.create','succeeded','hostel_allocation',v_id::text,gen_random_uuid(),jsonb_build_object('student_person_id',p_student_person_id,'bed_id',p_bed_id,'starts_on',p_starts_on,'ends_on',p_ends_on,'state','occupied','financial_clearance','deferred'));
  return jsonb_build_object('allocation_id',v_id,'state','occupied','bed_id',p_bed_id,'fee_assignment_id',null);
end;$fn$;

create or replace function public.vacate_hostel_allocation_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_allocation_id bigint,p_ends_on date,p_reason text
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_allocation public.hostel_allocations%rowtype;v_end date;v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');begin
  v_membership:=public.resolve_hostel_resident_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  select a.* into v_allocation from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where a.tenant_id=p_tenant_id and a.id=p_allocation_id and h.branch_id=p_branch_id for update of a;
  if v_allocation.id is null then raise exception 'hostel allocation not found in branch';end if;
  if v_allocation.state not in('allocated','occupied','temporary_leave') then raise exception 'hostel allocation is already closed';end if;
  v_end:=coalesce(p_ends_on,current_date);
  if v_end<v_allocation.starts_on then raise exception 'vacate date cannot be before allocation start';end if;
  update public.hostel_allocations set ends_on=v_end,state='vacated',vacate_clearance=jsonb_build_object('bed_released',true,'financial_clearance','deferred','reason',v_reason) where tenant_id=p_tenant_id and id=p_allocation_id;
  update public.hostel_beds set state='available' where tenant_id=p_tenant_id and id=v_allocation.bed_id;
  insert into public.hostel_allocation_events(tenant_id,allocation_id,event_type,from_state,to_state,reason)
  values(p_tenant_id,p_allocation_id,'vacated',jsonb_build_object('state',v_allocation.state,'bed_id',v_allocation.bed_id),jsonb_build_object('state','vacated','bed_id',v_allocation.bed_id,'ends_on',v_end),v_reason);
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.allocation.vacate','succeeded','hostel_allocation',p_allocation_id::text,gen_random_uuid(),jsonb_build_object('bed_id',v_allocation.bed_id,'ends_on',v_end,'state','vacated','financial_clearance','deferred'));
  return jsonb_build_object('allocation_id',p_allocation_id,'state','vacated','bed_id',v_allocation.bed_id,'financial_clearance','deferred');
end;$fn$;

revoke all on function public.resolve_hostel_resident_membership_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.get_hostel_resident_center_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.create_hostel_v1(uuid,bigint,bigint,text,jsonb,bigint) from public,anon,authenticated;
revoke all on function public.add_hostel_bed_v1(uuid,bigint,bigint,bigint,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.allocate_hostel_bed_v1(uuid,bigint,bigint,bigint,bigint,date,date) from public,anon,authenticated;
revoke all on function public.vacate_hostel_allocation_v1(uuid,bigint,bigint,bigint,date,text) from public,anon,authenticated;
grant execute on function public.resolve_hostel_resident_membership_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.get_hostel_resident_center_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.create_hostel_v1(uuid,bigint,bigint,text,jsonb,bigint) to service_role;
grant execute on function public.add_hostel_bed_v1(uuid,bigint,bigint,bigint,text,text,text,text,text) to service_role;
grant execute on function public.allocate_hostel_bed_v1(uuid,bigint,bigint,bigint,bigint,date,date) to service_role;
grant execute on function public.vacate_hostel_allocation_v1(uuid,bigint,bigint,bigint,date,text) to service_role;
