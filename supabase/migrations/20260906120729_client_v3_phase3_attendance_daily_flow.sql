create or replace function public.get_student_attendance_workspace_v3(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_attendance_date date,
  p_group_id bigint,
  p_search text,
  p_page integer,
  p_page_size integer
)
returns jsonb
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
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes mbs
      where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id
    ))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='attendance.student.read'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'student attendance read permission denied'; end if;

  if p_group_id is not null and not exists(
    select 1 from public.academic_groups g
    where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.id=p_group_id
  ) then raise exception 'attendance group is not available in the active branch'; end if;

  select s.id,s.status_set_id,s.state into v_session_id,v_status_set_id,v_state
  from public.attendance_sessions s
  where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.context_type='student_daily' and s.context_key='branch_daily'
    and s.attendance_date=p_attendance_date and s.slot_id is null
  order by s.id desc limit 1;

  if v_session_id is null then
    select ss.statuses into v_statuses
    from public.attendance_status_sets ss
    where ss.tenant_id=p_tenant_id and ss.subject_type='student' and ss.key='student_default' and ss.status in ('published','draft')
    order by (ss.status='published') desc,ss.version desc limit 1;
    return jsonb_build_object(
      'started',false,'attendance_date',p_attendance_date,'state','not_started','statuses',coalesce(v_statuses,'[]'::jsonb),
      'summary',jsonb_build_object('total',0,'present',0,'absent',0,'late',0,'leave',0,'unmarked',0,'biometric',0,'nfc',0,'pending_corrections',0),
      'total',0,'page',v_page,'page_size',v_page_size,'rows','[]'::jsonb
    );
  end if;

  select r.id into v_roster_id
  from public.attendance_rosters r
  where r.tenant_id=p_tenant_id and r.attendance_session_id=v_session_id and r.group_id is null
  order by r.id desc limit 1;

  select ss.statuses into v_statuses
  from public.attendance_status_sets ss
  where ss.tenant_id=p_tenant_id and ss.id=v_status_set_id;

  select count(*)::integer into v_total
  from public.attendance_roster_members rm
  join public.persons p on p.tenant_id=rm.tenant_id and p.id=rm.person_id
  left join public.student_profiles sp on sp.tenant_id=rm.tenant_id and sp.person_id=rm.person_id
  left join public.enrollments e on e.tenant_id=rm.tenant_id and e.id=rm.enrollment_id
  where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student'
    and (p_group_id is null or e.group_id=p_group_id)
    and (v_search is null or p.display_name ilike '%'||v_search||'%' or sp.student_number ilike '%'||v_search||'%');

  select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.person_id),'[]'::jsonb) into v_rows
  from (
    select rm.person_id,p.display_name as name,p.name_native,sp.student_number,e.group_id,
      coalesce(g.labels->>'en',g.key) as group_name,
      ar.id as attendance_record_id,
      coalesce(ac.requested_status_key,ar.status_key) as status_key,
      coalesce(ac.requested_status_category,ar.status_category) as status_category,
      coalesce(ac.requested_presence_ratio,ar.presence_ratio) as presence_ratio,
      ar.status_key as original_status_key,
      ar.status_category as original_status_category,
      ar.marked_at,ar.source,ar.source_ref,ar.note,
      ac.id as approved_correction_id,
      ac.reason as approved_correction_reason,
      pc.id as pending_correction_id,
      pc.requested_status_key as pending_status_key,
      pc.reason as pending_correction_reason
    from public.attendance_roster_members rm
    join public.persons p on p.tenant_id=rm.tenant_id and p.id=rm.person_id
    left join public.student_profiles sp on sp.tenant_id=rm.tenant_id and sp.person_id=rm.person_id
    left join public.enrollments e on e.tenant_id=rm.tenant_id and e.id=rm.enrollment_id
    left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
    left join public.attendance_records ar on ar.tenant_id=rm.tenant_id and ar.attendance_session_id=v_session_id and ar.person_id=rm.person_id
    left join lateral (
      select c.id,c.requested_status_key,c.requested_status_category,c.requested_presence_ratio,c.reason
      from public.attendance_corrections c
      where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved'
      order by c.reviewed_at desc,c.id desc limit 1
    ) ac on true
    left join lateral (
      select c.id,c.requested_status_key,c.reason
      from public.attendance_corrections c
      where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='pending'
      order by c.created_at desc,c.id desc limit 1
    ) pc on true
    where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student'
      and (p_group_id is null or e.group_id=p_group_id)
      and (v_search is null or p.display_name ilike '%'||v_search||'%' or sp.student_number ilike '%'||v_search||'%')
    order by p.display_name,rm.person_id
    limit v_page_size offset ((v_page-1)*v_page_size)
  ) x;

  select jsonb_build_object(
    'total',count(*),
    'present',count(*) filter(where x.status_category='present'),
    'absent',count(*) filter(where x.status_category='absent'),
    'late',count(*) filter(where x.status_category='late'),
    'leave',count(*) filter(where x.status_category in ('leave','excused')),
    'unmarked',count(*) filter(where x.record_id is null),
    'biometric',count(*) filter(where x.source='biometric'),
    'nfc',count(*) filter(where x.source='nfc'),
    'pending_corrections',count(*) filter(where x.pending_correction_id is not null)
  ) into v_summary
  from (
    select ar.id as record_id,ar.source,
      coalesce(ac.requested_status_category,ar.status_category) as status_category,
      pc.id as pending_correction_id
    from public.attendance_roster_members rm
    left join public.enrollments e on e.tenant_id=rm.tenant_id and e.id=rm.enrollment_id
    left join public.attendance_records ar on ar.tenant_id=rm.tenant_id and ar.attendance_session_id=v_session_id and ar.person_id=rm.person_id
    left join lateral (
      select c.requested_status_category
      from public.attendance_corrections c
      where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved'
      order by c.reviewed_at desc,c.id desc limit 1
    ) ac on true
    left join lateral (
      select c.id
      from public.attendance_corrections c
      where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='pending'
      order by c.created_at desc,c.id desc limit 1
    ) pc on true
    where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student'
      and (p_group_id is null or e.group_id=p_group_id)
  ) x;

  return jsonb_build_object(
    'started',true,'attendance_date',p_attendance_date,'session_id',v_session_id,'roster_id',v_roster_id,'state',v_state,
    'statuses',coalesce(v_statuses,'[]'::jsonb),'summary',v_summary,'total',v_total,'page',v_page,'page_size',v_page_size,'rows',v_rows
  );
