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
  v_snapshot bigint;
  v_grade text;
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
      sum(x.maximum_marks),
      count(*) filter(where me.entry_status<>'present' or (x.pass_marks is not null and me.raw_marks<x.pass_marks))
    into v_raw,v_max,v_fail
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

    v_pct:=case when coalesce(v_max,0)>0 then round((v_raw/v_max)*100,1) else null end;
    v_grade:=case
      when v_pct>=90 then 'A+'
      when v_pct>=80 then 'A'
      when v_pct>=70 then 'B'
      when v_pct>=60 then 'C'
      when v_pct>=50 then 'D'
      when v_pct>=40 then 'E'
      else 'F'
    end;

    insert into public.result_snapshots(
      tenant_id,result_run_id,enrollment_id,student_person_id,revision,raw_total,weighted_total,percentage,
      aggregate_status,grade_key,rank_value,tie_key,promotion_recommendation,calculation_trace,state
    ) values(
      p_tenant_id,v_run,v_enrollment.id,v_enrollment.student_person_id,1,v_raw,v_raw,v_pct,
      case when v_fail=0 then 'pass' else 'fail' end,v_grade,null,null,
      case when v_fail=0 then 'promote' else 'review' end,
      jsonb_build_object('subject_failures',v_fail,'maximum_total',v_max),'approved'
    ) returning id into v_snapshot;

    insert into public.result_subject_snapshots(
      tenant_id,result_snapshot_id,exam_subject_id,raw_marks,normalized_marks,weighted_marks,rounded_marks,
      maximum_marks,outcome,grade_key,component_trace
    )
    select p_tenant_id,v_snapshot,x.id,
      case when me.entry_status='present' then me.raw_marks else null end,
      case when me.entry_status='present' then me.raw_marks else null end,
      case when me.entry_status='present' then me.raw_marks else null end,
      case when me.entry_status='present' then round(me.raw_marks,1) else null end,
      x.maximum_marks,
      case
        when me.entry_status='exempt' then 'exempt'
        when me.entry_status<>'present' then 'incomplete'
        when x.pass_marks is null or me.raw_marks>=x.pass_marks then 'pass'
        else 'fail'
      end,
      case when me.entry_status='present' then
        case
          when (me.raw_marks/x.maximum_marks)*100>=90 then 'A+'
          when (me.raw_marks/x.maximum_marks)*100>=80 then 'A'
          when (me.raw_marks/x.maximum_marks)*100>=70 then 'B'
          when (me.raw_marks/x.maximum_marks)*100>=60 then 'C'
          when (me.raw_marks/x.maximum_marks)*100>=50 then 'D'
          when (me.raw_marks/x.maximum_marks)*100>=40 then 'E'
          else 'F'
        end
      else null end,
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
