create or replace function public.resolve_hostel_permission_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_permission text
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
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code=p_permission
    )
  order by m.created_at limit 1;
  return v_membership;
end;$fn$;

create or replace function public.get_hostel_mess_center_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint
) returns jsonb
language plpgsql stable set search_path to pg_catalog,extensions
as $fn$
declare
  v_resident bigint;v_security bigint;v_mess bigint;
  v_hostels jsonb:='[]'::jsonb;v_beds jsonb:='[]'::jsonb;v_allocations jsonb:='[]'::jsonb;v_students jsonb:='[]'::jsonb;
  v_visitors jsonb:='[]'::jsonb;v_incidents jsonb:='[]'::jsonb;
  v_units jsonb:='[]'::jsonb;v_services jsonb:='[]'::jsonb;v_meals jsonb:='[]'::jsonb;v_people jsonb:='[]'::jsonb;
begin
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required';end if;
  v_resident:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.resident.manage');
  v_security:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.security.manage');
  v_mess:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'mess.service.manage');
  if v_resident is null and v_security is null and v_mess is null then raise exception 'hostel and mess permission denied';end if;

  if v_resident is not null then
    select coalesce(jsonb_agg(row_to_json(x) order by x.label,x.id),'[]'::jsonb) into v_hostels from(
      select h.id,h.key,h.labels,coalesce(nullif(btrim(h.labels->>'en'),''),h.key) label,h.warden_person_id,p.display_name warden_name,h.state,
        (select count(*)::int from public.hostel_beds b where b.tenant_id=h.tenant_id and b.hostel_id=h.id) bed_count,
        (select count(*)::int from public.hostel_beds b where b.tenant_id=h.tenant_id and b.hostel_id=h.id and b.state='available') available_count
      from public.hostels h left join public.persons p on p.tenant_id=h.tenant_id and p.id=h.warden_person_id
      where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id and h.state<>'archived'
    )x;
    select coalesce(jsonb_agg(row_to_json(x) order by x.hostel_id,x.building_key,x.room_key,x.bed_key,x.id),'[]'::jsonb) into v_beds from(
      select b.id,b.hostel_id,b.building_key,b.floor_key,b.room_key,b.bed_key,b.category,b.state,
        coalesce(nullif(btrim(h.labels->>'en'),''),h.key) hostel_label
      from public.hostel_beds b join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id and h.branch_id=p_branch_id
      where b.tenant_id=p_tenant_id and b.state<>'inactive'
    )x;
    select coalesce(jsonb_agg(row_to_json(x) order by x.starts_on desc,x.id desc),'[]'::jsonb) into v_allocations from(
      select a.id,a.bed_id,a.student_person_id,a.enrollment_id,a.starts_on,a.ends_on,a.state,a.eligibility_snapshot,a.vacate_clearance,
        p.display_name,sp.student_number,b.building_key,b.room_key,b.bed_key,coalesce(nullif(btrim(h.labels->>'en'),''),h.key) hostel_label
      from public.hostel_allocations a
      join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id
      join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id and h.branch_id=p_branch_id
      join public.persons p on p.tenant_id=a.tenant_id and p.id=a.student_person_id
      join public.student_profiles sp on sp.tenant_id=a.tenant_id and sp.person_id=a.student_person_id
      where a.tenant_id=p_tenant_id order by a.starts_on desc,a.id desc limit 100
    )x;
    select coalesce(jsonb_agg(row_to_json(x) order by x.display_name,x.person_id),'[]'::jsonb) into v_students from(
      select distinct on(e.student_person_id) e.student_person_id person_id,e.id enrollment_id,p.display_name,sp.student_number,e.session_id,e.group_id
      from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
      join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status in('active','paused') and sp.status in('active','admitted')
      order by e.student_person_id,e.starts_on desc,e.id desc
    )x;
  end if;

  if v_security is not null then
    select coalesce(jsonb_agg(row_to_json(x) order by x.checked_in_at desc,x.id desc),'[]'::jsonb) into v_visitors from(
      select v.id,v.allocation_id,v.visitor_identity_snapshot,v.purpose,v.restriction_flags,v.checked_in_at,v.checked_out_at,
        p.display_name resident_name,b.room_key,b.bed_key
      from public.hostel_visitors v join public.hostel_allocations a on a.tenant_id=v.tenant_id and a.id=v.allocation_id
      join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id
      join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id and h.branch_id=p_branch_id
      join public.persons p on p.tenant_id=a.tenant_id and p.id=a.student_person_id
      where v.tenant_id=p_tenant_id order by v.checked_in_at desc,v.id desc limit 100
    )x;
    select coalesce(jsonb_agg(row_to_json(x) order by x.occurred_at desc,x.id desc),'[]'::jsonb) into v_incidents from(
      select i.id,i.allocation_id,i.category,i.severity,i.action_summary,i.state,i.occurred_at,
        p.display_name resident_name
      from public.hostel_incidents i
      left join public.hostel_allocations a on a.tenant_id=i.tenant_id and a.id=i.allocation_id
      left join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id
      left join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id
      left join public.persons p on p.tenant_id=a.tenant_id and p.id=a.student_person_id
      where i.tenant_id=p_tenant_id and (i.allocation_id is null or h.branch_id=p_branch_id)
      order by i.occurred_at desc,i.id desc limit 100
    )x;
  end if;

  if v_mess is not null then
    select coalesce(jsonb_agg(row_to_json(x) order by x.label,x.id),'[]'::jsonb) into v_units from(
      select u.id,u.key,u.labels,coalesce(nullif(btrim(u.labels->>'en'),''),u.key) label,u.state
      from public.mess_units u where u.tenant_id=p_tenant_id and u.branch_id=p_branch_id and u.state<>'archived'
    )x;
    select coalesce(jsonb_agg(row_to_json(x) order by x.serving_date desc,x.id desc),'[]'::jsonb) into v_services from(
      select s.id,s.mess_unit_id,s.meal_type,s.serving_date,s.expected_count,s.state,coalesce(nullif(btrim(u.labels->>'en'),''),u.key) unit_label,
        (select coalesce(sum(a.served_count),0)::int from public.mess_attendance a where a.tenant_id=s.tenant_id and a.meal_service_id=s.id) served_count
      from public.mess_meal_services s join public.mess_units u on u.tenant_id=s.tenant_id and u.id=s.mess_unit_id and u.branch_id=p_branch_id
      where s.tenant_id=p_tenant_id order by s.serving_date desc,s.id desc limit 100
    )x;
    select coalesce(jsonb_agg(row_to_json(x) order by x.id desc),'[]'::jsonb) into v_meals from(
      select a.id,a.meal_service_id,a.person_id,a.guest_key,a.served_count,p.display_name,s.meal_type,s.serving_date
      from public.mess_attendance a join public.mess_meal_services s on s.tenant_id=a.tenant_id and s.id=a.meal_service_id
      join public.mess_units u on u.tenant_id=s.tenant_id and u.id=s.mess_unit_id and u.branch_id=p_branch_id
      left join public.persons p on p.tenant_id=a.tenant_id and p.id=a.person_id
      where a.tenant_id=p_tenant_id order by a.id desc limit 100
    )x;
    select coalesce(jsonb_agg(row_to_json(x) order by x.display_name,x.person_id),'[]'::jsonb) into v_people from(
      select distinct p.id person_id,p.display_name,
        case when exists(select 1 from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where a.tenant_id=p.tenant_id and a.student_person_id=p.id and h.branch_id=p_branch_id and a.state in('allocated','occupied','temporary_leave')) then 'resident' else 'staff' end person_type
      from public.persons p
      where p.tenant_id=p_tenant_id and p.status='active' and (
        exists(select 1 from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where a.tenant_id=p.tenant_id and a.student_person_id=p.id and h.branch_id=p_branch_id and a.state in('allocated','occupied','temporary_leave'))
        or exists(select 1 from public.hr_employments he where he.tenant_id=p.tenant_id and he.employee_person_id=p.id and he.branch_id=p_branch_id and he.state in('active','on_leave'))
      )
    )x;
  end if;

  return jsonb_build_object(
    'permissions',jsonb_build_object('resident',v_resident is not null,'security',v_security is not null,'mess',v_mess is not null),
    'hostels',v_hostels,'beds',v_beds,'allocations',v_allocations,'students',v_students,
    'visitors',v_visitors,'incidents',v_incidents,'mess_units',v_units,'meal_services',v_services,'meal_attendance',v_meals,'meal_people',v_people
  );
