do $block$
declare
  v_tenant bigint;
begin
  select t.id into v_tenant
  from public.tenants t
  where t.name='Al-Noor Islamic Academy'
  order by t.id limit 1;
  if v_tenant is null then return; end if;

  insert into public.report_definitions(tenant_id,key,labels,version,domain,parameter_schema,query_reference,allowed_columns,scope_rules,state)
  select v_tenant,x.key,x.labels,1,x.domain,x.parameter_schema,x.query_reference,x.allowed_columns,jsonb_build_object('branch_scoped',true), 'published'
  from (values
    ('student_master',jsonb_build_object('en','Student Master Register','ur','طلبہ ماسٹر رجسٹر','ar','السجل الرئيسي للطلاب'),'students','{}'::jsonb,'operational.student_master_v1',array['student_number','name','gender','date_of_birth','program','class_group','status','joined_on']::text[]),
    ('admission_register',jsonb_build_object('en','Admission Register','ur','داخلہ رجسٹر','ar','سجل القبول'),'admissions','{}'::jsonb,'operational.admission_register_v1',array['application_id','applicant_name','guardian_name','program','state','submitted_at','converted_at']::text[]),
    ('daily_attendance',jsonb_build_object('en','Daily Student Attendance','ur','روزانہ طلبہ حاضری','ar','حضور الطلاب اليومي'),'attendance',jsonb_build_object('attendance_date','date'),'operational.daily_attendance_v1',array['student_number','name','class_group','status','source','marked_at','note']::text[]),
    ('quran_progress',jsonb_build_object('en','Qur’an & Hifz Progress','ur','قرآن و حفظ پیش رفت','ar','تقدم القرآن والحفظ'),'quran','{}'::jsonb,'operational.quran_progress_v1',array['student_number','name','latest_category','latest_portion','latest_score','latest_outcome','attempts','revision_due']::text[]),
    ('exam_performance',jsonb_build_object('en','Exam Marks Register','ur','امتحانی نمبر رجسٹر','ar','سجل درجات الاختبارات'),'exams','{}'::jsonb,'operational.exam_performance_v1',array['exam','subject','student_number','student_name','marks','maximum_marks','percentage','status']::text[]),
    ('employee_register',jsonb_build_object('en','Employee Register','ur','ملازمین رجسٹر','ar','سجل الموظفين'),'hr','{}'::jsonb,'operational.employee_register_v1',array['employee_number','name','department','designation','contract_type','joined_on','state','attendance_today']::text[])
  ) as x(key,labels,domain,parameter_schema,query_reference,allowed_columns)
  where not exists(
    select 1 from public.report_definitions rd
    where rd.tenant_id=v_tenant and rd.key=x.key and rd.version=1
  );
end;
$block$;

create or replace function public.get_operational_reports_hub_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint
) returns jsonb
language plpgsql
stable
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_reports jsonb;
  v_recent jsonb;
begin
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rd.id,'key',rd.key,'labels',rd.labels,'domain',rd.domain,'parameter_schema',rd.parameter_schema,'allowed_columns',rd.allowed_columns
  ) order by rd.domain,rd.key),'[]'::jsonb)
  into v_reports
  from public.report_definitions rd
  where rd.tenant_id=p_tenant_id and rd.state='published'
    and rd.key in ('student_master','admission_register','daily_attendance','quran_progress','exam_performance','employee_register');

  select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc),'[]'::jsonb)
  into v_recent
  from (
    select rr.id,rd.key report_key,rd.labels,rr.parameters,rr.output_format,rr.state,rr.row_count,rr.created_at,rr.completed_at
    from public.report_runs rr
    join public.report_definitions rd on rd.tenant_id=rr.tenant_id and rd.id=rr.report_definition_id
    where rr.tenant_id=p_tenant_id and coalesce((rr.scope_snapshot->>'branch_id')::bigint,p_branch_id)=p_branch_id
    order by rr.created_at desc,rr.id desc limit 12
  ) x;

  return jsonb_build_object('reports',v_reports,'recent_runs',v_recent,'local_date',public.institution_local_date(p_tenant_id));
end;
$fn$;

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
  v_date date;
  v_existing bigint;
