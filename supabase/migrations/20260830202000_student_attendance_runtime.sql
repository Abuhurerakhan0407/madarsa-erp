alter table public.attendance_records add column if not exists source text not null default 'manual';
alter table public.attendance_records add column if not exists source_ref text;

do $block$
begin
  if not exists (
    select 1 from pg_constraint where conname='attendance_records_source_check' and conrelid='public.attendance_records'::regclass
  ) then
    alter table public.attendance_records add constraint attendance_records_source_check check (source in ('manual','biometric','nfc','import'));
  end if;
end;
$block$;

create index if not exists attendance_records_tenant_session_source_idx
  on public.attendance_records(tenant_id,attendance_session_id,source);
create index if not exists attendance_records_tenant_person_marked_idx
  on public.attendance_records(tenant_id,person_id,marked_at desc);
create index if not exists attendance_roster_members_roster_subject_idx
  on public.attendance_roster_members(tenant_id,roster_id,subject_type,person_id);

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

  select s.id into v_session_id
  from public.attendance_sessions s
  where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.context_type='student_daily'
    and s.context_key='branch_daily' and s.attendance_date=p_attendance_date and s.slot_id is null
  order by s.id desc limit 1;

  if v_session_id is null then
    insert into public.attendance_sessions(tenant_id,branch_id,academic_session_id,context_type,context_key,attendance_date,status_set_id,state,opens_at)
    values(p_tenant_id,p_branch_id,v_academic_session_id,'student_daily','branch_daily',p_attendance_date,v_status_set_id,'open',now())
    returning id into v_session_id;
    v_created := true;
  end if;

  select r.id into v_roster_id
  from public.attendance_rosters r
  where r.tenant_id=p_tenant_id and r.attendance_session_id=v_session_id and r.group_id is null
  order by r.id desc limit 1;

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

  select count(*)::integer into v_member_count from public.attendance_roster_members rm
  where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student';
  update public.attendance_rosters set member_count=v_member_count where tenant_id=p_tenant_id and id=v_roster_id;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,
    case when v_created then 'attendance.student.session.create' else 'attendance.student.roster.refresh' end,
    'succeeded','attendance_session',v_session_id::text,gen_random_uuid(),
    jsonb_build_object('attendance_date',p_attendance_date,'roster_id',v_roster_id,'member_count',v_member_count));

  return jsonb_build_object('session_id',v_session_id,'roster_id',v_roster_id,'member_count',v_member_count,'created',v_created);
end;
$function$;