end;$fn$;

create or replace function public.create_hostel_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_key text,p_labels jsonb,p_warden_person_id bigint,p_rules jsonb
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_key text:=lower(btrim(coalesce(p_key,'')));begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.resident.manage');
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if v_key !~ '^[a-z0-9][a-z0-9_-]{1,63}$' then raise exception 'valid hostel key required';end if;
  if p_labels is null or jsonb_typeof(p_labels)<>'object' or nullif(btrim(coalesce(p_labels->>'en','')),'') is null then raise exception 'English hostel label required';end if;
  if p_rules is null or jsonb_typeof(p_rules)<>'object' or length(p_rules::text)>8192 then raise exception 'hostel rules must be a JSON object';end if;
  if p_warden_person_id is not null and not exists(select 1 from public.hr_employments he where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.employee_person_id=p_warden_person_id and he.state in('active','on_leave')) then raise exception 'warden must be active staff in this branch';end if;
  insert into public.hostels(tenant_id,branch_id,key,labels,warden_person_id,rules,state)
  values(p_tenant_id,p_branch_id,v_key,p_labels,p_warden_person_id,p_rules,'active') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.create','succeeded','hostel',v_id::text,gen_random_uuid(),jsonb_build_object('key',v_key,'labels',p_labels));
  return jsonb_build_object('hostel_id',v_id,'state','active');
