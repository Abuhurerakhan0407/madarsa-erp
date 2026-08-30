create or replace function public.record_exam_mark_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_exam_subject_id bigint,
  p_student_person_id bigint,
  p_entry_status text,
  p_raw_marks numeric,
  p_comment text default null
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_exam bigint;
  v_group bigint;
  v_component bigint;
  v_max numeric;
  v_enrollment bigint;
  v_marksheet bigint;
  v_mark bigint;
  v_version integer;
  v_existing public.mark_entries%rowtype;
  v_status text:=lower(btrim(coalesce(p_entry_status,'')));
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='assessment.marks.enter'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'mark entry permission denied'; end if;

  if v_status not in ('present','absent','exempt','incomplete','withheld') then raise exception 'invalid mark status'; end if;
  if p_comment is not null and length(p_comment)>500 then raise exception 'comment is too long'; end if;

  select es.id,es.group_id into v_exam,v_group
  from public.exam_subjects x
  join public.exam_series es on es.tenant_id=x.tenant_id and es.id=x.exam_series_id
  where x.tenant_id=p_tenant_id and x.id=p_exam_subject_id and es.branch_id=p_branch_id and es.state='marks_open';
  if v_exam is null then raise exception 'exam is not open for marks'; end if;

  select ac.id,ac.maximum_marks into v_component,v_max
  from public.assessment_components ac
  where ac.tenant_id=p_tenant_id and ac.exam_subject_id=p_exam_subject_id and ac.entry_mode='marks'
  order by ac.sequence,ac.id limit 1;
  if v_component is null then raise exception 'assessment component not configured'; end if;

  if v_status='present' and (p_raw_marks is null or p_raw_marks<0 or p_raw_marks>v_max) then raise exception 'marks are outside the allowed range'; end if;
  if v_status<>'present' and p_raw_marks is not null then raise exception 'non-present status cannot carry marks'; end if;

  select e.id into v_enrollment
  from public.enrollments e
  join public.exam_series es on es.tenant_id=e.tenant_id and es.id=v_exam
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id
    and e.session_id=es.session_id and e.program_id=es.program_id and (es.group_id is null or e.group_id=es.group_id) and e.status='active'
  limit 1;
  if v_enrollment is null then raise exception 'student is not eligible for this exam'; end if;

  select ms.id into v_marksheet
  from public.marksheets ms
  where ms.tenant_id=p_tenant_id and ms.exam_subject_id=p_exam_subject_id
    and (ms.group_id=v_group or (ms.group_id is null and v_group is null))
  order by ms.version desc,ms.id desc limit 1;
  if v_marksheet is null then raise exception 'marksheet not configured'; end if;

  select * into v_existing
  from public.mark_entries me
  where me.tenant_id=p_tenant_id and me.marksheet_id=v_marksheet and me.assessment_component_id=v_component and me.enrollment_id=v_enrollment;

  if found
    and v_existing.entry_status=v_status
    and v_existing.raw_marks is not distinct from p_raw_marks
    and v_existing.comment is not distinct from nullif(btrim(coalesce(p_comment,'')),'') then
    return jsonb_build_object('mark_entry_id',v_existing.id,'version',v_existing.current_version,'unchanged',true);
  end if;

  if found then
    v_version:=v_existing.current_version+1;
    update public.mark_entries
    set entry_status=v_status,
        raw_marks=case when v_status='present' then p_raw_marks else null end,
        comment=nullif(btrim(coalesce(p_comment,'')),''),
        current_version=v_version,
        updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=v_existing.id
    returning id into v_mark;
  else
    v_version:=1;
    insert into public.mark_entries(tenant_id,marksheet_id,assessment_component_id,enrollment_id,student_person_id,entry_status,raw_marks,comment,current_version)
    values(p_tenant_id,v_marksheet,v_component,v_enrollment,p_student_person_id,v_status,case when v_status='present' then p_raw_marks else null end,nullif(btrim(coalesce(p_comment,'')),''),1)
    returning id into v_mark;
  end if;

  insert into public.mark_entry_versions(tenant_id,mark_entry_id,version,entry_status,raw_marks,grade_key,comment,source,actor_membership_id,reason)
  values(p_tenant_id,v_mark,v_version,v_status,case when v_status='present' then p_raw_marks else null end,null,nullif(btrim(coalesce(p_comment,'')),''),'entry',v_membership,case when v_version=1 then 'Initial mark entry' else 'Mark entry updated before lock' end);

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'assessment.marks.enter','succeeded','mark_entry',v_mark::text,gen_random_uuid(),jsonb_build_object('student_person_id',p_student_person_id,'exam_subject_id',p_exam_subject_id,'status',v_status,'raw_marks',p_raw_marks,'version',v_version));

  return jsonb_build_object('mark_entry_id',v_mark,'version',v_version,'unchanged',false);