create or replace function public.get_student_attendance_workspace(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_attendance_date date,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 50
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_session_id bigint;
  v_roster_id bigint;
  v_status_set_id bigint;
  v_statuses jsonb := '[]'::jsonb;
  v_state text;
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := least(greatest(coalesce(p_page_size,50),1),100);
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
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='attendance.student.read'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'student attendance read permission denied'; end if;

  select s.id,s.status_set_id,s.state into v_session_id,v_status_set_id,v_state
  from public.attendance_sessions s
  where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.context_type='student_daily' and s.context_key='branch_daily'
    and s.attendance_date=p_attendance_date and s.slot_id is null
  order by s.id desc limit 1;

  if v_session_id is null then
    select ss.statuses into v_statuses from public.attendance_status_sets ss
    where ss.tenant_id=p_tenant_id and ss.subject_type='student' and ss.key='student_default' and ss.status in ('published','draft')
    order by (ss.status='published') desc,ss.version desc limit 1;
    return jsonb_build_object('started',false,'attendance_date',p_attendance_date,'state','not_started','statuses',coalesce(v_statuses,'[]'::jsonb),'summary',jsonb_build_object('total',0,'present',0,'absent',0,'late',0,'leave',0,'unmarked',0),'total',0,'page',v_page,'page_size',v_page_size,'rows','[]'::jsonb);
  end if;

  select r.id into v_roster_id from public.attendance_rosters r
  where r.tenant_id=p_tenant_id and r.attendance_session_id=v_session_id and r.group_id is null
  order by r.id desc limit 1;
  select ss.statuses into v_statuses from public.attendance_status_sets ss where ss.tenant_id=p_tenant_id and ss.id=v_status_set_id;

  select count(*)::integer into v_total
  from public.attendance_roster_members rm
  join public.persons p on p.tenant_id=rm.tenant_id and p.id=rm.person_id
  left join public.student_profiles sp on sp.tenant_id=rm.tenant_id and sp.person_id=rm.person_id
  where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student'
    and (v_search is null or p.display_name ilike '%'||v_search||'%' or sp.student_number ilike '%'||v_search||'%');

  select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.person_id),'[]'::jsonb) into v_rows
  from (
    select rm.person_id,p.display_name as name,p.name_native,sp.student_number,e.group_id,
      coalesce(g.labels->>'en',g.key) as group_name,
      ar.id as attendance_record_id,ar.status_key,ar.status_category,ar.presence_ratio,ar.marked_at,ar.source,ar.source_ref,ar.note
    from public.attendance_roster_members rm
    join public.persons p on p.tenant_id=rm.tenant_id and p.id=rm.person_id
    left join public.student_profiles sp on sp.tenant_id=rm.tenant_id and sp.person_id=rm.person_id
    left join public.enrollments e on e.tenant_id=rm.tenant_id and e.id=rm.enrollment_id
    left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
    left join public.attendance_records ar on ar.tenant_id=rm.tenant_id and ar.attendance_session_id=v_session_id and ar.person_id=rm.person_id
    where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student'
      and (v_search is null or p.display_name ilike '%'||v_search||'%' or sp.student_number ilike '%'||v_search||'%')
    order by p.display_name,rm.person_id
    limit v_page_size offset ((v_page-1)*v_page_size)
  ) x;

  select jsonb_build_object(
    'total',count(*),
    'present',count(*) filter(where ar.status_category='present'),
    'absent',count(*) filter(where ar.status_category='absent'),
    'late',count(*) filter(where ar.status_category='late'),
    'leave',count(*) filter(where ar.status_category in ('leave','excused')),
    'unmarked',count(*)-count(ar.id),
    'biometric',count(*) filter(where ar.source='biometric'),
    'nfc',count(*) filter(where ar.source='nfc')
  ) into v_summary
  from public.attendance_roster_members rm
  left join public.attendance_records ar on ar.tenant_id=rm.tenant_id and ar.attendance_session_id=v_session_id and ar.person_id=rm.person_id
  where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student';

  return jsonb_build_object('started',true,'attendance_date',p_attendance_date,'session_id',v_session_id,'roster_id',v_roster_id,'state',v_state,'statuses',coalesce(v_statuses,'[]'::jsonb),'summary',v_summary,'total',v_total,'page',v_page,'page_size',v_page_size,'rows',v_rows);
end;
$function$;