end;
$function$;

revoke all on function public.get_student_attendance_workspace_v3(uuid,bigint,bigint,date,bigint,text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_student_attendance_workspace_v3(uuid,bigint,bigint,date,bigint,text,integer,integer) to service_role;

create or replace function public.submit_student_attendance_group_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_attendance_session_id bigint,
  p_group_id bigint,
  p_exceptions jsonb
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_roster_id bigint;
  v_status_set_id bigint;
  v_state text;
  v_present_key text;
  v_exceptions jsonb := coalesce(p_exceptions,'[]'::jsonb);
  v_member record;
  v_status_key text;
  v_marked integer := 0;
  v_existing integer := 0;
  v_total integer := 0;
  v_result jsonb;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_attendance_session_id is null or p_group_id is null then
    raise exception 'identity, tenant, branch, attendance session, and group are required';
  end if;
  if jsonb_typeof(v_exceptions) <> 'array' then raise exception 'attendance exceptions must be an array'; end if;
  if jsonb_array_length(v_exceptions) > 200 then raise exception 'too many attendance exceptions'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes mbs
      where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id
    ))
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
  where s.tenant_id=p_tenant_id and s.id=p_attendance_session_id and s.branch_id=p_branch_id
    and s.context_type='student_daily' and s.context_key='branch_daily';
  if v_status_set_id is null then raise exception 'attendance session is not available in the active branch'; end if;
  if v_state not in ('draft','open') then raise exception 'attendance session is not open for marking'; end if;

  if not exists(
    select 1 from public.academic_groups g
    where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.id=p_group_id
  ) then raise exception 'attendance group is not available in the active branch'; end if;

  select r.id into v_roster_id
  from public.attendance_rosters r
  where r.tenant_id=p_tenant_id and r.attendance_session_id=p_attendance_session_id and r.group_id is null
  order by r.id desc limit 1;
  if v_roster_id is null then raise exception 'attendance roster is not available'; end if;

  select s->>'key' into v_present_key
  from public.attendance_status_sets ss
  cross join lateral jsonb_array_elements(ss.statuses) s
  where ss.tenant_id=p_tenant_id and ss.id=v_status_set_id and s->>'category'='present'
  order by coalesce((s->>'presenceRatio')::numeric,0) desc
  limit 1;
  if v_present_key is null then raise exception 'present attendance status is not configured'; end if;

  if exists(
    select 1
    from jsonb_array_elements(v_exceptions) x
    where jsonb_typeof(x) <> 'object'
      or nullif(x->>'person_id','') is null
      or nullif(btrim(coalesce(x->>'status_key','')),'') is null
      or (x->>'person_id') !~ '^[0-9]+$'
  ) then raise exception 'attendance exception is invalid'; end if;

  if exists(
    select 1
    from (
      select (x->>'person_id')::bigint person_id, count(*)
      from jsonb_array_elements(v_exceptions) x
      group by (x->>'person_id')::bigint
      having count(*) > 1
    ) d
  ) then raise exception 'duplicate attendance exception'; end if;

  if exists(
    select 1
    from jsonb_array_elements(v_exceptions) x
    where not exists(
      select 1
      from public.attendance_roster_members rm
      join public.enrollments e on e.tenant_id=rm.tenant_id and e.id=rm.enrollment_id
      where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student'
        and rm.person_id=(x->>'person_id')::bigint and e.group_id=p_group_id
    )
  ) then raise exception 'attendance exception student is not part of the selected group'; end if;

  if exists(
    select 1
    from jsonb_array_elements(v_exceptions) x
    where not exists(
      select 1
      from public.attendance_status_sets ss
      cross join lateral jsonb_array_elements(ss.statuses) s
      where ss.tenant_id=p_tenant_id and ss.id=v_status_set_id and s->>'key'=x->>'status_key'
    )
  ) then raise exception 'attendance exception status is invalid'; end if;

  select count(*)::integer into v_total
  from public.attendance_roster_members rm
  join public.enrollments e on e.tenant_id=rm.tenant_id and e.id=rm.enrollment_id
  where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student' and e.group_id=p_group_id;

  for v_member in
    select rm.person_id
    from public.attendance_roster_members rm
    join public.enrollments e on e.tenant_id=rm.tenant_id and e.id=rm.enrollment_id
    where rm.tenant_id=p_tenant_id and rm.roster_id=v_roster_id and rm.subject_type='student' and e.group_id=p_group_id
    order by rm.person_id
  loop
    if exists(
      select 1 from public.attendance_records ar
      where ar.tenant_id=p_tenant_id and ar.attendance_session_id=p_attendance_session_id and ar.person_id=v_member.person_id
    ) then
      v_existing := v_existing + 1;
      continue;
    end if;

    select x->>'status_key' into v_status_key
    from jsonb_array_elements(v_exceptions) x
    where (x->>'person_id')::bigint=v_member.person_id
    limit 1;
    v_status_key := coalesce(v_status_key,v_present_key);

    select public.mark_student_attendance(
      p_identity_id,
      p_tenant_id,
      p_branch_id,
      p_attendance_session_id,
      v_member.person_id,
      v_status_key,
      'manual',
      'client-v3:group-register',
      null
    ) into v_result;
    v_marked := v_marked + 1;
  end loop;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'attendance.student.group_submit','succeeded','academic_group',p_group_id::text,
    gen_random_uuid(),jsonb_build_object('attendance_session_id',p_attendance_session_id,'group_id',p_group_id,'students',v_total,'marked',v_marked,'preserved_existing',v_existing)
  );

  return jsonb_build_object('group_id',p_group_id,'students',v_total,'marked',v_marked,'preserved_existing',v_existing);
end;
$function$;

revoke all on function public.submit_student_attendance_group_v1(uuid,bigint,bigint,bigint,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.submit_student_attendance_group_v1(uuid,bigint,bigint,bigint,bigint,jsonb) to service_role;
