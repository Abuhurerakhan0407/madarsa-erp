begin;

-- Workstream 04 rescue: correct governed academic calculations and report scoping.

create or replace function public.apply_grading_rounding_v1(p_value numeric,p_mode text,p_decimal_places integer)
returns numeric language plpgsql immutable set search_path to '' as $fn$
declare v_mode text:=lower(btrim(coalesce(p_mode,'half_up')));v_places integer:=coalesce(p_decimal_places,2);v_scale numeric;v_scaled numeric;v_floor numeric;
begin
 if p_value is null then return null;end if;if v_places<0 or v_places>4 then raise exception 'grading decimal places are invalid';end if;
 if v_mode='none' then return p_value;end if;v_scale:=power(10::numeric,v_places);
 if v_mode='floor' then return floor(p_value*v_scale)/v_scale;end if;if v_mode='ceil' then return ceil(p_value*v_scale)/v_scale;end if;
 if v_mode='half_even' then v_scaled:=p_value*v_scale;v_floor:=floor(v_scaled);if v_scaled-v_floor<0.5 then return v_floor/v_scale;end if;if v_scaled-v_floor>0.5 then return (v_floor+1)/v_scale;end if;return (case when mod(v_floor,2)=0 then v_floor else v_floor+1 end)/v_scale;end if;
 if v_mode<>'half_up' then raise exception 'grading rounding mode is invalid';end if;return round(p_value,v_places);
end;$fn$;

create or replace function public.resolve_exam_grade_v1(p_tenant_id bigint,p_grading_scale_version_id bigint,p_percentage numeric)
returns text language plpgsql stable set search_path to '' as $fn$
declare v_grade text;v_rules jsonb;
begin
 if p_percentage is null then return null;end if;
 select gb.grade_key into v_grade from public.grading_bands gb where gb.tenant_id=p_tenant_id and gb.grading_scale_version_id=p_grading_scale_version_id and p_percentage between gb.minimum_percent and gb.maximum_percent order by gb.sequence,gb.minimum_percent desc,gb.id limit 1;
 if v_grade is not null then return v_grade;end if;
 select g.rules into v_rules from public.grading_scale_versions g where g.tenant_id=p_tenant_id and g.id=p_grading_scale_version_id;
 if not found or jsonb_typeof(v_rules->'bands')<>'array' then return null;end if;
 select band->>'key' into v_grade from jsonb_array_elements(v_rules->'bands') band where nullif(btrim(band->>'key'),'') is not null and coalesce(band->>'min','') ~ '^[0-9]+([.][0-9]+)?$' and (band->>'min')::numeric<=p_percentage order by (band->>'min')::numeric desc limit 1;
 return v_grade;
end;$fn$;

revoke all on function public.apply_grading_rounding_v1(numeric,text,integer) from public,anon,authenticated;
revoke all on function public.resolve_exam_grade_v1(bigint,bigint,numeric) from public,anon,authenticated;
grant execute on function public.apply_grading_rounding_v1(numeric,text,integer) to service_role;
grant execute on function public.resolve_exam_grade_v1(bigint,bigint,numeric) to service_role;