end;
$fn$;

create or replace function public.moderate_exam_mark_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_mark_entry_id bigint,
  p_raw_marks numeric,
  p_reason text
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_entry public.mark_entries%rowtype;
  v_component public.assessment_components%rowtype;
  v_series public.exam_series%rowtype;
  v_before integer;
  v_after integer;
begin
  if length(btrim(coalesce(p_reason,'')))<4 then raise exception 'moderation reason is required'; end if;

  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='assessment.marks.moderate'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'mark moderation permission denied'; end if;

  select me.* into v_entry
  from public.mark_entries me
  join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id
  join public.exam_subjects x on x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id
  join public.exam_series es on es.tenant_id=x.tenant_id and es.id=x.exam_series_id
  where me.tenant_id=p_tenant_id and me.id=p_mark_entry_id and es.branch_id=p_branch_id;
  if not found then raise exception 'mark entry not found'; end if;

  select ac.* into v_component from public.assessment_components ac
  where ac.tenant_id=p_tenant_id and ac.id=v_entry.assessment_component_id;

  select es.* into v_series
  from public.marksheets ms
  join public.exam_subjects x on x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id
  join public.exam_series es on es.tenant_id=x.tenant_id and es.id=x.exam_series_id
  where ms.tenant_id=p_tenant_id and ms.id=v_entry.marksheet_id;

  if v_series.state in ('results_published','archived') then raise exception 'published results must be reopened before moderation'; end if;
  if p_raw_marks<0 or p_raw_marks>v_component.maximum_marks then raise exception 'marks are outside the allowed range'; end if;

  v_before:=v_entry.current_version;
  v_after:=v_before+1;

  update public.mark_entries
  set entry_status='present',raw_marks=p_raw_marks,current_version=v_after,updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=p_mark_entry_id;

  insert into public.mark_entry_versions(tenant_id,mark_entry_id,version,entry_status,raw_marks,grade_key,comment,source,actor_membership_id,reason)
  values(p_tenant_id,p_mark_entry_id,v_after,'present',p_raw_marks,v_entry.grade_key,v_entry.comment,'moderation',v_membership,btrim(p_reason));

  insert into public.mark_moderations(tenant_id,mark_entry_id,before_version,after_version,reason,moderator_membership_id)
  values(p_tenant_id,p_mark_entry_id,v_before,v_after,btrim(p_reason),v_membership);

  update public.result_runs
  set state='superseded'
  where tenant_id=p_tenant_id and exam_series_id=v_series.id and state in ('calculated','approved');

  if v_series.state in ('marks_locked','results_approved') then
    update public.exam_series set state='marks_open',updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=v_series.id;
    update public.marksheets ms set state='draft',locked_at=null,approved_at=null,updated_at=clock_timestamp()
    from public.exam_subjects x
    where ms.tenant_id=p_tenant_id and x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id and x.exam_series_id=v_series.id;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'assessment.marks.moderate','succeeded','mark_entry',p_mark_entry_id::text,gen_random_uuid(),jsonb_build_object('before_version',v_before,'after_version',v_after,'raw_marks',p_raw_marks,'reason',btrim(p_reason)));

  return jsonb_build_object('mark_entry_id',p_mark_entry_id,'version',v_after);
