create or replace function public.lock_student_daily_attendance(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_attendance_session_id bigint
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_state text;
  v_roster_id bigint;
  v_unmarked integer;
begin
  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='attendance.student.approve'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'student attendance approval permission denied'; end if;

  select s.state into v_state
  from public.attendance_sessions s
  where s.tenant_id=p_tenant_id and s.id=p_attendance_session_id and s.branch_id=p_branch_id and s.context_type='student_daily'
  for update;
  if v_state is null then raise exception 'attendance session is not available in the active branch'; end if;
  if v_state='locked' then return jsonb_build_object('locked',true,'unchanged',true,'session_id',p_attendance_session_id); end if;
  if v_state not in ('draft','open','submitted') then raise exception 'attendance session cannot be locked from its current state'; end if;

  select r.id into v_roster_id from public.attendance_rosters r
  where r.tenant_id=p_tenant_id and r.attendance_session_id=p_attendance_session_id and r.group_id is null
  order by r.id desc limit 1;
  if v_roster_id is null then raise exception 'attendance roster is missing'; end if;

  select count(*)::integer into v_unmarked
  from public.attendance_roster_members rm
  left join public.attendance_records ar on ar.tenant_id=rm.tenant_id and ar.attendance_session_id=p_attendance_session_id and ar.person_id=rm.person_id
  where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student' and ar.id is null;
  if v_unmarked>0 then raise exception 'all students must be marked before attendance can be locked'; end if;

  if exists(
    select 1 from public.attendance_corrections c
    join public.attendance_records ar on ar.tenant_id=c.tenant_id and ar.id=c.attendance_record_id
    where c.tenant_id=p_tenant_id and ar.attendance_session_id=p_attendance_session_id and c.state='pending'
  ) then raise exception 'pending attendance corrections must be reviewed before locking'; end if;

  update public.attendance_sessions
  set state='locked',
      locks_at=case when opens_at is null then clock_timestamp() else greatest(clock_timestamp(),opens_at+interval '1 microsecond') end,
      updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=p_attendance_session_id;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'attendance.student.lock','succeeded','attendance_session',p_attendance_session_id::text,gen_random_uuid(),
    jsonb_build_object('state',v_state),jsonb_build_object('state','locked','unmarked',0));

  return jsonb_build_object('locked',true,'unchanged',false,'session_id',p_attendance_session_id);
end;
$function$;
