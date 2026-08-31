create or replace function public.resolve_transport_operator_membership_v1(
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
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='transport.route.manage'
    )
  order by m.created_at limit 1;
  return v_membership;
end;$fn$;

create or replace function public.get_transport_center_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint
) returns jsonb
language plpgsql stable set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_vehicles jsonb;v_routes jsonb;v_stops jsonb;v_assignments jsonb;v_students jsonb;v_employees jsonb;begin
  v_membership:=public.resolve_transport_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'transport operations permission denied';end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required';end if;

  select coalesce(jsonb_agg(row_to_json(x) order by x.registration_number,x.id),'[]'::jsonb) into v_vehicles from(
    select v.id,v.registration_number,v.ownership,v.capacity,v.driver_person_id,v.helper_person_id,v.state,
      dp.display_name driver_name,hp.display_name helper_name,
      (select count(*)::int from public.transport_assignments a join public.transport_routes r on r.tenant_id=a.tenant_id and r.id=a.route_id where a.tenant_id=v.tenant_id and r.vehicle_id=v.id and r.branch_id=p_branch_id and a.state in('planned','active') and (a.ends_on is null or a.ends_on>=current_date)) assigned_count
    from public.transport_vehicles v
    left join public.persons dp on dp.tenant_id=v.tenant_id and dp.id=v.driver_person_id
    left join public.persons hp on hp.tenant_id=v.tenant_id and hp.id=v.helper_person_id
    where v.tenant_id=p_tenant_id and v.branch_id=p_branch_id and v.state<>'archived'
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.effective_from desc,x.key,x.id),'[]'::jsonb) into v_routes from(
    select r.id,r.vehicle_id,r.key,r.labels,r.effective_from,r.effective_to,r.state,v.registration_number,v.capacity,
      (select count(*)::int from public.transport_stops s where s.tenant_id=r.tenant_id and s.route_id=r.id) stop_count,
      (select count(*)::int from public.transport_assignments a where a.tenant_id=r.tenant_id and a.route_id=r.id and a.state in('planned','active') and (a.ends_on is null or a.ends_on>=current_date)) assigned_count
    from public.transport_routes r join public.transport_vehicles v on v.tenant_id=r.tenant_id and v.id=r.vehicle_id
    where r.tenant_id=p_tenant_id and r.branch_id=p_branch_id and r.state<>'archived'
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.route_id,x.sequence,x.id),'[]'::jsonb) into v_stops from(
    select s.id,s.route_id,s.key,s.labels,s.sequence,s.pickup_time,s.drop_time,
      (select count(*)::int from public.transport_assignments a where a.tenant_id=s.tenant_id and a.stop_id=s.id and a.state in('planned','active') and (a.ends_on is null or a.ends_on>=current_date)) assigned_count
    from public.transport_stops s join public.transport_routes r on r.tenant_id=s.tenant_id and r.id=s.route_id
    where s.tenant_id=p_tenant_id and r.branch_id=p_branch_id and r.state<>'archived'
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.starts_on desc,x.id desc),'[]'::jsonb) into v_assignments from(
    select a.id,a.student_person_id,a.enrollment_id,a.route_id,a.stop_id,a.starts_on,a.ends_on,a.state,
      p.display_name,sp.student_number,r.labels route_labels,s.labels stop_labels,v.registration_number
    from public.transport_assignments a
    join public.enrollments e on e.tenant_id=a.tenant_id and e.id=a.enrollment_id
    join public.persons p on p.tenant_id=a.tenant_id and p.id=a.student_person_id
    join public.student_profiles sp on sp.tenant_id=a.tenant_id and sp.person_id=a.student_person_id
    join public.transport_routes r on r.tenant_id=a.tenant_id and r.id=a.route_id and r.branch_id=p_branch_id
    join public.transport_stops s on s.tenant_id=a.tenant_id and s.id=a.stop_id
    join public.transport_vehicles v on v.tenant_id=a.tenant_id and v.id=r.vehicle_id
    where a.tenant_id=p_tenant_id
    order by a.starts_on desc,a.id desc limit 100
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.display_name,x.person_id),'[]'::jsonb) into v_students from(
    select distinct on(e.student_person_id) e.student_person_id person_id,e.id enrollment_id,p.display_name,sp.student_number,e.session_id,e.group_id
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

  return jsonb_build_object('vehicles',v_vehicles,'routes',v_routes,'stops',v_stops,'assignments',v_assignments,'students',v_students,'employees',v_employees);
end;$fn$;

create or replace function public.create_transport_vehicle_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_registration_number text,p_ownership text,p_capacity integer,p_driver_person_id bigint,p_helper_person_id bigint
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_reg text:=upper(btrim(coalesce(p_registration_number,'')));v_ownership text:=lower(btrim(coalesce(p_ownership,'')));begin
  v_membership:=public.resolve_transport_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'transport operations permission denied';end if;
  if length(v_reg)<3 or length(v_reg)>32 then raise exception 'registration number must be 3 to 32 characters';end if;
  if v_ownership not in('owned','leased','contracted') then raise exception 'vehicle ownership must be owned, leased, or contracted';end if;
  if p_capacity is null or p_capacity<1 or p_capacity>200 then raise exception 'vehicle capacity must be between 1 and 200';end if;
  if p_driver_person_id is not null and not exists(select 1 from public.hr_employments he where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.employee_person_id=p_driver_person_id and he.state in('active','on_leave')) then raise exception 'driver must be active staff in this branch';end if;
  if p_helper_person_id is not null and not exists(select 1 from public.hr_employments he where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.employee_person_id=p_helper_person_id and he.state in('active','on_leave')) then raise exception 'helper must be active staff in this branch';end if;
  if p_driver_person_id is not null and p_driver_person_id=p_helper_person_id then raise exception 'driver and helper must be different people';end if;
  insert into public.transport_vehicles(tenant_id,branch_id,registration_number,ownership,capacity,driver_person_id,helper_person_id,state)
  values(p_tenant_id,p_branch_id,v_reg,v_ownership,p_capacity,p_driver_person_id,p_helper_person_id,'active') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'transport.vehicle.create','succeeded','transport_vehicle',v_id::text,gen_random_uuid(),jsonb_build_object('registration_number',v_reg,'ownership',v_ownership,'capacity',p_capacity));
  return jsonb_build_object('vehicle_id',v_id,'state','active','registration_number',v_reg);