end;$fn$;

create or replace function public.add_hostel_bed_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_hostel_id bigint,p_building_key text,p_floor_key text,p_room_key text,p_bed_key text,p_category text
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.resident.manage');
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if not exists(select 1 from public.hostels h where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id and h.id=p_hostel_id and h.state='active') then raise exception 'active hostel in this branch required';end if;
  if nullif(btrim(coalesce(p_building_key,'')),'') is null or nullif(btrim(coalesce(p_room_key,'')),'') is null or nullif(btrim(coalesce(p_bed_key,'')),'') is null then raise exception 'building, room and bed keys are required';end if;
  insert into public.hostel_beds(tenant_id,hostel_id,building_key,floor_key,room_key,bed_key,category,fee_item_id,state)
  values(p_tenant_id,p_hostel_id,left(btrim(p_building_key),64),nullif(left(btrim(coalesce(p_floor_key,'')),64),''),left(btrim(p_room_key),64),left(btrim(p_bed_key),64),nullif(left(btrim(coalesce(p_category,'')),64),''),null,'available') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.bed.add','succeeded','hostel_bed',v_id::text,gen_random_uuid(),jsonb_build_object('hostel_id',p_hostel_id,'room_key',p_room_key,'bed_key',p_bed_key));
  return jsonb_build_object('bed_id',v_id,'state','available');
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
  if exists(select 1 from public.hostel_allocations a where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and a.state in('allocated','occupied','temporary_leave') and daterange(a.starts_on,coalesce(a.ends_on,'infinity'::date),'[]') && daterange(p_starts_on,coalesce(p_ends_on,'infinity'::date),'[]')) then raise exception 'student already has an overlapping hostel allocation';end if;
  insert into public.hostel_allocations(tenant_id,bed_id,student_person_id,enrollment_id,starts_on,ends_on,state,eligibility_snapshot,vacate_clearance)
  values(p_tenant_id,p_bed_id,p_student_person_id,v_enrollment.id,p_starts_on,p_ends_on,'occupied',jsonb_build_object('enrollment_id',v_enrollment.id,'session_id',v_enrollment.session_id,'program_id',v_enrollment.program_id,'group_id',v_enrollment.group_id,'branch_id',p_branch_id),null) returning id into v_id;
  update public.hostel_beds set state='occupied' where tenant_id=p_tenant_id and id=p_bed_id;
  insert into public.hostel_allocation_events(tenant_id,allocation_id,event_type,from_state,to_state,reason,occurred_at)
  values(p_tenant_id,v_id,'allocated',null,jsonb_build_object('state','occupied','bed_id',p_bed_id),'operator allocation',now());
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.allocation.create','succeeded','hostel_allocation',v_id::text,gen_random_uuid(),jsonb_build_object('student_person_id',p_student_person_id,'bed_id',p_bed_id,'starts_on',p_starts_on,'ends_on',p_ends_on));
  return jsonb_build_object('allocation_id',v_id,'state','occupied');
