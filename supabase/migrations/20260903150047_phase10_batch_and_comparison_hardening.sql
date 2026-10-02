begin;

-- Extend the existing ID-card batch engine for Phase 10 explicit selections across multiple groups.
create or replace function public.get_student_id_card_batch(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_session_id bigint default null,
  p_group_id bigint default null,
  p_person_ids bigint[] default null
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_sessions jsonb := '[]'::jsonb;
  v_groups jsonb := '[]'::jsonb;
  v_students jsonb := '[]'::jsonb;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then
    raise exception 'identity, tenant, and branch are required';
  end if;
  if p_person_ids is not null and cardinality(p_person_ids) > 250 then
    raise exception 'bulk ID card selection is limited to 250 students';
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.identity_id = p_identity_id
    and m.status = 'active'
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
    and (
      m.all_branches
      or exists (
        select 1 from public.membership_branch_scopes mbs
        where mbs.tenant_id = m.tenant_id
          and mbs.membership_id = m.id
          and mbs.branch_id = p_branch_id
      )
    )
    and exists (
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id = mr.tenant_id and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id and mr.membership_id = m.id
        and rp.permission_code = 'students.profile.read'
    )
    and exists (
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id = mr.tenant_id and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id and mr.membership_id = m.id
        and rp.permission_code = 'document.job.manage'
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then raise exception 'bulk ID card permission denied'; end if;
  if not exists (
    select 1 from public.branches b
    where b.tenant_id = p_tenant_id and b.id = p_branch_id and b.status = 'active'
  ) then raise exception 'active branch is required'; end if;

  if p_session_id is not null and not exists (
    select 1 from public.academic_sessions s
    where s.tenant_id = p_tenant_id and s.id = p_session_id and s.status = 'active'
  ) then raise exception 'active academic session is required'; end if;

  if p_group_id is not null and not exists (
    select 1 from public.academic_groups g
    where g.tenant_id = p_tenant_id and g.branch_id = p_branch_id and g.id = p_group_id and g.status = 'active'
      and (p_session_id is null or g.session_id = p_session_id)
  ) then raise exception 'active class/group is required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'key', s.key,
    'labels', s.labels
  ) order by s.starts_on desc, s.id desc), '[]'::jsonb)
  into v_sessions
  from public.academic_sessions s
  where s.tenant_id = p_tenant_id
    and s.status = 'active'
    and exists (
      select 1 from public.academic_groups g
      where g.tenant_id = p_tenant_id and g.branch_id = p_branch_id
        and g.session_id = s.id and g.status = 'active'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'session_id', g.session_id,
    'program_id', g.program_id,
    'key', g.key,
    'labels', g.labels
  ) order by g.id asc), '[]'::jsonb)
  into v_groups
  from public.academic_groups g
  where g.tenant_id = p_tenant_id
    and g.branch_id = p_branch_id
    and g.status = 'active'
    and (p_session_id is null or g.session_id = p_session_id);

  if p_group_id is not null or p_person_ids is not null then
    with eligible as (
      select distinct on (sp.person_id)
        sp.person_id,
        sp.student_number,
        sp.status,
        p.display_name,
        p.name_native,
        p.date_of_birth,
        e.program_id,
        e.group_id,
        e.created_at
      from public.enrollments e
      join public.student_profiles sp on sp.tenant_id = e.tenant_id and sp.person_id = e.student_person_id
      join public.persons p on p.tenant_id = sp.tenant_id and p.id = sp.person_id
      where e.tenant_id = p_tenant_id
        and e.branch_id = p_branch_id
        and (p_group_id is null or e.group_id = p_group_id)
        and e.status = 'active'
        and sp.status = 'active'
        and (p_session_id is null or e.session_id = p_session_id)
        and (p_person_ids is null or sp.person_id = any(p_person_ids))
      order by sp.person_id, e.created_at desc, e.id desc
    ), enriched as (
      select e.*,
        pr.key as program_key,
        pr.labels as program_labels,
        ag.key as group_key,
        ag.labels as group_labels,
        guardian.display_name as guardian_name
      from eligible e
      left join public.programs pr on pr.tenant_id = p_tenant_id and pr.id = e.program_id
      left join public.academic_groups ag on ag.tenant_id = p_tenant_id and ag.id = e.group_id
      left join lateral (
        select gp.display_name
        from public.person_relationships r
        join public.persons gp on gp.tenant_id = r.tenant_id and gp.id = r.source_person_id
        where r.tenant_id = p_tenant_id
          and r.target_person_id = e.person_id
          and r.status = 'verified'
          and r.is_primary = true
        order by r.created_at asc, r.id asc
        limit 1
      ) guardian on true
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'person_id', person_id,
      'student_number', student_number,
      'name', display_name,
      'native_name', name_native,
      'date_of_birth', date_of_birth,
      'status', status,
      'program_key', program_key,
      'program_labels', program_labels,
      'group_key', group_key,
      'group_labels', group_labels,
      'guardian_name', guardian_name
    ) order by student_number asc, display_name asc), '[]'::jsonb)
    into v_students
    from enriched;
  end if;

  return jsonb_build_object(
    'sessions', v_sessions,
    'groups', v_groups,
    'students', v_students,
    'limit', 250
  );
