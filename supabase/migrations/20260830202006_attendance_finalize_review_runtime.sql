create or replace function public.ensure_student_daily_attendance(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_attendance_date date
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_academic_session_id bigint;
  v_status_set_id bigint;
  v_session_id bigint;
  v_session_state text;
  v_roster_id bigint;
  v_member_count integer;
  v_created boolean := false;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_attendance_date is null then
    raise exception 'identity, tenant, branch, and attendance date are required';
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='attendance.student.mark'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'student attendance marking permission denied'; end if;

  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then
    raise exception 'active branch is required';
  end if;

  select s.id into v_academic_session_id
  from public.academic_sessions s
  where s.tenant_id=p_tenant_id and s.status='active' and p_attendance_date between s.starts_on and s.ends_on
  order by s.starts_on desc limit 1;
  if v_academic_session_id is null then raise exception 'no active academic session covers the attendance date'; end if;

  select ss.id into v_status_set_id
  from public.attendance_status_sets ss
  where ss.tenant_id=p_tenant_id and ss.subject_type='student' and ss.key='student_default' and ss.status in ('published','draft')
  order by (ss.status='published') desc,ss.version desc limit 1;
  if v_status_set_id is null then raise exception 'student attendance status configuration is missing'; end if;

  perform pg_advisory_xact_lock(hashtextextended(format('student_daily_attendance:%s:%s:%s',p_tenant_id,p_branch_id,p_attendance_date),0));

  select s.id,s.state into v_session_id,v_session_state
  from public.attendance_sessions s
  where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.context_type='student_daily'
    and s.context_key='branch_daily' and s.attendance_date=p_attendance_date and s.slot_id is null
  order by s.id desc limit 1;

  if v_session_id is null then
    insert into public.attendance_sessions(tenant_id,branch_id,academic_session_id,context_type,context_key,attendance_date,status_set_id,state,opens_at)
    values(p_tenant_id,p_branch_id,v_academic_session_id,'student_daily','branch_daily',p_attendance_date,v_status_set_id,'open',now())
    returning id,state into v_session_id,v_session_state;
    v_created := true;
  end if;

  select r.id,r.member_count into v_roster_id,v_member_count
  from public.attendance_rosters r
  where r.tenant_id=p_tenant_id and r.attendance_session_id=v_session_id and r.group_id is null
  order by r.id desc limit 1;

  if v_session_state not in ('draft','open') then
    return jsonb_build_object('session_id',v_session_id,'roster_id',v_roster_id,'member_count',coalesce(v_member_count,0),'created',false,'state',v_session_state,'refreshed',false);
  end if;

  if v_roster_id is null then
    insert into public.attendance_rosters(tenant_id,attendance_session_id,group_id,generated_from_version,member_count,generated_by_membership_id)
    values(p_tenant_id,v_session_id,null,'active-enrollment-snapshot-v1',0,v_membership_id)
    returning id into v_roster_id;
  end if;

  insert into public.attendance_roster_members(tenant_id,roster_id,subject_type,person_id,enrollment_id,snapshot)
  select p_tenant_id,v_roster_id,'student',e.student_person_id,e.id,
    jsonb_build_object('student_number',sp.student_number,'name',p.display_name,'group_id',e.group_id,'program_id',e.program_id,'session_id',e.session_id)
  from public.enrollments e
  join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in ('active','admitted')
  join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.session_id=v_academic_session_id and e.status='active'
  on conflict (tenant_id,roster_id,person_id) do nothing;

  select count(*)::integer into v_member_count
  from public.attendance_roster_members rm
  where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student';
  update public.attendance_rosters set member_count=v_member_count where tenant_id=p_tenant_id and id=v_roster_id;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,
    case when v_created then 'attendance.student.session.create' else 'attendance.student.roster.refresh' end,
    'succeeded','attendance_session',v_session_id::text,gen_random_uuid(),
    jsonb_build_object('attendance_date',p_attendance_date,'roster_id',v_roster_id,'member_count',v_member_count));

  return jsonb_build_object('session_id',v_session_id,'roster_id',v_roster_id,'member_count',v_member_count,'created',v_created,'state',v_session_state,'refreshed',true);
end;
$function$;

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

  update public.attendance_sessions set state='locked',locks_at=now(),updated_at=now()
  where tenant_id=p_tenant_id and id=p_attendance_session_id;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'attendance.student.lock','succeeded','attendance_session',p_attendance_session_id::text,gen_random_uuid(),
    jsonb_build_object('state',v_state),jsonb_build_object('state','locked','unmarked',0));

  return jsonb_build_object('locked',true,'unchanged',false,'session_id',p_attendance_session_id);
end;
$function$;

create or replace function public.review_student_attendance_correction(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_correction_id bigint,
  p_decision text,
  p_review_reason text
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_record_id bigint;
  v_person_id bigint;
  v_requested_category text;
  v_state text;
  v_reason text := btrim(coalesce(p_review_reason,''));
  v_decision text := lower(btrim(coalesce(p_decision,'')));
begin
  if v_decision not in ('approved','rejected') then raise exception 'correction decision is invalid'; end if;
  if length(v_reason)<8 or length(v_reason)>500 then raise exception 'review reason must be between 8 and 500 characters'; end if;

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

  select c.attendance_record_id,c.requested_status_category,c.state,ar.person_id
    into v_record_id,v_requested_category,v_state,v_person_id
  from public.attendance_corrections c
  join public.attendance_records ar on ar.tenant_id=c.tenant_id and ar.id=c.attendance_record_id
  join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id
  where c.tenant_id=p_tenant_id and c.id=p_correction_id and s.branch_id=p_branch_id and s.context_type='student_daily'
  for update of c;
  if v_record_id is null then raise exception 'attendance correction is not available in the active branch'; end if;
  if v_state<> 'pending' then raise exception 'attendance correction is no longer pending'; end if;

  update public.attendance_corrections set state=v_decision,reviewed_by_membership_id=v_membership_id,reviewed_at=now(),review_reason=v_reason
  where tenant_id=p_tenant_id and id=p_correction_id;

  if v_decision='approved' then
    if v_requested_category='absent' then
      if not exists(select 1 from public.attendance_alerts aa where aa.tenant_id=p_tenant_id and aa.attendance_record_id=v_record_id and aa.alert_type='absence' and aa.state in ('open','acknowledged')) then
        insert into public.attendance_alerts(tenant_id,branch_id,person_id,attendance_record_id,alert_type,severity,state)
        values(p_tenant_id,p_branch_id,v_person_id,v_record_id,'absence','medium','open');
      end if;
    else
      update public.attendance_alerts set state='resolved',resolved_at=now(),updated_at=now()
      where tenant_id=p_tenant_id and attendance_record_id=v_record_id and alert_type='absence' and state in ('open','acknowledged');
    end if;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'attendance.student.correction.review','succeeded','attendance_correction',p_correction_id::text,gen_random_uuid(),
    jsonb_build_object('state',v_state),jsonb_build_object('state',v_decision,'review_reason',v_reason));

  return jsonb_build_object('correction_id',p_correction_id,'state',v_decision);
end;
$function$;

revoke all on function public.lock_student_daily_attendance(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.review_student_attendance_correction(uuid,bigint,bigint,bigint,text,text) from public,anon,authenticated;
grant execute on function public.lock_student_daily_attendance(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.review_student_attendance_correction(uuid,bigint,bigint,bigint,text,text) to service_role;