end;$fn$;

create or replace function public.vacate_hostel_allocation_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_allocation_id bigint,p_ends_on date,p_clearance jsonb
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_allocation public.hostel_allocations%rowtype;begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.resident.manage');
  if v_membership is null then raise exception 'hostel resident permission denied';end if;
  if p_clearance is null or jsonb_typeof(p_clearance)<>'object' or length(p_clearance::text)>8192 then raise exception 'vacate clearance must be a JSON object';end if;
  select a.* into v_allocation from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id
  where a.tenant_id=p_tenant_id and a.id=p_allocation_id and h.branch_id=p_branch_id for update of a;
  if v_allocation.id is null then raise exception 'hostel allocation not found in branch';end if;
  if v_allocation.state not in('allocated','occupied','temporary_leave') then raise exception 'hostel allocation is already closed';end if;
  if p_ends_on is null or p_ends_on<v_allocation.starts_on then raise exception 'valid vacate date required';end if;
  update public.hostel_allocations set state='vacated',ends_on=p_ends_on,vacate_clearance=p_clearance where tenant_id=p_tenant_id and id=p_allocation_id;
  update public.hostel_beds set state='available' where tenant_id=p_tenant_id and id=v_allocation.bed_id;
  insert into public.hostel_allocation_events(tenant_id,allocation_id,event_type,from_state,to_state,reason,occurred_at)
  values(p_tenant_id,p_allocation_id,'vacated',jsonb_build_object('state',v_allocation.state),jsonb_build_object('state','vacated','ends_on',p_ends_on),'operator vacate',now());
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.allocation.vacate','succeeded','hostel_allocation',p_allocation_id::text,gen_random_uuid(),jsonb_build_object('state','vacated','ends_on',p_ends_on,'clearance',p_clearance));
  return jsonb_build_object('allocation_id',p_allocation_id,'state','vacated','bed_state','available');
end;$fn$;

create or replace function public.check_in_hostel_visitor_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_allocation_id bigint,p_visitor_snapshot jsonb,p_purpose text,p_restriction_flags jsonb
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.security.manage');
  if v_membership is null then raise exception 'hostel security permission denied';end if;
  if p_visitor_snapshot is null or jsonb_typeof(p_visitor_snapshot)<>'object' or p_visitor_snapshot='{}'::jsonb or length(p_visitor_snapshot::text)>4096 then raise exception 'visitor identity snapshot is required';end if;
  if nullif(btrim(coalesce(p_purpose,'')),'') is null then raise exception 'visitor purpose is required';end if;
  if p_restriction_flags is null or jsonb_typeof(p_restriction_flags)<>'object' then raise exception 'restriction flags must be a JSON object';end if;
  if not exists(select 1 from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where a.tenant_id=p_tenant_id and a.id=p_allocation_id and h.branch_id=p_branch_id and a.state in('allocated','occupied','temporary_leave')) then raise exception 'active resident allocation required';end if;
  insert into public.hostel_visitors(tenant_id,allocation_id,visitor_identity_snapshot,purpose,restriction_flags,checked_in_at,checked_out_at,host_approved_by_membership_id)
  values(p_tenant_id,p_allocation_id,p_visitor_snapshot,left(btrim(p_purpose),500),p_restriction_flags,now(),null,v_membership) returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.visitor.check_in','succeeded','hostel_visitor',v_id::text,gen_random_uuid(),jsonb_build_object('allocation_id',p_allocation_id,'purpose',left(btrim(p_purpose),500)));
  return jsonb_build_object('visitor_id',v_id,'state','checked_in');