end;
$function$;

revoke all on function public.get_student_id_card_batch(uuid,bigint,bigint,bigint,bigint,bigint[]) from public,anon,authenticated;
grant execute on function public.get_student_id_card_batch(uuid,bigint,bigint,bigint,bigint,bigint[]) to service_role;

-- Keep comparison exam averages inside the selected date window.
create or replace function public.run_operational_report_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_report_key text,
  p_parameters jsonb default '{}'::jsonb,
  p_output_format text default 'screen',
  p_request_key text default null
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_definition public.report_definitions%rowtype;
  v_rows jsonb:='[]'::jsonb;
  v_columns jsonb:='[]'::jsonb;
  v_count bigint:=0;
  v_run_id bigint;
  v_existing bigint;
  v_today date:=public.institution_local_date(p_tenant_id);
  v_date_from date;
  v_date_to date;
  v_session_id bigint;
  v_program_id bigint;
  v_group_id bigint;
  v_student_id bigint;
  v_teacher_id bigint;
begin
  p_report_key:=btrim(coalesce(p_report_key,''));
  p_parameters:=coalesce(p_parameters,'{}'::jsonb);
  if p_output_format not in ('screen','csv','json') then raise exception 'unsupported operational report format'; end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'valid report request key is required'; end if;

  begin
    if nullif(p_parameters->>'attendance_date','') is not null then
      v_date_from:=(p_parameters->>'attendance_date')::date; v_date_to:=v_date_from;
    else
      v_date_to:=coalesce(nullif(p_parameters->>'date_to','')::date,v_today);
      v_date_from:=coalesce(nullif(p_parameters->>'date_from','')::date,v_date_to-29);
    end if;
  exception when others then raise exception 'invalid report date range'; end;
  if v_date_from>v_date_to or (v_date_to-v_date_from)>366 then raise exception 'report date range must be between 1 and 367 days'; end if;
  begin v_session_id:=nullif(p_parameters->>'session_id','')::bigint; exception when others then raise exception 'invalid academic session filter'; end;
  begin v_program_id:=nullif(p_parameters->>'program_id','')::bigint; exception when others then raise exception 'invalid program filter'; end;
  begin v_group_id:=nullif(p_parameters->>'group_id','')::bigint; exception when others then raise exception 'invalid group filter'; end;
  begin v_student_id:=nullif(p_parameters->>'student_person_id','')::bigint; exception when others then raise exception 'invalid student filter'; end;
  begin v_teacher_id:=nullif(p_parameters->>'teacher_person_id','')::bigint; exception when others then raise exception 'invalid teacher filter'; end;
  if coalesce(v_session_id,1)<=0 or coalesce(v_program_id,1)<=0 or coalesce(v_group_id,1)<=0 or coalesce(v_student_id,1)<=0 or coalesce(v_teacher_id,1)<=0 then raise exception 'report filters must be positive identifiers'; end if;

  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='report.run.execute'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'report execution permission denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required'; end if;

  select rd.* into v_definition from public.report_definitions rd
  where rd.tenant_id=p_tenant_id and rd.key=p_report_key and rd.state='published'
  order by rd.version desc limit 1;
  if v_definition.id is null then raise exception 'published report definition not found'; end if;

  if p_report_key='daily_attendance' then
    v_columns:='["attendance_date","student_number","name","program","class_group","status","source","marked_at"]'::jsonb;
    with effective as(
      select distinct on(s.attendance_date,ar.person_id)
        s.attendance_date,ar.person_id,ar.enrollment_id,coalesce(ac.requested_status_key,ar.status_key) status,ar.source,ar.marked_at
      from public.attendance_records ar
      join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id and s.branch_id=p_branch_id
      left join lateral(select c.requested_status_key from public.attendance_corrections c where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved' order by c.reviewed_at desc,c.id desc limit 1) ac on true
      where ar.tenant_id=p_tenant_id and s.attendance_date between v_date_from and v_date_to
      order by s.attendance_date,ar.person_id,ar.marked_at desc,ar.id desc
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date desc,x.name,x.student_number),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select a.attendance_date,sp.student_number,p.display_name name,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,a.status,a.source,a.marked_at
      from effective a
      join public.enrollments e on e.tenant_id=p_tenant_id and e.id=a.enrollment_id and e.branch_id=p_branch_id
      join public.student_profiles sp on sp.tenant_id=p_tenant_id and sp.person_id=a.person_id
      join public.persons p on p.tenant_id=p_tenant_id and p.id=a.person_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=e.program_id
      left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=e.group_id
      where (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or a.person_id=v_student_id)
    ) x;

  elsif p_report_key='student_strength' then
    v_columns:='["academic_session","program","class_group","students","capacity","utilization_pct"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.program,x.class_group),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select coalesce(s.labels->>'en',s.key) academic_session,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,
        count(distinct e.student_person_id)::int students,g.capacity,
        case when g.capacity is null or g.capacity=0 then null else round((count(distinct e.student_person_id)::numeric/g.capacity)*100,1) end utilization_pct
      from public.enrollments e
      join public.academic_sessions s on s.tenant_id=e.tenant_id and s.id=e.session_id
      join public.programs pr on pr.tenant_id=e.tenant_id and pr.id=e.program_id
      join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status<>'cancelled'
        and coalesce(e.starts_on,v_date_to)<=v_date_to and (e.ends_on is null or e.ends_on>=v_date_to)
        and (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or e.student_person_id=v_student_id)
      group by s.id,s.labels,s.key,pr.id,pr.labels,pr.key,g.id,g.labels,g.key,g.capacity
    ) x;

  elsif p_report_key='teacher_attendance' then
    v_columns:='["attendance_date","teacher_id","teacher_name","designation","status","source","check_in","check_out"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date desc,x.teacher_name),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select a.attendance_date,h.employee_number teacher_id,p.display_name teacher_name,h.designation_key designation,a.status,a.source,a.check_in_at check_in,a.check_out_at check_out
      from public.hr_effective_attendance_v1 a
      join public.hr_employments h on h.tenant_id=a.tenant_id and h.id=a.employment_id and h.branch_id=p_branch_id
      join public.persons p on p.tenant_id=h.tenant_id and p.id=h.employee_person_id
      where a.tenant_id=p_tenant_id and a.attendance_date between v_date_from and v_date_to and (v_teacher_id is null or h.employee_person_id=v_teacher_id)
    ) x;

  elsif p_report_key='quran_progress' then
    v_columns:='["student_number","name","program","class_group","latest_category","latest_portion","latest_score","latest_outcome","attempts","revision_due"]'::jsonb;
    with students as(
      select distinct on(e.student_person_id) e.student_person_id,e.program_id,e.group_id
      from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted')
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
        and (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or e.student_person_id=v_student_id)
      order by e.student_person_id,e.starts_on desc nulls last,e.id desc
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.student_number),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select sp.student_number,p.display_name name,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,
        la.work_category latest_category,
        case when la.juz_number is not null then 'Juz '||la.juz_number when la.start_surah_number is not null then format('%s:%s-%s:%s',la.start_surah_number,la.start_ayah_number,la.end_surah_number,la.end_ayah_number) when la.page_start is not null then format('Pages %s-%s',la.page_start,la.page_end) else null end latest_portion,
        la.overall_score latest_score,la.outcome latest_outcome,coalesce(stats.attempts,0) attempts,coalesce(rv.revision_due,0) revision_due
      from students st
      join public.student_profiles sp on sp.tenant_id=p_tenant_id and sp.person_id=st.student_person_id
      join public.persons p on p.tenant_id=p_tenant_id and p.id=st.student_person_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=st.program_id
      left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=st.group_id
      left join lateral(
        select a.* from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=st.student_person_id and rs.branch_id=p_branch_id and a.occurred_at::date between v_date_from and v_date_to
        order by a.occurred_at desc,a.id desc limit 1
      ) la on true
      left join lateral(
        select count(*)::int attempts from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=st.student_person_id and rs.branch_id=p_branch_id and a.occurred_at::date between v_date_from and v_date_to
      ) stats on true
      left join lateral(select count(*)::int revision_due from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=st.student_person_id and r.state in('due','assigned','attempted') and r.due_on<=v_date_to) rv on true
    ) x;

  elsif p_report_key='program_progress' then
    v_columns:='["student_number","student_name","program","class_group","component","unit","state","progress_method","progress_value","occurred_at"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.occurred_at desc,x.student_name),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select sp.student_number,p.display_name student_name,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,
        coalesce(sub.labels->>'en',sub.key,'Component') component,coalesce(u.labels->>'en',u.key) unit,scp.state,scp.progress_method,scp.progress_value,scp.occurred_at
      from public.student_curriculum_progress scp
      join public.curriculum_units u on u.tenant_id=scp.tenant_id and u.id=scp.curriculum_unit_id
      join public.curriculum_version_items item on item.tenant_id=u.tenant_id and item.id=u.curriculum_item_id
      left join public.subjects sub on sub.tenant_id=item.tenant_id and sub.id=item.subject_id
      left join public.curriculum_teaching_assignments ta on ta.tenant_id=scp.tenant_id and ta.id=scp.teaching_assignment_id
      left join lateral(select e.* from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=scp.student_person_id and e.status='active' order by e.starts_on desc nulls last,e.id desc limit 1) e on true
      join public.student_profiles sp on sp.tenant_id=scp.tenant_id and sp.person_id=scp.student_person_id
      join public.persons p on p.tenant_id=scp.tenant_id and p.id=scp.student_person_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=coalesce(ta.program_id,e.program_id)
      left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=coalesce(ta.group_id,e.group_id)
      where scp.tenant_id=p_tenant_id and scp.occurred_at::date between v_date_from and v_date_to
        and (v_session_id is null or coalesce(ta.session_id,e.session_id)=v_session_id)
        and (v_program_id is null or coalesce(ta.program_id,e.program_id)=v_program_id)
        and (v_group_id is null or coalesce(ta.group_id,e.group_id)=v_group_id)
        and (v_student_id is null or scp.student_person_id=v_student_id)
    ) x;

  elsif p_report_key='exam_performance' then
    v_columns:='["exam","subject","student_number","student_name","program","class_group","marks","maximum_marks","percentage","status"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.exam,x.student_name,x.subject),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select coalesce(ex.labels->>'en',ex.key) exam,coalesce(sub.labels->>'en',sub.key) subject,sp.student_number,p.display_name student_name,
        coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,me.raw_marks marks,es.maximum_marks,
        case when me.raw_marks is null or es.maximum_marks=0 then null else round((me.raw_marks/es.maximum_marks)*100,1) end percentage,me.entry_status status
      from public.mark_entries me join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id
      join public.exam_subjects es on es.tenant_id=ms.tenant_id and es.id=ms.exam_subject_id
      join public.exam_series ex on ex.tenant_id=es.tenant_id and ex.id=es.exam_series_id and ex.branch_id=p_branch_id
      join public.subjects sub on sub.tenant_id=es.tenant_id and sub.id=es.subject_id
      join public.student_profiles sp on sp.tenant_id=me.tenant_id and sp.person_id=me.student_person_id
      join public.persons p on p.tenant_id=me.tenant_id and p.id=me.student_person_id
      left join public.programs pr on pr.tenant_id=ex.tenant_id and pr.id=ex.program_id
      left join public.academic_groups g on g.tenant_id=ex.tenant_id and g.id=ex.group_id
      where me.tenant_id=p_tenant_id and ex.starts_on<=v_date_to and ex.ends_on>=v_date_from
        and (v_session_id is null or ex.session_id=v_session_id) and (v_program_id is null or ex.program_id=v_program_id) and (v_group_id is null or ex.group_id=v_group_id) and (v_student_id is null or me.student_person_id=v_student_id)
    ) x;

  elsif p_report_key='absence_trend' then
    v_columns:='["attendance_date","program","class_group","absent","recorded","absence_rate"]'::jsonb;
    with effective as(
      select distinct on(s.attendance_date,ar.person_id) s.attendance_date,ar.person_id,ar.enrollment_id,coalesce(ac.requested_status_key,ar.status_key) status
      from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id and s.branch_id=p_branch_id
      left join lateral(select c.requested_status_key from public.attendance_corrections c where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved' order by c.reviewed_at desc,c.id desc limit 1) ac on true
      where ar.tenant_id=p_tenant_id and s.attendance_date between v_date_from and v_date_to
      order by s.attendance_date,ar.person_id,ar.marked_at desc,ar.id desc
    ), scoped as(
      select a.*,e.program_id,e.group_id,pr.labels program_labels,pr.key program_key,g.labels group_labels,g.key group_key
      from effective a join public.enrollments e on e.tenant_id=p_tenant_id and e.id=a.enrollment_id and e.branch_id=p_branch_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=e.program_id left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=e.group_id
      where (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or a.person_id=v_student_id)
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date desc,x.program,x.class_group),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select attendance_date,coalesce(program_labels->>'en',program_key) program,coalesce(group_labels->>'en',group_key) class_group,
        count(*) filter(where status='absent')::int absent,count(*)::int recorded,
        round((count(*) filter(where status='absent')::numeric/nullif(count(*),0))*100,1) absence_rate
      from scoped group by attendance_date,program_id,group_id,program_labels,program_key,group_labels,group_key
    ) x;

  elsif p_report_key='late_trend' then
    v_columns:='["attendance_date","program","class_group","late","recorded","late_rate"]'::jsonb;
    with effective as(
      select distinct on(s.attendance_date,ar.person_id) s.attendance_date,ar.person_id,ar.enrollment_id,coalesce(ac.requested_status_key,ar.status_key) status
      from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id and s.branch_id=p_branch_id
      left join lateral(select c.requested_status_key from public.attendance_corrections c where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved' order by c.reviewed_at desc,c.id desc limit 1) ac on true
      where ar.tenant_id=p_tenant_id and s.attendance_date between v_date_from and v_date_to
      order by s.attendance_date,ar.person_id,ar.marked_at desc,ar.id desc
    ), scoped as(
      select a.*,e.program_id,e.group_id,pr.labels program_labels,pr.key program_key,g.labels group_labels,g.key group_key
      from effective a join public.enrollments e on e.tenant_id=p_tenant_id and e.id=a.enrollment_id and e.branch_id=p_branch_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=e.program_id left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=e.group_id
      where (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or a.person_id=v_student_id)
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date desc,x.program,x.class_group),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select attendance_date,coalesce(program_labels->>'en',program_key) program,coalesce(group_labels->>'en',group_key) class_group,
        count(*) filter(where status='late')::int late,count(*)::int recorded,
        round((count(*) filter(where status='late')::numeric/nullif(count(*),0))*100,1) late_rate
      from scoped group by attendance_date,program_id,group_id,program_labels,program_key,group_labels,group_key
    ) x;

  elsif p_report_key='new_admissions' then
    v_columns:='["joined_on","student_number","admission_number","student_name","program","class_group","status"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.joined_on desc,x.student_name),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select sp.joined_on,sp.student_number,sp.admission_number,p.display_name student_name,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,sp.status
      from public.student_profiles sp join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
      left join lateral(select e.* from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=sp.person_id and e.status<>'cancelled' order by e.starts_on desc nulls last,e.id desc limit 1) e on true
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=e.program_id left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=e.group_id
      where sp.tenant_id=p_tenant_id and sp.joined_on between v_date_from and v_date_to and e.id is not null
        and (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or sp.person_id=v_student_id)
    ) x;

  elsif p_report_key='group_program_comparison' then
    v_columns:='["program","class_group","students","attendance_records","present","absent","late","attendance_rate","progress_events","exam_average"]'::jsonb;
    with current_students as(
      select distinct on(e.student_person_id) e.student_person_id,e.program_id,e.group_id
      from public.enrollments e
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status<>'cancelled' and coalesce(e.starts_on,v_date_to)<=v_date_to and (e.ends_on is null or e.ends_on>=v_date_to)
        and (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id)
      order by e.student_person_id,(e.status='active') desc,e.starts_on desc nulls last,e.id desc
    ), strength as(
      select program_id,group_id,count(*)::int students from current_students group by program_id,group_id
    ), att_effective as(
      select distinct on(s.attendance_date,ar.person_id) s.attendance_date,ar.person_id,coalesce(ac.requested_status_key,ar.status_key) status
      from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id and s.branch_id=p_branch_id
      left join lateral(select c.requested_status_key from public.attendance_corrections c where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved' order by c.reviewed_at desc,c.id desc limit 1) ac on true
      where ar.tenant_id=p_tenant_id and s.attendance_date between v_date_from and v_date_to order by s.attendance_date,ar.person_id,ar.marked_at desc,ar.id desc
    ), att as(
      select cs.program_id,cs.group_id,count(a.person_id)::int attendance_records,count(*) filter(where a.status='present')::int present,count(*) filter(where a.status='absent')::int absent,count(*) filter(where a.status='late')::int late
      from current_students cs left join att_effective a on a.person_id=cs.student_person_id group by cs.program_id,cs.group_id
    ), prog as(
      select cs.program_id,cs.group_id,count(scp.id)::int progress_events from current_students cs left join public.student_curriculum_progress scp on scp.tenant_id=p_tenant_id and scp.student_person_id=cs.student_person_id and scp.occurred_at::date between v_date_from and v_date_to group by cs.program_id,cs.group_id
    ), exams as(
      select cs.program_id,cs.group_id,round(avg(case when ex.id is null or me.raw_marks is null or es.maximum_marks=0 then null else (me.raw_marks/es.maximum_marks)*100 end),1) exam_average
      from current_students cs left join public.mark_entries me on me.tenant_id=p_tenant_id and me.student_person_id=cs.student_person_id
      left join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id left join public.exam_subjects es on es.tenant_id=ms.tenant_id and es.id=ms.exam_subject_id
      left join public.exam_series ex on ex.tenant_id=es.tenant_id and ex.id=es.exam_series_id and ex.branch_id=p_branch_id and ex.starts_on<=v_date_to and ex.ends_on>=v_date_from
      group by cs.program_id,cs.group_id
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.program,x.class_group),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,s.students,a.attendance_records,a.present,a.absent,a.late,
        case when a.attendance_records=0 then null else round(((a.present+a.late)::numeric/a.attendance_records)*100,1) end attendance_rate,pg.progress_events,ex.exam_average
      from strength s join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=s.program_id join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=s.group_id
      left join att a on a.program_id=s.program_id and a.group_id=s.group_id left join prog pg on pg.program_id=s.program_id and pg.group_id=s.group_id left join exams ex on ex.program_id=s.program_id and ex.group_id=s.group_id
    ) x;
  else
    raise exception 'unsupported operational report';
  end if;

  select rr.id into v_existing from public.report_runs rr where rr.tenant_id=p_tenant_id and rr.idempotency_key=p_request_key limit 1;
  if v_existing is null then
    insert into public.report_runs(tenant_id,report_definition_id,parameters,scope_snapshot,output_format,state,row_count,output_digest,requested_by_membership_id,idempotency_key,completed_at)
    values(p_tenant_id,v_definition.id,p_parameters,jsonb_build_object('branch_id',p_branch_id),p_output_format,'completed',v_count,md5(v_rows::text),v_membership,p_request_key,clock_timestamp()) returning id into v_run_id;
  else v_run_id:=v_existing; end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'report.run.execute','succeeded','report_run',v_run_id::text,gen_random_uuid(),jsonb_build_object('report_key',p_report_key,'output_format',p_output_format,'row_count',v_count));

  return jsonb_build_object('run_id',v_run_id,'report_key',p_report_key,'labels',v_definition.labels,'columns',v_columns,'rows',v_rows,'row_count',v_count,'parameters',p_parameters,'output_format',p_output_format);
end;
$fn$;

revoke all on function public.run_operational_report_v1(uuid,bigint,bigint,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.run_operational_report_v1(uuid,bigint,bigint,text,jsonb,text,text) to service_role;

commit;