create or replace function public.calculate_exam_results_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_exam_series_id bigint
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_exam public.exam_series%rowtype;
  v_run bigint;
  v_run_number integer;
  v_missing integer;
  v_enrollment record;
  v_raw numeric;
  v_max numeric;
  v_pct numeric;
  v_fail integer;
  v_incomplete integer;
  v_withheld integer;
  v_exempt integer;
  v_present integer;
  v_snapshot bigint;
  v_grade text;
  v_aggregate_status text;
  v_grading public.grading_scale_versions%rowtype;
  v_digest text;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='assessment.results.approve'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'result calculation permission denied'; end if;

  select * into v_exam
  from public.exam_series
  where tenant_id=p_tenant_id and id=p_exam_series_id and branch_id=p_branch_id;
  if not found or v_exam.state not in ('marks_open','marks_locked') then raise exception 'exam is not ready for result calculation'; end if;

  select * into v_grading from public.grading_scale_versions
  where tenant_id=p_tenant_id and id=v_exam.grading_scale_version_id;
  if not found then raise exception 'exam grading scale is not available'; end if;

  select count(*) into v_missing
  from public.enrollments e
  cross join public.exam_subjects x
  left join lateral (
    select z.* from public.marksheets z
    where z.tenant_id=x.tenant_id and z.exam_subject_id=x.id
      and (z.group_id=v_exam.group_id or (z.group_id is null and v_exam.group_id is null))
    order by z.version desc,z.id desc limit 1
  ) ms on true
  left join public.assessment_components ac on ac.tenant_id=x.tenant_id and ac.exam_subject_id=x.id and ac.entry_mode='marks'
  left join public.mark_entries me on me.tenant_id=e.tenant_id and me.marksheet_id=ms.id and me.assessment_component_id=ac.id and me.enrollment_id=e.id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.session_id=v_exam.session_id and e.program_id=v_exam.program_id
    and (v_exam.group_id is null or e.group_id=v_exam.group_id) and e.status='active'
    and x.tenant_id=p_tenant_id and x.exam_series_id=p_exam_series_id and me.id is null;
  if v_missing>0 then raise exception 'all candidate marks must be entered before calculation'; end if;

  v_run_number:=coalesce((select max(run_number) from public.result_runs where tenant_id=p_tenant_id and exam_series_id=p_exam_series_id),0)+1;

  select md5(string_agg(me.id::text||':'||me.current_version::text||':'||coalesce(me.raw_marks::text,me.entry_status),',' order by me.id))
  into v_digest
  from public.mark_entries me
  join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id
  join public.exam_subjects x on x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id
  where me.tenant_id=p_tenant_id and x.exam_series_id=p_exam_series_id;

  update public.result_runs set state='superseded'
  where tenant_id=p_tenant_id and exam_series_id=p_exam_series_id and state in ('calculated','approved');

  insert into public.result_runs(
    tenant_id,exam_series_id,run_number,curriculum_version_id,grading_scale_version_id,input_digest,
    rules_snapshot,state,anomaly_summary,calculated_at
  ) values(
    p_tenant_id,p_exam_series_id,v_run_number,v_exam.curriculum_version_id,v_exam.grading_scale_version_id,
    coalesce(v_digest,md5('empty')),v_exam.rules_snapshot,'calculated','{}',clock_timestamp()
  ) returning id into v_run;

  for v_enrollment in
    select e.id,e.student_person_id
    from public.enrollments e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.session_id=v_exam.session_id and e.program_id=v_exam.program_id
      and (v_exam.group_id is null or e.group_id=v_exam.group_id) and e.status='active'
    order by e.id
  loop
    select
      sum(case when me.entry_status='present' then me.raw_marks else 0 end),
      sum(case when me.entry_status='exempt' then 0 else x.maximum_marks end),
      count(*) filter(where me.entry_status='present' and x.pass_marks is not null and me.raw_marks<x.pass_marks),
      count(*) filter(where me.entry_status in ('absent','incomplete')),
      count(*) filter(where me.entry_status='withheld'),
      count(*) filter(where me.entry_status='exempt'),
      count(*) filter(where me.entry_status='present')
    into v_raw,v_max,v_fail,v_incomplete,v_withheld,v_exempt,v_present
    from public.exam_subjects x
    join lateral (
      select z.* from public.marksheets z
      where z.tenant_id=x.tenant_id and z.exam_subject_id=x.id
        and (z.group_id=v_exam.group_id or (z.group_id is null and v_exam.group_id is null))
      order by z.version desc,z.id desc limit 1
    ) ms on true
    join public.assessment_components ac on ac.tenant_id=x.tenant_id and ac.exam_subject_id=x.id and ac.entry_mode='marks'
    join public.mark_entries me on me.tenant_id=x.tenant_id and me.marksheet_id=ms.id and me.assessment_component_id=ac.id and me.enrollment_id=v_enrollment.id
    where x.tenant_id=p_tenant_id and x.exam_series_id=p_exam_series_id;

    v_pct:=case when coalesce(v_max,0)>0 then public.apply_grading_rounding_v1((v_raw/v_max)*100,v_grading.rounding_mode,v_grading.decimal_places) else null end;
    v_aggregate_status:=case
      when v_withheld>0 then 'withheld'
      when v_incomplete>0 then 'incomplete'
      when v_present=0 and v_exempt>0 then 'exempt'
      when v_fail>0 then 'fail'
      else 'pass'
    end;
    v_grade:=case when v_aggregate_status in ('pass','fail') then public.resolve_exam_grade_v1(p_tenant_id,v_exam.grading_scale_version_id,v_pct) else null end;

    insert into public.result_snapshots(
      tenant_id,result_run_id,enrollment_id,student_person_id,revision,raw_total,weighted_total,percentage,
      aggregate_status,grade_key,rank_value,tie_key,promotion_recommendation,calculation_trace,state
    ) values(
      p_tenant_id,v_run,v_enrollment.id,v_enrollment.student_person_id,1,v_raw,v_raw,v_pct,
      v_aggregate_status,v_grade,null,null,
      case when v_aggregate_status='pass' then 'promote' when v_aggregate_status='incomplete' then 'complete' when v_aggregate_status='exempt' then 'none' else 'review' end,
      jsonb_build_object('subject_failures',v_fail,'incomplete_subjects',v_incomplete,'withheld_subjects',v_withheld,'exempt_subjects',v_exempt,'maximum_total',v_max,'grading_scale_version_id',v_exam.grading_scale_version_id),'approved'
    ) returning id into v_snapshot;

    insert into public.result_subject_snapshots(
      tenant_id,result_snapshot_id,exam_subject_id,raw_marks,normalized_marks,weighted_marks,rounded_marks,
      maximum_marks,outcome,grade_key,component_trace
    )
    select p_tenant_id,v_snapshot,x.id,
      case when me.entry_status='present' then me.raw_marks else null end,
      case when me.entry_status='present' then me.raw_marks else null end,
      case when me.entry_status='present' then me.raw_marks else null end,
      case when me.entry_status='present' then round(me.raw_marks,v_grading.decimal_places) else null end,
      x.maximum_marks,
      case
        when me.entry_status='exempt' then 'exempt'
        when me.entry_status='withheld' then 'withheld'
        when me.entry_status in ('absent','incomplete') then 'incomplete'
        when x.pass_marks is null or me.raw_marks>=x.pass_marks then 'pass'
        else 'fail'
      end,
      case when me.entry_status='present' then public.resolve_exam_grade_v1(
        p_tenant_id,v_exam.grading_scale_version_id,
        public.apply_grading_rounding_v1((me.raw_marks/x.maximum_marks)*100,v_grading.rounding_mode,v_grading.decimal_places)
      ) else null end,
      jsonb_build_object('mark_entry_id',me.id,'version',me.current_version,'status',me.entry_status)
    from public.exam_subjects x
    join lateral (
      select z.* from public.marksheets z
      where z.tenant_id=x.tenant_id and z.exam_subject_id=x.id
        and (z.group_id=v_exam.group_id or (z.group_id is null and v_exam.group_id is null))
      order by z.version desc,z.id desc limit 1
    ) ms on true
    join public.assessment_components ac on ac.tenant_id=x.tenant_id and ac.exam_subject_id=x.id and ac.entry_mode='marks'
    join public.mark_entries me on me.tenant_id=x.tenant_id and me.marksheet_id=ms.id and me.assessment_component_id=ac.id and me.enrollment_id=v_enrollment.id
    where x.tenant_id=p_tenant_id and x.exam_series_id=p_exam_series_id;
  end loop;

  if v_exam.ranking_enabled then
    with ranked as (
      select rs.id,rank() over(order by rs.percentage desc)::integer as rank_value,rs.percentage
      from public.result_snapshots rs
      where rs.tenant_id=p_tenant_id and rs.result_run_id=v_run
        and rs.aggregate_status in ('pass','fail') and rs.percentage is not null
    )
    update public.result_snapshots rs
    set rank_value=ranked.rank_value,tie_key=ranked.percentage::text
    from ranked where rs.tenant_id=p_tenant_id and rs.id=ranked.id;
  end if;

  update public.marksheets ms
  set state='locked',locked_at=clock_timestamp(),updated_at=clock_timestamp()
  from public.exam_subjects x
  where ms.tenant_id=p_tenant_id and x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id and x.exam_series_id=p_exam_series_id;

  update public.exam_series set state='marks_locked',updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=p_exam_series_id;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership,'assessment.results.calculate','succeeded','result_run',v_run::text,
    gen_random_uuid(),jsonb_build_object('exam_series_id',p_exam_series_id,'run_number',v_run_number)
  );

  return jsonb_build_object('result_run_id',v_run,'run_number',v_run_number);