end;$fn$;

create or replace function public.create_transport_route_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_vehicle_id bigint,p_key text,p_labels jsonb,p_effective_from date,p_effective_to date
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_key text:=lower(btrim(coalesce(p_key,'')));begin
  v_membership:=public.resolve_transport_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'transport operations permission denied';end if;
  if v_key !~ '^[a-z0-9][a-z0-9_-]{1,63}$' then raise exception 'valid route key required';end if;
  if p_labels is null or jsonb_typeof(p_labels)<>'object' or nullif(btrim(coalesce(p_labels->>'en','')),'') is null then raise exception 'English route label required';end if;
  if p_effective_from is null or (p_effective_to is not null and p_effective_to<p_effective_from) then raise exception 'valid route dates required';end if;
  if not exists(select 1 from public.transport_vehicles v where v.tenant_id=p_tenant_id and v.branch_id=p_branch_id and v.id=p_vehicle_id and v.state='active') then raise exception 'active vehicle in this branch required';end if;
  insert into public.transport_routes(tenant_id,branch_id,vehicle_id,key,labels,effective_from,effective_to,state)
  values(p_tenant_id,p_branch_id,p_vehicle_id,v_key,p_labels,p_effective_from,p_effective_to,'active') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'transport.route.create','succeeded','transport_route',v_id::text,gen_random_uuid(),jsonb_build_object('vehicle_id',p_vehicle_id,'key',v_key,'effective_from',p_effective_from,'effective_to',p_effective_to));
  return jsonb_build_object('route_id',v_id,'state','active');