end;
$fn$;

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
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='assessment.results.approve'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'result calculation permission denied'; end if;

  select * into v_exam from public.exam_series
  where tenant_id=p_tenant_id and id=p_exam_series_id and branch_id=p_branch_id;
  if not found or v_exam.state not in ('marks_open','marks_locked') then raise exception 'exam is not ready for result calculation'; end if;

  select count(*) into v_missing
  from public.enrollments e
  cross join public.exam_subjects x
  left join public.marksheets ms on ms.tenant_id=x.tenant_id and ms.exam_subject_id=x.id
    and (ms.group_id=v_exam.group_id or (ms.group_id is null and v_exam.group_id is null))
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

  insert into public.result_runs(tenant_id,exam_series_id,run_number,curriculum_version_id,grading_scale_version_id,input_digest,rules_snapshot,state,anomaly_summary,calculated_at)
  values(p_tenant_id,p_exam_series_id,v_run_number,v_exam.curriculum_version_id,v_exam.grading_scale_version_id,coalesce(v_digest,md5('empty')),v_exam.rules_snapshot,'calculated','{}',clock_timestamp())
  returning id into v_run;

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
    join public.marksheets ms on ms.tenant_id=x.tenant_id and ms.exam_subject_id=x.id
      and (ms.group_id=v_exam.group_id or (ms.group_id is null and v_exam.group_id is null))
    join public.assessment_components ac on ac.tenant_id=x.tenant_id and ac.exam_subject_id=x.id and ac.entry_mode='marks'
    join public.mark_entries me on me.tenant_id=x.tenant_id and me.marksheet_id=ms.id and me.assessment_component_id=ac.id and me.enrollment_id=v_enrollment.id
    where x.tenant_id=p_tenant_id and x.exam_series_id=p_exam_series_id;

    v_pct:=case when coalesce(v_max,0)>0 then round((v_raw/v_max)*100,1) else null end;
    v_grade:=case when v_pct>=90 then 'A+' when v_pct>=80 then 'A' when v_pct>=70 then 'B' when v_pct>=60 then 'C' when v_pct>=50 then 'D' when v_pct>=40 then 'E' else 'F' end;

    insert into public.result_snapshots(tenant_id,result_run_id,enrollment_id,student_person_id,revision,raw_total,weighted_total,percentage,aggregate_status,grade_key,rank_value,tie_key,promotion_recommendation,calculation_trace,state)
    values(p_tenant_id,v_run,v_enrollment.id,v_enrollment.student_person_id,1,v_raw,v_raw,v_pct,case when v_fail=0 then 'pass' else 'fail' end,v_grade,null,null,case when v_fail=0 then 'promote' else 'review' end,jsonb_build_object('subject_failures',v_fail,'maximum_total',v_max),'approved')
    returning id into v_snapshot;

    insert into public.result_subject_snapshots(tenant_id,result_snapshot_id,exam_subject_id,raw_marks,normalized_marks,weighted_marks,rounded_marks,maximum_marks,outcome,grade_key,component_trace)
    select p_tenant_id,v_snapshot,x.id,
      case when me.entry_status='present' then me.raw_marks else null end,
      case when me.entry_status='present' then me.raw_marks else null end,
      case when me.entry_status='present' then me.raw_marks else null end,
      case when me.entry_status='present' then round(me.raw_marks,1) else null end,
      x.maximum_marks,
      case when me.entry_status='exempt' then 'exempt' when me.entry_status<>'present' then 'incomplete' when x.pass_marks is null or me.raw_marks>=x.pass_marks then 'pass' else 'fail' end,
      case when me.entry_status='present' then case when (me.raw_marks/x.maximum_marks)*100>=90 then 'A+' when (me.raw_marks/x.maximum_marks)*100>=80 then 'A' when (me.raw_marks/x.maximum_marks)*100>=70 then 'B' when (me.raw_marks/x.maximum_marks)*100>=60 then 'C' when (me.raw_marks/x.maximum_marks)*100>=50 then 'D' when (me.raw_marks/x.maximum_marks)*100>=40 then 'E' else 'F' end else null end,
      jsonb_build_object('mark_entry_id',me.id,'version',me.current_version,'status',me.entry_status)
    from public.exam_subjects x
    join public.marksheets ms on ms.tenant_id=x.tenant_id and ms.exam_subject_id=x.id
      and (ms.group_id=v_exam.group_id or (ms.group_id is null and v_exam.group_id is null))
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

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'assessment.results.calculate','succeeded','result_run',v_run::text,gen_random_uuid(),jsonb_build_object('exam_series_id',p_exam_series_id,'run_number',v_run_number));

  return jsonb_build_object('result_run_id',v_run,'run_number',v_run_number);
end;
$fn$;