begin
  p_report_key:=btrim(coalesce(p_report_key,''));
  p_parameters:=coalesce(p_parameters,'{}'::jsonb);
  if p_output_format not in ('screen','csv','json') then raise exception 'unsupported operational report format'; end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'valid report request key is required'; end if;

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

  select rd.* into v_definition
  from public.report_definitions rd
  where rd.tenant_id=p_tenant_id and rd.key=p_report_key and rd.state='published'
  order by rd.version desc limit 1;
  if v_definition.id is null then raise exception 'published report definition not found'; end if;

  if p_report_key='student_master' then
    v_columns:='["student_number","name","gender","date_of_birth","program","class_group","status","joined_on"]'::jsonb;
    with current_enrollment as (
      select distinct on(e.student_person_id) e.*
      from public.enrollments e
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      order by e.student_person_id,(e.status='active') desc,e.starts_on desc nulls last,e.id desc
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.student_number),'[]'::jsonb),count(*)
    into v_rows,v_count
    from (
      select sp.student_number,p.display_name name,p.gender,p.date_of_birth,
        coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,
        sp.status,sp.joined_on
      from current_enrollment e
      join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
      join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
      left join public.programs pr on pr.tenant_id=e.tenant_id and pr.id=e.program_id
      left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
      where sp.status<>'archived'
    ) x;

  elsif p_report_key='admission_register' then
    v_columns:='["application_id","applicant_name","guardian_name","program","state","submitted_at","converted_at"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.application_id desc),'[]'::jsonb),count(*)
    into v_rows,v_count
    from (
      select a.id application_id,coalesce(ap.display_name,a.applicant_data->>'applicant_name','—') applicant_name,
        coalesce(gp.display_name,a.applicant_data->>'guardian_name','—') guardian_name,
        coalesce(pr.labels->>'en',pr.key) program,a.state,a.submitted_at,a.converted_at
      from public.applications a
      left join public.persons ap on ap.tenant_id=a.tenant_id and ap.id=a.applicant_person_id
      left join public.persons gp on gp.tenant_id=a.tenant_id and gp.id=a.guardian_person_id
      left join public.programs pr on pr.tenant_id=a.tenant_id and pr.id=a.program_id
      where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id
    ) x;

  elsif p_report_key='daily_attendance' then
    begin v_date:=coalesce(nullif(p_parameters->>'attendance_date','')::date,public.institution_local_date(p_tenant_id));
    exception when others then raise exception 'invalid attendance date'; end;
    v_columns:='["student_number","name","class_group","status","source","marked_at","note"]'::jsonb;
    with target as (
      select s.id session_id,r.id roster_id
      from public.attendance_sessions s
      join public.attendance_rosters r on r.tenant_id=s.tenant_id and r.attendance_session_id=s.id and r.group_id is null
      where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.context_type='student_daily' and s.context_key='branch_daily' and s.attendance_date=v_date
      order by s.id desc,r.id desc limit 1
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.student_number),'[]'::jsonb),count(*)
    into v_rows,v_count
    from (
      select sp.student_number,p.display_name name,coalesce(g.labels->>'en',g.key) class_group,
        coalesce(ac.requested_status_key,ar.status_key,'unmarked') status,ar.source,ar.marked_at,ar.note
      from target t
      join public.attendance_roster_members rm on rm.tenant_id=p_tenant_id and rm.roster_id=t.roster_id and rm.subject_type='student'
      join public.persons p on p.tenant_id=rm.tenant_id and p.id=rm.person_id
      left join public.student_profiles sp on sp.tenant_id=rm.tenant_id and sp.person_id=rm.person_id
      left join public.enrollments e on e.tenant_id=rm.tenant_id and e.id=rm.enrollment_id
      left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
      left join public.attendance_records ar on ar.tenant_id=rm.tenant_id and ar.attendance_session_id=t.session_id and ar.person_id=rm.person_id
      left join lateral(
        select c.requested_status_key from public.attendance_corrections c
        where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved'
        order by c.reviewed_at desc,c.id desc limit 1
      ) ac on true
    ) x;

  elsif p_report_key='quran_progress' then
    v_columns:='["student_number","name","latest_category","latest_portion","latest_score","latest_outcome","attempts","revision_due"]'::jsonb;
    with active_students as (
      select distinct on(e.student_person_id) e.student_person_id
      from public.enrollments e
      join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted')
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
      order by e.student_person_id,e.starts_on desc nulls last,e.id desc
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.student_number),'[]'::jsonb),count(*)
    into v_rows,v_count
    from (
      select sp.student_number,p.display_name name,la.work_category latest_category,
        case when la.juz_number is not null then 'Juz '||la.juz_number
             when la.start_surah_number is not null then format('%s:%s–%s:%s',la.start_surah_number,la.start_ayah_number,la.end_surah_number,la.end_ayah_number)
             when la.page_start is not null then format('Pages %s–%s',la.page_start,la.page_end) else null end latest_portion,
        la.overall_score latest_score,la.outcome latest_outcome,
        coalesce(stats.attempts,0) attempts,coalesce(rv.revision_due,0) revision_due
      from active_students s
      join public.student_profiles sp on sp.tenant_id=p_tenant_id and sp.person_id=s.student_person_id
      join public.persons p on p.tenant_id=p_tenant_id and p.id=s.student_person_id
      left join lateral(
        select a.* from public.quran_effective_recitation_attempts_v1 a
        join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id
        order by a.occurred_at desc,a.id desc limit 1
      ) la on true
      left join lateral(
        select count(*)::int attempts from public.quran_effective_recitation_attempts_v1 a
        join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id
      ) stats on true
      left join lateral(
        select count(*)::int revision_due from public.revision_obligations r
        where r.tenant_id=p_tenant_id and r.student_person_id=s.student_person_id and r.state in('due','assigned','attempted') and r.due_on<=public.institution_local_date(p_tenant_id)
      ) rv on true
    ) x;

  elsif p_report_key='exam_performance' then
    v_columns:='["exam","subject","student_number","student_name","marks","maximum_marks","percentage","status"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.exam,x.student_name,x.subject),'[]'::jsonb),count(*)
    into v_rows,v_count
    from (
      select coalesce(ex.labels->>'en',ex.key) exam,coalesce(sub.labels->>'en',sub.key) subject,
        sp.student_number,p.display_name student_name,me.raw_marks marks,es.maximum_marks,
        case when me.raw_marks is null or es.maximum_marks=0 then null else round((me.raw_marks/es.maximum_marks)*100,1) end percentage,
        me.entry_status status
      from public.mark_entries me
      join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id
      join public.exam_subjects es on es.tenant_id=ms.tenant_id and es.id=ms.exam_subject_id
      join public.exam_series ex on ex.tenant_id=es.tenant_id and ex.id=es.exam_series_id and ex.branch_id=p_branch_id
      join public.subjects sub on sub.tenant_id=es.tenant_id and sub.id=es.subject_id
      join public.student_profiles sp on sp.tenant_id=me.tenant_id and sp.person_id=me.student_person_id
      join public.persons p on p.tenant_id=me.tenant_id and p.id=me.student_person_id
      where me.tenant_id=p_tenant_id
    ) x;

  elsif p_report_key='employee_register' then
    v_columns:='["employee_number","name","department","designation","contract_type","joined_on","state","attendance_today"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.employee_number),'[]'::jsonb),count(*)
    into v_rows,v_count
    from (
      select e.employee_number,p.display_name name,e.department_key department,e.designation_key designation,e.contract_type,e.starts_on joined_on,e.state,
        ha.status attendance_today
      from public.hr_employments e
      join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id
      left join public.hr_effective_attendance_v1 ha on ha.tenant_id=e.tenant_id and ha.employment_id=e.id and ha.attendance_date=public.institution_local_date(p_tenant_id)
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.state<>'archived'
    ) x;
  else
    raise exception 'unsupported operational report';
  end if;

  select rr.id into v_existing from public.report_runs rr where rr.tenant_id=p_tenant_id and rr.idempotency_key=p_request_key limit 1;
  if v_existing is null then
    insert into public.report_runs(tenant_id,report_definition_id,parameters,scope_snapshot,output_format,state,row_count,output_digest,requested_by_membership_id,idempotency_key,completed_at)
    values(p_tenant_id,v_definition.id,p_parameters,jsonb_build_object('branch_id',p_branch_id),p_output_format,'completed',v_count,md5(v_rows::text),v_membership,p_request_key,clock_timestamp())
    returning id into v_run_id;
  else
    v_run_id:=v_existing;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'report.run.execute','succeeded','report_run',v_run_id::text,gen_random_uuid(),jsonb_build_object('report_key',p_report_key,'output_format',p_output_format,'row_count',v_count));

  return jsonb_build_object('run_id',v_run_id,'report_key',p_report_key,'labels',v_definition.labels,'columns',v_columns,'rows',v_rows,'row_count',v_count,'parameters',p_parameters,'output_format',p_output_format);
end;
$fn$;

revoke all on function public.get_operational_reports_hub_v1(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_operational_reports_hub_v1(uuid,bigint,bigint) to service_role;
revoke all on function public.run_operational_report_v1(uuid,bigint,bigint,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.run_operational_report_v1(uuid,bigint,bigint,text,jsonb,text,text) to service_role;