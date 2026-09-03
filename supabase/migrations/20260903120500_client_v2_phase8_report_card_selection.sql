create or replace function public.get_exam_report_card_v2(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_exam_series_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $function$
declare v_membership bigint;v_snapshot bigint;v_result jsonb;begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in('assessment.marks.read','assessment.results.approve','assessment.results.publish'))
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'report card permission denied';end if;
  if not exists(select 1 from public.exam_series es where es.tenant_id=p_tenant_id and es.branch_id=p_branch_id and es.id=p_exam_series_id) then raise exception 'exam series not available in this branch';end if;
  select rs.id into v_snapshot
  from public.result_snapshots rs
  join public.result_runs rr on rr.tenant_id=rs.tenant_id and rr.id=rs.result_run_id
  where rs.tenant_id=p_tenant_id and rs.student_person_id=p_student_person_id and rr.exam_series_id=p_exam_series_id and rs.state='published'
  order by rs.published_at desc nulls last,rs.id desc limit 1;
  if v_snapshot is null then return null;end if;
  select jsonb_build_object(
    'student',jsonb_build_object('person_id',p.id,'name',p.display_name,'name_native',p.name_native,'student_number',sp.student_number),
    'exam',jsonb_build_object('id',es.id,'labels',es.labels,'state',es.state,'starts_on',es.starts_on,'ends_on',es.ends_on),
    'result',jsonb_build_object('snapshot_id',rs.id,'percentage',rs.percentage,'aggregate_status',rs.aggregate_status,'grade_key',rs.grade_key,'rank_value',case when es.ranking_enabled then rs.rank_value else null end,'promotion_recommendation',rs.promotion_recommendation,'published_at',rs.published_at),
    'subjects',coalesce((select jsonb_agg(jsonb_build_object('subject_name',coalesce(s.labels->>'en',s.key),'labels',s.labels,'raw_marks',rss.raw_marks,'maximum_marks',rss.maximum_marks,'outcome',rss.outcome,'grade_key',rss.grade_key) order by s.key) from public.result_subject_snapshots rss join public.exam_subjects x on x.tenant_id=rss.tenant_id and x.id=rss.exam_subject_id join public.subjects s on s.tenant_id=x.tenant_id and s.id=x.subject_id where rss.tenant_id=rs.tenant_id and rss.result_snapshot_id=rs.id),'[]'::jsonb),
    'issue',(select jsonb_build_object('id',rci.id,'revision',rci.revision,'template_key',rci.template_key,'issued_at',rci.issued_at,'verification_code',rci.content_digest) from public.report_card_issues rci where rci.tenant_id=rs.tenant_id and rci.result_snapshot_id=rs.id order by rci.revision desc limit 1)
  ) into v_result
  from public.result_snapshots rs
  join public.result_runs rr on rr.tenant_id=rs.tenant_id and rr.id=rs.result_run_id
  join public.exam_series es on es.tenant_id=rr.tenant_id and es.id=rr.exam_series_id
  join public.persons p on p.tenant_id=rs.tenant_id and p.id=rs.student_person_id
  join public.student_profiles sp on sp.tenant_id=rs.tenant_id and sp.person_id=rs.student_person_id
  where rs.tenant_id=p_tenant_id and rs.id=v_snapshot;
  return v_result;
end;
$function$;

revoke all on function public.get_exam_report_card_v2(uuid,bigint,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_exam_report_card_v2(uuid,bigint,bigint,bigint,bigint) to service_role;