end;$fn$;

create or replace function public.check_out_hostel_visitor_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_visitor_id bigint
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.security.manage');
  if v_membership is null then raise exception 'hostel security permission denied';end if;
  if not exists(select 1 from public.hostel_visitors v join public.hostel_allocations a on a.tenant_id=v.tenant_id and a.id=v.allocation_id join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where v.tenant_id=p_tenant_id and v.id=p_visitor_id and h.branch_id=p_branch_id and v.checked_out_at is null) then raise exception 'open hostel visitor record not found';end if;
  update public.hostel_visitors set checked_out_at=now() where tenant_id=p_tenant_id and id=p_visitor_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.visitor.check_out','succeeded','hostel_visitor',p_visitor_id::text,gen_random_uuid(),jsonb_build_object('checked_out',true));
  return jsonb_build_object('visitor_id',p_visitor_id,'state','checked_out');
end;$fn$;

create or replace function public.record_hostel_incident_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_allocation_id bigint,p_category text,p_severity text,p_restricted_details jsonb,p_action_summary jsonb
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_severity text:=lower(btrim(coalesce(p_severity,'')));begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hostel.security.manage');
  if v_membership is null then raise exception 'hostel security permission denied';end if;
  if nullif(btrim(coalesce(p_category,'')),'') is null then raise exception 'incident category is required';end if;
  if v_severity not in('low','medium','high','critical') then raise exception 'invalid incident severity';end if;
  if p_restricted_details is null or jsonb_typeof(p_restricted_details)<>'object' or length(p_restricted_details::text)>8192 then raise exception 'restricted incident details must be a JSON object';end if;
  if p_action_summary is null or jsonb_typeof(p_action_summary)<>'object' or length(p_action_summary::text)>8192 then raise exception 'incident action summary must be a JSON object';end if;
  if p_allocation_id is not null and not exists(select 1 from public.hostel_allocations a join public.hostel_beds b on b.tenant_id=a.tenant_id and b.id=a.bed_id join public.hostels h on h.tenant_id=b.tenant_id and h.id=b.hostel_id where a.tenant_id=p_tenant_id and a.id=p_allocation_id and h.branch_id=p_branch_id) then raise exception 'hostel allocation not found in branch';end if;
  insert into public.hostel_incidents(tenant_id,allocation_id,category,severity,restricted_details,action_summary,state,occurred_at)
  values(p_tenant_id,p_allocation_id,left(btrim(p_category),120),v_severity,p_restricted_details,p_action_summary,'open',now()) returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hostel.incident.record','succeeded','hostel_incident',v_id::text,gen_random_uuid(),jsonb_build_object('allocation_id',p_allocation_id,'category',left(btrim(p_category),120),'severity',v_severity));
  return jsonb_build_object('incident_id',v_id,'state','open','severity',v_severity);
end;$fn$;

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

create or replace function public.create_mess_meal_service_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_mess_unit_id bigint,p_meal_type text,p_serving_date date,p_expected_count integer
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_meal text:=lower(btrim(coalesce(p_meal_type,'')));v_state text;begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'mess.service.manage');
  if v_membership is null then raise exception 'mess service permission denied';end if;
  if v_meal not in('breakfast','lunch','dinner','suhoor','iftar','snack') then raise exception 'invalid meal type';end if;
  if p_serving_date is null then raise exception 'serving date is required';end if;
  if p_expected_count is not null and (p_expected_count<0 or p_expected_count>10000) then raise exception 'expected count is out of range';end if;
  if not exists(select 1 from public.mess_units u where u.tenant_id=p_tenant_id and u.branch_id=p_branch_id and u.id=p_mess_unit_id and u.state='active') then raise exception 'active mess unit in this branch required';end if;
  v_state:=case when p_serving_date<=current_date then 'open' else 'planned' end;
  insert into public.mess_meal_services(tenant_id,mess_unit_id,meal_type,serving_date,eligibility_rules,expected_count,state)
  values(p_tenant_id,p_mess_unit_id,v_meal,p_serving_date,jsonb_build_object('scope','active_hostel_residents_or_branch_staff'),p_expected_count,v_state) returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'mess.service.create','succeeded','mess_meal_service',v_id::text,gen_random_uuid(),jsonb_build_object('mess_unit_id',p_mess_unit_id,'meal_type',v_meal,'serving_date',p_serving_date,'state',v_state));
  return jsonb_build_object('meal_service_id',v_id,'state',v_state);
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

