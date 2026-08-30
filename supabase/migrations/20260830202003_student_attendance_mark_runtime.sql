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
  from public.attendance_status_sets ss
  cross join lateral jsonb_array_elements(ss.statuses) s
  where ss.tenant_id=p_tenant_id and ss.id=v_status_set_id and s->>'key'=p_status_key
  limit 1;
  if v_status is null then raise exception 'attendance status is invalid'; end if;
  v_alert := coalesce((v_status->>'triggersAlert')::boolean,false);

  select jsonb_build_object('status_key',ar.status_key,'status_category',ar.status_category,'source',ar.source,'marked_at',ar.marked_at)
  into v_before
  from public.attendance_records ar
  where ar.tenant_id=p_tenant_id and ar.attendance_session_id=p_attendance_session_id and ar.person_id=p_person_id;

  insert into public.attendance_records(
    tenant_id,attendance_session_id,roster_id,person_id,enrollment_id,status_key,status_category,presence_ratio,
    marked_at,reason,note,idempotency_key,marked_by_membership_id,source,source_ref
  ) values(
    p_tenant_id,p_attendance_session_id,v_roster_id,p_person_id,v_enrollment_id,p_status_key,
    v_status->>'category',(v_status->>'presenceRatio')::numeric,now(),null,v_note,
    'student-attendance:'||p_attendance_session_id::text||':'||p_person_id::text,
    v_membership_id,v_source,v_source_ref
  )
  on conflict (tenant_id,attendance_session_id,person_id) do update set
    roster_id=excluded.roster_id,
    enrollment_id=excluded.enrollment_id,
    status_key=excluded.status_key,
    status_category=excluded.status_category,
    presence_ratio=excluded.presence_ratio,
    marked_at=excluded.marked_at,
    note=excluded.note,
    marked_by_membership_id=excluded.marked_by_membership_id,
    source=excluded.source,
    source_ref=excluded.source_ref
  returning id into v_record_id;

  if v_alert then
    if not exists(
      select 1 from public.attendance_alerts aa
      where aa.tenant_id=p_tenant_id and aa.attendance_record_id=v_record_id and aa.alert_type='absence' and aa.state in ('open','acknowledged')
    ) then
      insert into public.attendance_alerts(tenant_id,branch_id,person_id,attendance_record_id,alert_type,severity,state)
      values(p_tenant_id,p_branch_id,p_person_id,v_record_id,'absence','medium','open');
    end if;
  else
    update public.attendance_alerts set state='resolved',resolved_at=now(),updated_at=now()
    where tenant_id=p_tenant_id and attendance_record_id=v_record_id and alert_type='absence' and state in ('open','acknowledged');
  end if;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state,metadata
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'attendance.student.mark','succeeded','attendance_record',v_record_id::text,
    gen_random_uuid(),v_before,
    jsonb_build_object('session_id',p_attendance_session_id,'person_id',p_person_id,'status_key',p_status_key,'status_category',v_status->>'category','source',v_source),
    jsonb_build_object('source_ref',v_source_ref)
  );

  return jsonb_build_object('record_id',v_record_id,'status_key',p_status_key,'status_category',v_status->>'category','source',v_source,'alert_opened',v_alert);
end;
$function$;

revoke all on function public.mark_student_attendance(uuid,bigint,bigint,bigint,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.mark_student_attendance(uuid,bigint,bigint,bigint,bigint,text,text,text,text) to service_role;
