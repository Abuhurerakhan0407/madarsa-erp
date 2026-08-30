create view public.quran_effective_recitation_attempts_v1
with (security_invoker=true)
as
select
  a.id,a.tenant_id,a.recitation_session_id,a.learning_plan_id,a.learning_plan_item_id,a.student_person_id,a.attendance_record_id,a.edition_id,
  a.work_category,a.start_reference_id,a.end_reference_id,a.reading_unit_id,a.attempt_number,
  case when c.id is not null then c.accuracy_score else a.accuracy_score end as accuracy_score,
  case when c.id is not null then c.fluency_score else a.fluency_score end as fluency_score,
  case when c.id is not null then c.tajweed_score else a.tajweed_score end as tajweed_score,
  case when c.id is not null then c.overall_score else a.overall_score end as overall_score,
  case when c.id is not null then c.prompts else a.prompts end as prompts,
  case when c.id is not null then c.outcome else a.outcome end as outcome,
  case when c.id is not null then c.private_note else a.private_note end as private_note,
  case when c.id is not null then c.teacher_remark else a.teacher_remark end as teacher_remark,
  case when c.id is not null then c.parent_visible_remark else a.parent_visible_remark end as parent_visible_remark,
  a.evaluation_snapshot,a.occurred_at,a.created_at,a.juz_number,a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number,a.page_start,a.page_end,
  c.id as correction_id,c.reason as correction_reason,c.created_at as corrected_at,c.corrected_by_identity_id,c.corrected_by_membership_id
from public.recitation_attempts a
left join lateral (
  select x.* from public.recitation_attempt_corrections x
  where x.tenant_id=a.tenant_id and x.recitation_attempt_id=a.id
  order by x.created_at desc,x.id desc limit 1
) c on true;

revoke all on public.quran_effective_recitation_attempts_v1 from public,anon,authenticated;
grant select on public.quran_effective_recitation_attempts_v1 to service_role;

create or replace function public.get_quran_hifz_workspace_v3(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_search text default null,p_page integer default 1,p_page_size integer default 40
) returns jsonb language plpgsql set search_path to '' as $function$
declare
  v_membership_id bigint;v_search text:=nullif(btrim(coalesce(p_search,'')),'');v_page integer:=greatest(coalesce(p_page,1),1);v_page_size integer:=least(greatest(coalesce(p_page_size,40),1),100);
  v_total integer:=0;v_rows jsonb:='[]'::jsonb;v_summary jsonb:='{}'::jsonb;v_can_record boolean:=false;v_local_date date:=public.institution_local_date(p_tenant_id);