create or replace function public.close_mess_meal_service_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_meal_service_id bigint
) returns jsonb language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;begin
  v_membership:=public.resolve_hostel_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'mess.service.manage');
  if v_membership is null then raise exception 'mess service permission denied';end if;
  if not exists(select 1 from public.mess_meal_services s join public.mess_units u on u.tenant_id=s.tenant_id and u.id=s.mess_unit_id where s.tenant_id=p_tenant_id and s.id=p_meal_service_id and u.branch_id=p_branch_id and s.state in('planned','open')) then raise exception 'open or planned meal service not found in branch';end if;
  update public.mess_meal_services set state='closed' where tenant_id=p_tenant_id and id=p_meal_service_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'mess.service.close','succeeded','mess_meal_service',p_meal_service_id::text,gen_random_uuid(),jsonb_build_object('state','closed'));
  return jsonb_build_object('meal_service_id',p_meal_service_id,'state','closed');
end;$fn$;

revoke all on function public.resolve_hostel_permission_v1(uuid,bigint,bigint,text) from public,anon,authenticated;
revoke all on function public.get_hostel_mess_center_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.create_hostel_v1(uuid,bigint,bigint,text,jsonb,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.add_hostel_bed_v1(uuid,bigint,bigint,bigint,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.allocate_hostel_bed_v1(uuid,bigint,bigint,bigint,bigint,date,date) from public,anon,authenticated;
revoke all on function public.vacate_hostel_allocation_v1(uuid,bigint,bigint,bigint,date,jsonb) from public,anon,authenticated;
revoke all on function public.check_in_hostel_visitor_v1(uuid,bigint,bigint,bigint,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.check_out_hostel_visitor_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.record_hostel_incident_v1(uuid,bigint,bigint,bigint,text,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.create_mess_unit_v1(uuid,bigint,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.create_mess_meal_service_v1(uuid,bigint,bigint,bigint,text,date,integer) from public,anon,authenticated;
revoke all on function public.record_mess_attendance_v1(uuid,bigint,bigint,bigint,bigint,integer,text) from public,anon,authenticated;
revoke all on function public.close_mess_meal_service_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;

grant execute on function public.resolve_hostel_permission_v1(uuid,bigint,bigint,text) to service_role;
grant execute on function public.get_hostel_mess_center_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.create_hostel_v1(uuid,bigint,bigint,text,jsonb,bigint,jsonb) to service_role;
grant execute on function public.add_hostel_bed_v1(uuid,bigint,bigint,bigint,text,text,text,text,text) to service_role;
grant execute on function public.allocate_hostel_bed_v1(uuid,bigint,bigint,bigint,bigint,date,date) to service_role;
grant execute on function public.vacate_hostel_allocation_v1(uuid,bigint,bigint,bigint,date,jsonb) to service_role;
grant execute on function public.check_in_hostel_visitor_v1(uuid,bigint,bigint,bigint,jsonb,text,jsonb) to service_role;
grant execute on function public.check_out_hostel_visitor_v1(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.record_hostel_incident_v1(uuid,bigint,bigint,bigint,text,text,jsonb,jsonb) to service_role;
grant execute on function public.create_mess_unit_v1(uuid,bigint,bigint,text,jsonb) to service_role;
grant execute on function public.create_mess_meal_service_v1(uuid,bigint,bigint,bigint,text,date,integer) to service_role;
grant execute on function public.record_mess_attendance_v1(uuid,bigint,bigint,bigint,bigint,integer,text) to service_role;
grant execute on function public.close_mess_meal_service_v1(uuid,bigint,bigint,bigint) to service_role;
