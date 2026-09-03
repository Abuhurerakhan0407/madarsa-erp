-- Phase 8 follow-up: published snapshots remain visible in result analysis.
create or replace function public.get_exam_results_analysis_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_exam_series_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $function$
declare v_membership bigint;v_run bigint;v_exam record;v_students jsonb;v_subjects jsonb;v_grades jsonb;begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in('assessment.marks.read','assessment.results.approve','assessment.results.publish','assessment.marks.enter','assessment.marks.moderate'))
  order by m.created_at asc limit 1;
  if v_membership is null then raise exception 'exam results read permission denied';end if;
  select es.* into v_exam from public.exam_series es where es.tenant_id=p_tenant_id and es.branch_id=p_branch_id and es.id=p_exam_series_id;
  if v_exam.id is null then raise exception 'exam series not available in this branch';end if;
  select rr.id into v_run from public.result_runs rr where rr.tenant_id=p_tenant_id and rr.exam_series_id=p_exam_series_id and rr.state in('calculated','approved','published') order by rr.run_number desc,rr.id desc limit 1;
  if v_run is null then return jsonb_build_object('exam_series_id',p_exam_series_id,'available',false,'students','[]'::jsonb,'subjects','[]'::jsonb,'grade_distribution','[]'::jsonb,'summary',jsonb_build_object('students',0,'average',null,'highest',null,'lowest',null,'pass',0,'fail',0,'incomplete',0,'pass_rate',null));end if;

  select coalesce(jsonb_agg(jsonb_build_object('snapshot_id',rs.id,'student_person_id',rs.student_person_id,'student_name',p.display_name,'student_number',sp.student_number,'photo_storage_path',p.photo_storage_path,'percentage',rs.percentage,'aggregate_status',rs.aggregate_status,'grade_key',rs.grade_key,'rank_value',case when v_exam.ranking_enabled then rs.rank_value else null end,'published_at',rs.published_at) order by p.display_name),'[]'::jsonb) into v_students
  from public.result_snapshots rs
  join public.persons p on p.tenant_id=rs.tenant_id and p.id=rs.student_person_id
  join public.student_profiles sp on sp.tenant_id=rs.tenant_id and sp.person_id=rs.student_person_id
  where rs.tenant_id=p_tenant_id and rs.result_run_id=v_run and rs.state in('approved','published');

  select coalesce(jsonb_agg(row_to_json(x) order by x.subject_name),'[]'::jsonb) into v_subjects from(
    select exs.id exam_subject_id,s.id subject_id,coalesce(s.labels->>'en',s.key) subject_name,s.labels,exs.maximum_marks,exs.pass_marks,
      round(avg(case when rss.raw_marks is not null then (rss.raw_marks/nullif(rss.maximum_marks,0))*100 end),1) average_percentage,
      count(*) filter(where rss.outcome='pass')::int pass_count,
      count(*) filter(where rss.outcome='fail')::int fail_count,
      count(*) filter(where rss.outcome not in('pass','fail'))::int other_count
    from public.result_subject_snapshots rss
    join public.result_snapshots rs on rs.tenant_id=rss.tenant_id and rs.id=rss.result_snapshot_id
    join public.exam_subjects exs on exs.tenant_id=rss.tenant_id and exs.id=rss.exam_subject_id
    join public.subjects s on s.tenant_id=exs.tenant_id and s.id=exs.subject_id
    where rss.tenant_id=p_tenant_id and rs.result_run_id=v_run
    group by exs.id,s.id,s.key,s.labels,exs.maximum_marks,exs.pass_marks
  )x;
  select coalesce(jsonb_agg(jsonb_build_object('grade_key',x.grade_key,'count',x.count) order by x.grade_key),'[]'::jsonb) into v_grades
  from(select coalesce(rs.grade_key,'ungraded') grade_key,count(*)::int count from public.result_snapshots rs where rs.tenant_id=p_tenant_id and rs.result_run_id=v_run group by coalesce(rs.grade_key,'ungraded'))x;

  return jsonb_build_object(
    'exam_series_id',p_exam_series_id,'result_run_id',v_run,'available',true,'ranking_enabled',v_exam.ranking_enabled,
    'summary',(select jsonb_build_object('students',count(*)::int,'average',round(avg(rs.percentage),1),'highest',max(rs.percentage),'lowest',min(rs.percentage),'pass',count(*) filter(where rs.aggregate_status='pass')::int,'fail',count(*) filter(where rs.aggregate_status='fail')::int,'incomplete',count(*) filter(where rs.aggregate_status not in('pass','fail'))::int,'pass_rate',round((count(*) filter(where rs.aggregate_status='pass')::numeric/nullif(count(*),0))*100,1)) from public.result_snapshots rs where rs.tenant_id=p_tenant_id and rs.result_run_id=v_run),
    'students',v_students,'subjects',v_subjects,'grade_distribution',v_grades
  );
end;
$function$;

revoke all on function public.get_exam_results_analysis_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_exam_results_analysis_v1(uuid,bigint,bigint,bigint) to service_role;