create or replace function public.approve_exam_results_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_exam_series_id bigint
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare v_membership bigint;v_run bigint;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='assessment.results.approve')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'result approval permission denied'; end if;

  select rr.id into v_run
  from public.result_runs rr
  join public.exam_series es on es.tenant_id=rr.tenant_id and es.id=rr.exam_series_id
  where rr.tenant_id=p_tenant_id and rr.exam_series_id=p_exam_series_id and es.branch_id=p_branch_id and rr.state='calculated'
  order by rr.run_number desc limit 1;
  if v_run is null then raise exception 'no calculated result run is awaiting approval'; end if;

  update public.result_runs set state='approved',approved_by_membership_id=v_membership,approved_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=v_run;
  update public.exam_series set state='results_approved',updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=p_exam_series_id;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'assessment.results.approve','succeeded','result_run',v_run::text,gen_random_uuid(),jsonb_build_object('exam_series_id',p_exam_series_id));

  return jsonb_build_object('result_run_id',v_run,'state','approved');
end;
$fn$;

create or replace function public.publish_exam_results_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_exam_series_id bigint
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare v_membership bigint;v_run bigint;v_publication bigint;v_number integer;v_snapshot record;v_revision integer;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='assessment.results.publish')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'result publication permission denied'; end if;

  select rr.id into v_run
  from public.result_runs rr
  join public.exam_series es on es.tenant_id=rr.tenant_id and es.id=rr.exam_series_id
  where rr.tenant_id=p_tenant_id and rr.exam_series_id=p_exam_series_id and es.branch_id=p_branch_id and rr.state='approved'
  order by rr.run_number desc limit 1;
  if v_run is null then raise exception 'approved results are required before publication'; end if;

  if exists(select 1 from public.result_publications where tenant_id=p_tenant_id and result_run_id=v_run and revoked_at is null) then
    select id into v_publication from public.result_publications where tenant_id=p_tenant_id and result_run_id=v_run and revoked_at is null order by id desc limit 1;
    return jsonb_build_object('publication_id',v_publication,'result_run_id',v_run,'unchanged',true);
  end if;

  v_number:=coalesce((select max(publication_number) from public.result_publications where tenant_id=p_tenant_id and exam_series_id=p_exam_series_id),0)+1;

  insert into public.result_publications(tenant_id,exam_series_id,publication_number,result_run_id,audience,published_by_membership_id,notification_policy_snapshot)
  values(p_tenant_id,p_exam_series_id,v_number,v_run,'portal',v_membership,jsonb_build_object('notify',false,'channel','portal'))
  returning id into v_publication;

  update public.result_snapshots set state='published',published_at=clock_timestamp()
  where tenant_id=p_tenant_id and result_run_id=v_run;

  for v_snapshot in select id from public.result_snapshots where tenant_id=p_tenant_id and result_run_id=v_run loop
    v_revision:=coalesce((select max(revision) from public.report_card_issues where tenant_id=p_tenant_id and result_snapshot_id=v_snapshot.id),0)+1;
    insert into public.report_card_issues(tenant_id,result_snapshot_id,document_id,revision,template_key,template_version,content_digest)
    values(p_tenant_id,v_snapshot.id,null,v_revision,'standard_report_card',1,md5(p_tenant_id::text||':'||v_snapshot.id::text||':'||v_revision::text||':'||v_run::text));
  end loop;

  update public.marksheets ms
  set state='published',published_at=clock_timestamp(),updated_at=clock_timestamp()
  from public.exam_subjects x
  where ms.tenant_id=p_tenant_id and x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id and x.exam_series_id=p_exam_series_id;

  update public.exam_series set state='results_published',updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=p_exam_series_id;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'assessment.results.publish','succeeded','result_publication',v_publication::text,gen_random_uuid(),jsonb_build_object('exam_series_id',p_exam_series_id,'result_run_id',v_run,'publication_number',v_number));

  return jsonb_build_object('publication_id',v_publication,'result_run_id',v_run,'publication_number',v_number,'unchanged',false);
end;
$fn$;

revoke all on function public.record_exam_mark_v1(uuid,bigint,bigint,bigint,bigint,text,numeric,text) from public,anon,authenticated;
revoke all on function public.moderate_exam_mark_v1(uuid,bigint,bigint,bigint,numeric,text) from public,anon,authenticated;
revoke all on function public.calculate_exam_results_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.approve_exam_results_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.publish_exam_results_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.record_exam_mark_v1(uuid,bigint,bigint,bigint,bigint,text,numeric,text) to service_role;
grant execute on function public.moderate_exam_mark_v1(uuid,bigint,bigint,bigint,numeric,text) to service_role;
grant execute on function public.calculate_exam_results_v1(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.approve_exam_results_v1(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.publish_exam_results_v1(uuid,bigint,bigint,bigint) to service_role;