end;$fn$;

create or replace function public.add_transport_stop_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_route_id bigint,p_key text,p_labels jsonb,p_sequence integer,p_pickup_time time,p_drop_time time
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_key text:=lower(btrim(coalesce(p_key,'')));begin
  v_membership:=public.resolve_transport_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'transport operations permission denied';end if;
  if v_key !~ '^[a-z0-9][a-z0-9_-]{1,63}$' then raise exception 'valid stop key required';end if;
  if p_labels is null or jsonb_typeof(p_labels)<>'object' or nullif(btrim(coalesce(p_labels->>'en','')),'') is null then raise exception 'English stop label required';end if;
  if p_sequence is null or p_sequence<0 or p_sequence>500 then raise exception 'stop sequence must be between 0 and 500';end if;
  if not exists(select 1 from public.transport_routes r where r.tenant_id=p_tenant_id and r.branch_id=p_branch_id and r.id=p_route_id and r.state='active') then raise exception 'active route in this branch required';end if;
  if exists(select 1 from public.transport_stops s where s.tenant_id=p_tenant_id and s.route_id=p_route_id and s.sequence=p_sequence) then raise exception 'stop sequence is already used on this route';end if;
  insert into public.transport_stops(tenant_id,route_id,key,labels,sequence,pickup_time,drop_time,fee_item_id)
  values(p_tenant_id,p_route_id,v_key,p_labels,p_sequence,p_pickup_time,p_drop_time,null) returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'transport.stop.create','succeeded','transport_stop',v_id::text,gen_random_uuid(),jsonb_build_object('route_id',p_route_id,'key',v_key,'sequence',p_sequence));
  return jsonb_build_object('stop_id',v_id,'route_id',p_route_id,'sequence',p_sequence);
end;$fn$;

create or replace function public.assign_student_transport_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_route_id bigint,p_stop_id bigint,p_starts_on date,p_ends_on date
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_enrollment public.enrollments%rowtype;v_route public.transport_routes%rowtype;v_vehicle public.transport_vehicles%rowtype;v_id bigint;v_state text;v_assigned integer;begin
  v_membership:=public.resolve_transport_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'transport operations permission denied';end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on<p_starts_on) then raise exception 'valid assignment dates required';end if;
  select e.* into v_enrollment from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status in('active','paused') order by e.starts_on desc,e.id desc limit 1;
  if v_enrollment.id is null then raise exception 'active student enrollment in this branch required';end if;
  select r.* into v_route from public.transport_routes r where r.tenant_id=p_tenant_id and r.branch_id=p_branch_id and r.id=p_route_id and r.state='active';
  if v_route.id is null then raise exception 'active route in this branch required';end if;
  if not exists(select 1 from public.transport_stops s where s.tenant_id=p_tenant_id and s.route_id=p_route_id and s.id=p_stop_id) then raise exception 'stop must belong to the selected route';end if;
  if p_starts_on<v_route.effective_from or (v_route.effective_to is not null and p_starts_on>v_route.effective_to) or (p_ends_on is not null and v_route.effective_to is not null and p_ends_on>v_route.effective_to) then raise exception 'assignment dates must fit within route effective dates';end if;
  if exists(select 1 from public.transport_assignments a where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and a.state in('planned','active','paused') and daterange(a.starts_on,coalesce(a.ends_on,'infinity'::date),'[]') && daterange(p_starts_on,coalesce(p_ends_on,'infinity'::date),'[]')) then raise exception 'student already has an overlapping transport assignment';end if;
  select v.* into v_vehicle from public.transport_vehicles v where v.tenant_id=p_tenant_id and v.id=v_route.vehicle_id and v.branch_id=p_branch_id and v.state='active';
  if v_vehicle.id is null then raise exception 'route vehicle is unavailable';end if;
  perform pg_advisory_xact_lock(hashtextextended('transport-route:'||p_tenant_id::text||':'||p_route_id::text,0));
  select count(*)::int into v_assigned from public.transport_assignments a where a.tenant_id=p_tenant_id and a.route_id=p_route_id and a.state in('planned','active','paused') and daterange(a.starts_on,coalesce(a.ends_on,'infinity'::date),'[]') && daterange(p_starts_on,coalesce(p_ends_on,'infinity'::date),'[]');
  if v_assigned>=v_vehicle.capacity then raise exception 'route vehicle capacity reached';end if;
  v_state:=case when p_starts_on>current_date then 'planned' else 'active' end;
  insert into public.transport_assignments(tenant_id,enrollment_id,student_person_id,route_id,stop_id,starts_on,ends_on,state,fee_assignment_id,approved_by_membership_id)
  values(p_tenant_id,v_enrollment.id,p_student_person_id,p_route_id,p_stop_id,p_starts_on,p_ends_on,v_state,null,v_membership) returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'transport.assignment.create','succeeded','transport_assignment',v_id::text,gen_random_uuid(),jsonb_build_object('student_person_id',p_student_person_id,'route_id',p_route_id,'stop_id',p_stop_id,'starts_on',p_starts_on,'ends_on',p_ends_on,'state',v_state));
  return jsonb_build_object('assignment_id',v_id,'state',v_state,'fee_assignment_id',null);