end;
$fn$;

revoke all on function public.calculate_exam_results_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.calculate_exam_results_v1(uuid,bigint,bigint,bigint) to service_role;

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
      select distinct on(e.student_person_id) e.student_person_id,e.session_id,e.program_id,e.group_id
      from public.enrollments e
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status<>'cancelled' and coalesce(e.starts_on,v_date_to)<=v_date_to and (e.ends_on is null or e.ends_on>=v_date_to)
        and (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or e.student_person_id=v_student_id)
      order by e.student_person_id,(e.status='active') desc,e.starts_on desc nulls last,e.id desc
    ), strength as(
      select program_id,group_id,count(*)::int students from current_students group by program_id,group_id
    ), att_effective as(
      select distinct on(s.attendance_date,ar.person_id) s.attendance_date,ar.person_id,ar.enrollment_id,coalesce(ac.requested_status_key,ar.status_key) status
      from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id and s.branch_id=p_branch_id
      left join lateral(select c.requested_status_key from public.attendance_corrections c where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved' order by c.reviewed_at desc,c.id desc limit 1) ac on true
      where ar.tenant_id=p_tenant_id and s.attendance_date between v_date_from and v_date_to order by s.attendance_date,ar.person_id,ar.marked_at desc,ar.id desc
    ), att as(
      select cs.program_id,cs.group_id,count(a.person_id)::int attendance_records,count(*) filter(where a.status='present')::int present,count(*) filter(where a.status='absent')::int absent,count(*) filter(where a.status='late')::int late
      from current_students cs left join att_effective a on a.person_id=cs.student_person_id and exists(select 1 from public.enrollments ae where ae.tenant_id=p_tenant_id and ae.id=a.enrollment_id and ae.session_id=cs.session_id and ae.program_id=cs.program_id and ae.group_id is not distinct from cs.group_id) group by cs.program_id,cs.group_id
    ), prog as(
      select cs.program_id,cs.group_id,count(scp.id) filter(where ta.id is null or (ta.session_id=cs.session_id and ta.program_id=cs.program_id and (ta.group_id is null or ta.group_id is not distinct from cs.group_id)))::int progress_events from current_students cs left join public.student_curriculum_progress scp on scp.tenant_id=p_tenant_id and scp.student_person_id=cs.student_person_id and scp.occurred_at::date between v_date_from and v_date_to left join public.curriculum_teaching_assignments ta on ta.tenant_id=scp.tenant_id and ta.id=scp.teaching_assignment_id group by cs.program_id,cs.group_id
    ), exams as(
      select cs.program_id,cs.group_id,round(avg(case when ex.id is null or me.entry_status<>'present' or me.raw_marks is null or es.maximum_marks=0 then null else (me.raw_marks/es.maximum_marks)*100 end),1) exam_average
      from current_students cs left join public.mark_entries me on me.tenant_id=p_tenant_id and me.student_person_id=cs.student_person_id
      left join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id left join public.exam_subjects es on es.tenant_id=ms.tenant_id and es.id=ms.exam_subject_id
      left join public.exam_series ex on ex.tenant_id=es.tenant_id and ex.id=es.exam_series_id and ex.branch_id=p_branch_id and ex.session_id=cs.session_id and ex.program_id=cs.program_id and (ex.group_id is null or ex.group_id is not distinct from cs.group_id) and ex.starts_on<=v_date_to and ex.ends_on>=v_date_from
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

create or replace function public.get_exam_report_card_v2(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_exam_series_id bigint)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, extensions as $function$
declare v_membership bigint;v_snapshot bigint;v_result jsonb;begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in('assessment.marks.read','assessment.results.approve','assessment.results.publish'))
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'report card permission denied';end if;
  if not exists(select 1 from public.exam_series es where es.tenant_id=p_tenant_id and es.branch_id=p_branch_id and es.id=p_exam_series_id) then raise exception 'exam series not available in this branch';end if;
  select rs.id into v_snapshot from public.result_snapshots rs join public.result_runs rr on rr.tenant_id=rs.tenant_id and rr.id=rs.result_run_id
  where rs.tenant_id=p_tenant_id and rs.student_person_id=p_student_person_id and rr.exam_series_id=p_exam_series_id and rs.state='published'
  order by rs.published_at desc nulls last,rs.id desc limit 1;
  if v_snapshot is null then return null;end if;
  select jsonb_build_object(
    'student',jsonb_build_object('person_id',p.id,'name',p.display_name,'name_native',p.name_native,'student_number',sp.student_number),
    'exam',jsonb_build_object('id',es.id,'labels',es.labels,'state',es.state,'starts_on',es.starts_on,'ends_on',es.ends_on,'session_id',sess.id,'session_labels',sess.labels,'session_label',coalesce(sess.labels->>'en',sess.key)),
    'result',jsonb_build_object('snapshot_id',rs.id,'percentage',rs.percentage,'aggregate_status',rs.aggregate_status,'grade_key',rs.grade_key,'rank_value',case when es.ranking_enabled then rs.rank_value else null end,'promotion_recommendation',rs.promotion_recommendation,'published_at',rs.published_at),
    'subjects',coalesce((select jsonb_agg(jsonb_build_object('subject_name',coalesce(s.labels->>'en',s.key),'labels',s.labels,'raw_marks',rss.raw_marks,'maximum_marks',rss.maximum_marks,'outcome',rss.outcome,'grade_key',rss.grade_key) order by s.key) from public.result_subject_snapshots rss join public.exam_subjects x on x.tenant_id=rss.tenant_id and x.id=rss.exam_subject_id join public.subjects s on s.tenant_id=x.tenant_id and s.id=x.subject_id where rss.tenant_id=rs.tenant_id and rss.result_snapshot_id=rs.id),'[]'::jsonb),
    'issue',(select jsonb_build_object('id',rci.id,'revision',rci.revision,'template_key',rci.template_key,'issued_at',rci.issued_at,'verification_code',rci.content_digest) from public.report_card_issues rci where rci.tenant_id=rs.tenant_id and rci.result_snapshot_id=rs.id order by rci.revision desc limit 1)
  ) into v_result
  from public.result_snapshots rs join public.result_runs rr on rr.tenant_id=rs.tenant_id and rr.id=rs.result_run_id join public.exam_series es on es.tenant_id=rr.tenant_id and es.id=rr.exam_series_id join public.academic_sessions sess on sess.tenant_id=es.tenant_id and sess.id=es.session_id join public.persons p on p.tenant_id=rs.tenant_id and p.id=rs.student_person_id join public.student_profiles sp on sp.tenant_id=rs.tenant_id and sp.person_id=rs.student_person_id
  where rs.tenant_id=p_tenant_id and rs.id=v_snapshot;
  return v_result;
end;$function$;
revoke all on function public.get_exam_report_card_v2(uuid,bigint,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_exam_report_card_v2(uuid,bigint,bigint,bigint,bigint) to service_role;

commit;