create or replace function public.mark_student_attendance(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_attendance_session_id bigint,
  p_person_id bigint,
  p_status_key text,
  p_source text default 'manual',
  p_source_ref text default null,
  p_note text default null
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_roster_id bigint;
  v_enrollment_id bigint;
  v_status_set_id bigint;
  v_state text;
  v_status jsonb;
  v_record_id bigint;
  v_before jsonb;
  v_source text := lower(btrim(coalesce(p_source,'manual')));
  v_source_ref text := nullif(btrim(coalesce(p_source_ref,'')),'');
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_alert boolean := false;
begin
  if p_attendance_session_id is null or p_person_id is null or nullif(btrim(coalesce(p_status_key,'')),'') is null then
    raise exception 'attendance session, student, and status are required';
  end if;
  if v_source not in ('manual','biometric','nfc','import') then raise exception 'attendance source is invalid'; end if;
  if v_source_ref is not null and length(v_source_ref)>160 then raise exception 'attendance source reference is too long'; end if;
  if v_note is not null and length(v_note)>500 then raise exception 'attendance note is too long'; end if;

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

  select s.status_set_id,s.state into v_status_set_id,v_state
  from public.attendance_sessions s
  where s.tenant_id=p_tenant_id and s.id=p_attendance_session_id and s.branch_id=p_branch_id and s.context_type='student_daily';
  if v_status_set_id is null then raise exception 'attendance session is not available in the active branch'; end if;
  if v_state not in ('draft','open') then raise exception 'attendance session is not open for marking'; end if;

  select r.id,rm.enrollment_id into v_roster_id,v_enrollment_id
  from public.attendance_rosters r
  join public.attendance_roster_members rm on rm.tenant_id=r.tenant_id and rm.roster_id=r.id and rm.person_id=p_person_id and rm.subject_type='student'
  where r.tenant_id=p_tenant_id and r.attendance_session_id=p_attendance_session_id
  order by r.id desc limit 1;
  if v_roster_id is null then raise exception 'student is not part of the attendance roster'; end if;

  select s into v_status
  from public.attendance_status_sets ss,cross join lateral jsonb_array_elements(ss.statuses) s
  where ss.tenant_id=p_tenant_id and ss.id=v_status_set_id and s->>'key'=p_status_key
  limit 1;
  if v_status is null then raise exception 'attendance status is invalid'; end if;
  v_alert := coalesce((v_status->>'triggersAlert')::boolean,false);

  select jsonb_build_object('status_key',ar.status_key,'status_category',ar.status_category,'source',ar.source,'marked_at',ar.marked_at)
    into v_before
  from public.attendance_records ar
  where ar.tenant_id=p_tenant_id and ar.attendance_session_id=p_attendance_session_id and ar.person_id=p_person_id;

  insert into public.attendance_records(tenant_id,attendance_session_id,roster_id,person_id,enrollment_id,status_key,status_category,presence_ratio,marked_at,reason,note,idempotency_key,marked_by_membership_id,source,source_ref)
  values(p_tenant_id,p_attendance_session_id,v_roster_id,p_person_id,v_enrollment_id,p_status_key,v_status->>'category',(v_status->>'presenceRatio')::numeric,now(),null,v_note,
    'student-attendance:'||p_attendance_session_id::text||':'||p_person_id::text,v_membership_id,v_source,v_source_ref)
  on conflict (tenant_id,attendance_session_id,person_id) do update set
    roster_id=excluded.roster_id,enrollment_id=excluded.enrollment_id,status_key=excluded.status_key,status_category=excluded.status_category,
    presence_ratio=excluded.presence_ratio,marked_at=excluded.marked_at,note=excluded.note,marked_by_membership_id=excluded.marked_by_membership_id,
    source=excluded.source,source_ref=excluded.source_ref
  returning id into v_record_id;

  if v_alert then
    if not exists(select 1 from public.attendance_alerts aa where aa.tenant_id=p_tenant_id and aa.attendance_record_id=v_record_id and aa.alert_type='absence' and aa.state in ('open','acknowledged')) then
      insert into public.attendance_alerts(tenant_id,branch_id,person_id,attendance_record_id,alert_type,severity,state)
      values(p_tenant_id,p_branch_id,p_person_id,v_record_id,'absence','medium','open');
    end if;
  else
    update public.attendance_alerts set state='resolved',resolved_at=now(),updated_at=now()
    where tenant_id=p_tenant_id and attendance_record_id=v_record_id and alert_type='absence' and state in ('open','acknowledged');
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state,metadata)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'attendance.student.mark','succeeded','attendance_record',v_record_id::text,gen_random_uuid(),v_before,
    jsonb_build_object('session_id',p_attendance_session_id,'person_id',p_person_id,'status_key',p_status_key,'status_category',v_status->>'category','source',v_source),
    jsonb_build_object('source_ref',v_source_ref));

  return jsonb_build_object('record_id',v_record_id,'status_key',p_status_key,'status_category',v_status->>'category','source',v_source,'alert_opened',v_alert);
end;
$function$;

revoke all on function public.ensure_student_daily_attendance(uuid,bigint,bigint,date) from public,anon,authenticated;
revoke all on function public.get_student_attendance_workspace(uuid,bigint,bigint,date,text,integer,integer) from public,anon,authenticated;
revoke all on function public.mark_student_attendance(uuid,bigint,bigint,bigint,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ensure_student_daily_attendance(uuid,bigint,bigint,date) to service_role;
grant execute on function public.get_student_attendance_workspace(uuid,bigint,bigint,date,text,integer,integer) to service_role;
grant execute on function public.mark_student_attendance(uuid,bigint,bigint,bigint,bigint,text,text,text,text) to service_role;