end;$fn$;

create or replace function public.end_student_transport_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_assignment_id bigint,p_ends_on date
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_assignment public.transport_assignments%rowtype;v_end date;begin
  v_membership:=public.resolve_transport_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'transport operations permission denied';end if;
  select a.* into v_assignment from public.transport_assignments a join public.transport_routes r on r.tenant_id=a.tenant_id and r.id=a.route_id where a.tenant_id=p_tenant_id and a.id=p_assignment_id and r.branch_id=p_branch_id for update of a;
  if v_assignment.id is null then raise exception 'transport assignment not found in branch';end if;
  if v_assignment.state not in('planned','active','paused') then raise exception 'transport assignment is already closed';end if;
  v_end:=coalesce(p_ends_on,current_date);
  if v_end<v_assignment.starts_on then raise exception 'end date cannot be before assignment start';end if;
  update public.transport_assignments set ends_on=v_end,state='ended' where tenant_id=p_tenant_id and id=p_assignment_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'transport.assignment.end','succeeded','transport_assignment',p_assignment_id::text,gen_random_uuid(),jsonb_build_object('ends_on',v_end,'state','ended'));
  return jsonb_build_object('assignment_id',p_assignment_id,'state','ended','ends_on',v_end);
end;$fn$;

revoke all on function public.resolve_transport_operator_membership_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.get_transport_center_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.create_transport_vehicle_v1(uuid,bigint,bigint,text,text,integer,bigint,bigint) from public,anon,authenticated;
revoke all on function public.create_transport_route_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date) from public,anon,authenticated;
revoke all on function public.add_transport_stop_v1(uuid,bigint,bigint,bigint,text,jsonb,integer,time,time) from public,anon,authenticated;
revoke all on function public.assign_student_transport_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,date) from public,anon,authenticated;
revoke all on function public.end_student_transport_v1(uuid,bigint,bigint,bigint,date) from public,anon,authenticated;
grant execute on function public.resolve_transport_operator_membership_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.get_transport_center_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.create_transport_vehicle_v1(uuid,bigint,bigint,text,text,integer,bigint,bigint) to service_role;
grant execute on function public.create_transport_route_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date) to service_role;
grant execute on function public.add_transport_stop_v1(uuid,bigint,bigint,bigint,text,jsonb,integer,time,time) to service_role;
grant execute on function public.assign_student_transport_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,date) to service_role;
grant execute on function public.end_student_transport_v1(uuid,bigint,bigint,bigint,date) to service_role;