begin
  select m.id into v_membership_id from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.read')
    order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation read permission denied';end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code='learning.recitation.record') into v_can_record;

  with active_students as(
    select distinct on(e.student_person_id)e.student_person_id,e.id enrollment_id,e.group_id,sp.student_number,p.display_name,p.name_native
    from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted') join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active' order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  ) select count(*)::integer into v_total from active_students s where v_search is null or s.display_name ilike '%'||v_search||'%' or s.student_number ilike '%'||v_search||'%';

  with active_students as(
    select distinct on(e.student_person_id)e.student_person_id,e.id enrollment_id,e.group_id,sp.student_number,p.display_name,p.name_native
    from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted') join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active' order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  ),page_students as(
    select s.* from active_students s where v_search is null or s.display_name ilike '%'||v_search||'%' or s.student_number ilike '%'||v_search||'%'
    order by s.display_name,s.student_person_id limit v_page_size offset((v_page-1)*v_page_size)
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.person_id),'[]'::jsonb) into v_rows from(
    select s.student_person_id person_id,s.display_name name,s.name_native,s.student_number,s.group_id,coalesce(g.labels->>'en',g.key) group_name,
      la.occurred_at last_recorded_at,la.work_category last_work_category,la.outcome last_outcome,la.overall_score last_overall_score,la.juz_number last_juz_number,
      coalesce(rv.due_count,0) revision_due,coalesce(mj.passed_juz,0) memorized_juz,sb.sabaq_label,sq.sabqi_label,mn.manzil_label
    from page_students s left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=s.group_id
    left join lateral(select a.* from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id order by a.occurred_at desc,a.id desc limit 1)la on true
    left join lateral(select count(*)::integer due_count from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=s.student_person_id and r.state in('due','assigned','attempted') and r.due_on<=v_local_date)rv on true
    left join lateral(select count(distinct a.juz_number)::integer passed_juz from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabaq' and a.outcome='passed' and a.juz_number is not null)mj on true
    left join lateral(select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end sabaq_label from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabaq' order by a.occurred_at desc,a.id desc limit 1)sb on true
    left join lateral(select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end sabqi_label from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabqi' order by a.occurred_at desc,a.id desc limit 1)sq on true
    left join lateral(select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end manzil_label from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='manzil' order by a.occurred_at desc,a.id desc limit 1)mn on true
  )x;

  select jsonb_build_object(
    'students',(select count(distinct e.student_person_id) from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted') where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'),
    'recorded_today',(select count(distinct a.student_person_id) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date),
    'attempts_today',(select count(*) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date),
    'revision_due',(select count(*) from public.revision_obligations r where r.tenant_id=p_tenant_id and r.state in('due','assigned','attempted') and r.due_on<=v_local_date and exists(select 1 from public.enrollments e where e.tenant_id=r.tenant_id and e.student_person_id=r.student_person_id and e.branch_id=p_branch_id and e.status='active')),
    'average_today',(select round(avg(a.overall_score),1) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and a.overall_score is not null),
    'repeat_today',(select count(*) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and a.outcome='repeat')
  ) into v_summary;
  return jsonb_build_object('local_date',v_local_date,'summary',v_summary,'total',v_total,'page',v_page,'page_size',v_page_size,'rows',v_rows,'can_record',v_can_record);
end;$function$;

create or replace function public.get_quran_juz_wall_v2(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint)
returns jsonb language plpgsql set search_path to '' as $function$
declare v_membership_id bigint;v_wall jsonb;
begin
  select m.id into v_membership_id from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.read') order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation read permission denied';end if;
  if not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active') then raise exception 'student is not actively enrolled in this branch';end if;
  select coalesce(jsonb_agg(jsonb_build_object('juz',j,'status',coalesce(x.outcome,'not_started'),'work_category',x.work_category,'score',x.overall_score,'recorded_at',x.occurred_at,'correction_id',x.correction_id) order by j),'[]'::jsonb) into v_wall
  from generate_series(1,30) j left join lateral(select a.outcome,a.work_category,a.overall_score,a.occurred_at,a.correction_id from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id and a.juz_number=j and a.work_category in('sabaq','sabqi','manzil') order by a.occurred_at desc,a.id desc limit 1)x on true;
  return v_wall;
end;$function$;

create or replace function public.get_quran_student_detail_v2(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_limit integer default 60)
returns jsonb language plpgsql set search_path to '' as $function$
declare
  v_membership_id bigint;v_can_correct boolean:=false;v_limit integer:=least(greatest(coalesce(p_limit,60),1),200);v_student jsonb;v_summary jsonb;v_attempts jsonb;v_mistakes jsonb;v_revisions jsonb;
begin
  select m.id into v_membership_id from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.read') order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation read permission denied';end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code='learning.recitation.correct') into v_can_correct;
  select jsonb_build_object('person_id',p.id,'name',p.display_name,'name_native',p.name_native,'student_number',sp.student_number,'group_id',e.group_id,'group_name',coalesce(g.labels->>'en',g.key)) into v_student
  from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active' and sp.status in('active','admitted') order by e.starts_on desc nulls last,e.id desc limit 1;
  if v_student is null then raise exception 'student is not actively enrolled in this branch';end if;
  select jsonb_build_object('attempts',count(*),'average_score',round(avg(a.overall_score),1),'passed',count(*) filter(where a.outcome='passed'),'repeat',count(*) filter(where a.outcome='repeat'),'last_recorded_at',max(a.occurred_at),'open_revision',(select count(*) from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=p_student_person_id and r.state in('due','assigned','attempted'))) into v_summary
  from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id;
  select coalesce(jsonb_agg(row_to_json(x) order by x.occurred_at desc,x.id desc),'[]'::jsonb) into v_attempts from(
    select a.id,a.work_category,a.outcome,a.accuracy_score,a.fluency_score,a.tajweed_score,a.overall_score,a.prompts,a.teacher_remark,a.parent_visible_remark,a.private_note,a.occurred_at,a.correction_id,a.correction_reason,a.corrected_at,
      case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end target_label,
      (select coalesce(jsonb_agg(jsonb_build_object('category',m.category_key,'severity',m.severity,'count',m.count,'note',m.note) order by m.id),'[]'::jsonb) from public.recitation_mistakes m where m.tenant_id=a.tenant_id and m.recitation_attempt_id=a.id) mistakes
    from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id order by a.occurred_at desc,a.id desc limit v_limit
  )x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.total_count desc,x.category),'[]'::jsonb) into v_mistakes from(select m.category_key category,sum(m.count)::integer total_count,max(m.severity) max_severity,count(distinct m.recitation_attempt_id)::integer sessions from public.recitation_mistakes m join public.quran_effective_recitation_attempts_v1 a on a.tenant_id=m.tenant_id and a.id=m.recitation_attempt_id join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where m.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id group by m.category_key)x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.due_on,x.id),'[]'::jsonb) into v_revisions from(select r.id,r.source_type,r.source_key,r.due_on,r.state,r.created_at,r.completed_by_attempt_id from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=p_student_person_id and r.state<>'cancelled' order by r.due_on desc limit 100)x;
  return jsonb_build_object('student',v_student,'summary',v_summary,'attempts',v_attempts,'mistake_summary',v_mistakes,'revisions',v_revisions,'can_correct',v_can_correct);
end;$function$;

revoke execute on function public.get_quran_hifz_workspace_v3(uuid,bigint,bigint,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_quran_hifz_workspace_v3(uuid,bigint,bigint,text,integer,integer) to service_role;
revoke execute on function public.get_quran_juz_wall_v2(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_quran_juz_wall_v2(uuid,bigint,bigint,bigint) to service_role;
revoke execute on function public.get_quran_student_detail_v2(uuid,bigint,bigint,bigint,integer) from public,anon,authenticated;
grant execute on function public.get_quran_student_detail_v2(uuid,bigint,bigint,bigint,integer) to service_role;
