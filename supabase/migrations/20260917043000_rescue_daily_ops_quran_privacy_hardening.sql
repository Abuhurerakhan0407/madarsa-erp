begin;

-- Broad administrative permissions may inspect all active students in their current branch.
-- Qur'an read/record/correct permissions alone never bypass teacher assignment isolation.
create or replace function public.quran_operator_is_privileged_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint
) returns boolean language sql stable security definer set search_path='' as $$
  select public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'settings.roles.manage')
      or public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage')
      or public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'academics.structure.manage');
$$;

revoke all on function public.quran_operator_is_privileged_v1(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.quran_operator_is_privileged_v1(uuid,bigint,bigint) to service_role;

create or replace function public.quran_operator_can_access_group_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_group_id bigint
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  v_teacher bigint;
  v_local_date date:=public.institution_local_date(p_tenant_id);
begin
  if not exists(
    select 1 from public.academic_groups g
    where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id
      and g.id=p_group_id and g.status='active'
  ) then return false; end if;
  if public.quran_operator_is_privileged_v1(p_identity_id,p_tenant_id,p_branch_id) then return true; end if;
  v_teacher:=public.quran_operator_teacher_person_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_teacher is null then return false; end if;
  return exists(select 1 from public.academic_groups g where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.id=p_group_id and g.status='active' and g.primary_teacher_person_id=v_teacher)
    or exists(select 1 from public.curriculum_teaching_assignments c join public.academic_groups g on g.tenant_id=c.tenant_id and g.id=c.group_id where c.tenant_id=p_tenant_id and g.branch_id=p_branch_id and c.group_id=p_group_id and c.teacher_person_id=v_teacher and c.status='active' and (c.starts_on is null or c.starts_on<=v_local_date) and (c.ends_on is null or c.ends_on>=v_local_date))
    or exists(select 1 from public.timetable_entries te where te.tenant_id=p_tenant_id and te.branch_id=p_branch_id and te.group_id=p_group_id and te.teacher_person_id=v_teacher and te.status='active' and te.effective_from<=v_local_date and (te.effective_to is null or te.effective_to>=v_local_date));
end;
$$;

create or replace function public.quran_operator_can_access_student_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  v_teacher bigint;
  v_group bigint;
  v_local_date date:=public.institution_local_date(p_tenant_id);
begin
  if not exists(
    select 1 from public.enrollments e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and e.student_person_id=p_student_person_id and e.status='active'
  ) then return false; end if;
  if public.quran_operator_is_privileged_v1(p_identity_id,p_tenant_id,p_branch_id) then return true; end if;
  v_teacher:=public.quran_operator_teacher_person_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_teacher is null then return false; end if;
  select e.group_id into v_group from public.enrollments e
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active'
  order by e.starts_on desc nulls last,e.id desc limit 1;
  if v_group is not null and public.quran_operator_can_access_group_v1(p_identity_id,p_tenant_id,p_branch_id,v_group) then return true; end if;
  return exists(select 1 from public.curriculum_teaching_assignments c where c.tenant_id=p_tenant_id and c.student_person_id=p_student_person_id and c.teacher_person_id=v_teacher and c.status='active' and (c.starts_on is null or c.starts_on<=v_local_date) and (c.ends_on is null or c.ends_on>=v_local_date));
end;
$$;

revoke all on function public.quran_operator_can_access_group_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.quran_operator_can_access_group_v1(uuid,bigint,bigint,bigint) to service_role;
revoke all on function public.quran_operator_can_access_student_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.quran_operator_can_access_student_v1(uuid,bigint,bigint,bigint) to service_role;
create or replace function public.get_quran_hifz_daily_register_v2(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_group_id bigint default null,p_session_date date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_result jsonb;
  v_teacher bigint;
  v_groups jsonb:='[]'::jsonb;
  v_rows jsonb:='[]'::jsonb;
  v_summary jsonb:='{}'::jsonb;
  v_date date;
begin
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'learning.recitation.read') then raise exception 'Quran recitation read permission denied'; end if;
  if public.quran_operator_is_privileged_v1(p_identity_id,p_tenant_id,p_branch_id) then
    return public.get_quran_hifz_daily_register_v1(p_identity_id,p_tenant_id,p_branch_id,p_group_id,p_session_date);
  end if;
  v_teacher:=public.quran_operator_teacher_person_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_teacher is null then raise exception 'Quran teacher assignment required'; end if;
  if p_group_id is not null and not exists(
    select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id and e.status='active'
      and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,e.student_person_id)
  ) then raise exception 'Quran group assignment permission denied'; end if;
  v_result:=public.get_quran_hifz_daily_register_v1(p_identity_id,p_tenant_id,p_branch_id,p_group_id,p_session_date);
  v_date:=coalesce(nullif(v_result->>'selected_date','')::date,public.institution_local_date(p_tenant_id));

  select coalesce(jsonb_agg(jsonb_set(g.value,'{students}',to_jsonb((
    select count(distinct e.student_person_id)::integer from public.enrollments e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.group_id=nullif(g.value->>'id','')::bigint and e.status='active'
      and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,e.student_person_id)
  )),true) order by coalesce(g.value->>'label',g.value->>'key')),'[]'::jsonb)
  into v_groups
  from jsonb_array_elements(coalesce(v_result->'groups','[]'::jsonb)) g(value)
  where exists(
    select 1 from public.enrollments e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.group_id=nullif(g.value->>'id','')::bigint and e.status='active'
      and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,e.student_person_id)
  );

  if p_group_id is not null then
    select coalesce(jsonb_agg(r.value order by coalesce(r.value->>'name',r.value->>'student_number')),'[]'::jsonb)
    into v_rows from jsonb_array_elements(coalesce(v_result->'rows','[]'::jsonb)) r(value)
    where public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,nullif(r.value->>'person_id','')::bigint);

    select jsonb_build_object(
      'students',(select count(distinct e.student_person_id) from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id and e.status='active' and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,e.student_person_id)),
      'recorded',(select count(distinct a.student_person_id) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date=v_date and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)),
      'needs_support',(select count(distinct a.student_person_id) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date=v_date and a.outcome='partial' and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)),
      'revision_due',(select count(*) from public.revision_obligations o where o.tenant_id=p_tenant_id and o.state in('due','assigned','attempted') and o.due_on<=v_date and exists(select 1 from public.enrollments e where e.tenant_id=o.tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id and e.student_person_id=o.student_person_id and e.status='active') and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,o.student_person_id)),
      'monthly_attempts',(select count(*) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date>=date_trunc('month',v_date)::date and rs.session_date<=v_date and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)),
      'monthly_average',(select round(avg(a.overall_score),1) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date>=date_trunc('month',v_date)::date and rs.session_date<=v_date and a.overall_score is not null and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id))
    ) into v_summary;
  else
    v_rows:='[]'::jsonb;
    v_summary:=jsonb_build_object('students',0,'recorded',0,'needs_support',0,'revision_due',0,'monthly_attempts',0,'monthly_average',null);
  end if;

  return jsonb_build_object(
    'local_date',v_result->>'local_date',
    'selected_date',v_result->>'selected_date',
    'selected_group_id',p_group_id,
    'groups',v_groups,
    'rows',v_rows,
    'summary',v_summary,
    'can_record',coalesce((v_result->>'can_record')::boolean,false)
  );
end;
$$;


create or replace function public.record_quran_hifz_daily_quick_v2(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_request_key text,p_group_id bigint,p_session_date date,p_student_person_id bigint,p_work_category text,p_action text,
 p_target jsonb default null,p_quality_score numeric default null,p_tajweed_score numeric default null,p_fluency_score numeric default null,p_mistake_count integer default 0,p_teacher_note text default null,p_next_target jsonb default null,p_revision_due_on date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_teacher bigint;begin
  if not exists(
    select 1 from public.enrollments e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id
      and e.student_person_id=p_student_person_id and e.status='active'
  ) then raise exception 'student is not actively enrolled in this Halaqah or group';end if;
  if not public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id) then raise exception 'Quran student assignment permission denied';end if;
  if lower(btrim(coalesce(p_action,''))) not in ('absent','no_lesson') and exists(select 1 from public.quran_student_targets t where t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.student_person_id=p_student_person_id and t.work_category=lower(btrim(coalesce(p_work_category,''))) and t.status='active' and t.assigned_on>p_session_date) then raise exception 'later active Quran target exists';end if;
  v_teacher:=public.quran_operator_teacher_person_v1(p_identity_id,p_tenant_id,p_branch_id);
  return public.record_quran_hifz_daily_quick_v1(p_identity_id,p_tenant_id,p_branch_id,p_request_key,p_group_id,p_session_date,p_student_person_id,p_work_category,p_action,p_target,p_quality_score,p_tajweed_score,p_fluency_score,p_mistake_count,v_teacher,p_teacher_note,p_next_target,p_revision_due_on);
end;$$;

revoke all on function public.get_quran_hifz_daily_register_v2(uuid,bigint,bigint,bigint,date) from public,anon,authenticated;
grant execute on function public.get_quran_hifz_daily_register_v2(uuid,bigint,bigint,bigint,date) to service_role;
revoke all on function public.record_quran_hifz_daily_quick_v2(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,text,jsonb,date) from public,anon,authenticated;
grant execute on function public.record_quran_hifz_daily_quick_v2(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,text,jsonb,date) to service_role;

create or replace function public.get_quran_hifz_workspace_v4(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_search text default null,p_page integer default 1,p_page_size integer default 40
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_search text:=nullif(btrim(coalesce(p_search,'')),'');
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_page_size integer:=least(greatest(coalesce(p_page_size,40),1),100);
  v_total integer:=0;
  v_rows jsonb:='[]'::jsonb;
  v_summary jsonb:='{}'::jsonb;
  v_can_record boolean:=false;
  v_local_date date:=public.institution_local_date(p_tenant_id);
begin
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'learning.recitation.read') then raise exception 'Quran recitation read permission denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch is required'; end if;
  v_can_record:=public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'learning.recitation.record');

  with active_students as(
    select distinct on(e.student_person_id)e.student_person_id,e.id enrollment_id,e.group_id,sp.student_number,p.display_name,p.name_native
    from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted') join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
      and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,e.student_person_id)
    order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  ) select count(*)::integer into v_total from active_students s where v_search is null or s.display_name ilike '%'||v_search||'%' or s.student_number ilike '%'||v_search||'%';

  with active_students as(
    select distinct on(e.student_person_id)e.student_person_id,e.id enrollment_id,e.group_id,sp.student_number,p.display_name,p.name_native
    from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted') join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
      and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,e.student_person_id)
    order by e.student_person_id,e.starts_on desc nulls last,e.id desc
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
    left join lateral(select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%sâ€“%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %sâ€“%s',a.page_start,a.page_end) end sabaq_label from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabaq' order by a.occurred_at desc,a.id desc limit 1)sb on true
    left join lateral(select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%sâ€“%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %sâ€“%s',a.page_start,a.page_end) end sabqi_label from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabqi' order by a.occurred_at desc,a.id desc limit 1)sq on true
    left join lateral(select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%sâ€“%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %sâ€“%s',a.page_start,a.page_end) end manzil_label from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='manzil' order by a.occurred_at desc,a.id desc limit 1)mn on true
  )x;

  select jsonb_build_object(
    'students',(select count(distinct e.student_person_id) from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted') where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active' and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,e.student_person_id)),
    'recorded_today',(select count(distinct a.student_person_id) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)),
    'attempts_today',(select count(*) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)),
    'revision_due',(select count(*) from public.revision_obligations r where r.tenant_id=p_tenant_id and r.state in('due','assigned','attempted') and r.due_on<=v_local_date and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,r.student_person_id)),
    'average_today',(select round(avg(a.overall_score),1) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and a.overall_score is not null and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)),
    'repeat_today',(select count(*) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and a.outcome='repeat' and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id))
  ) into v_summary;
  return jsonb_build_object('local_date',v_local_date,'summary',v_summary,'total',v_total,'page',v_page,'page_size',v_page_size,'rows',v_rows,'can_record',v_can_record);
end;
$$;

revoke all on function public.get_quran_hifz_workspace_v4(uuid,bigint,bigint,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_quran_hifz_workspace_v4(uuid,bigint,bigint,text,integer,integer) to service_role;

-- Retire direct service-role access to pre-scope RPCs. Governed scoped wrappers remain the only application entry points.
revoke execute on function public.record_quran_hifz_attempt(uuid,bigint,bigint,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,bigint,text,text,text,jsonb) from service_role;
revoke execute on function public.get_quran_hifz_workspace(uuid,bigint,bigint,text,integer,integer) from service_role;
revoke execute on function public.get_quran_hifz_workspace_v2(uuid,bigint,bigint,text,integer,integer) from service_role;
revoke execute on function public.get_quran_student_detail_v1(uuid,bigint,bigint,bigint,integer) from service_role;
revoke execute on function public.get_quran_juz_wall_v1(uuid,bigint,bigint,bigint) from service_role;
revoke execute on function public.get_quran_hifz_workspace_v3(uuid,bigint,bigint,text,integer,integer) from service_role;
revoke execute on function public.get_quran_hifz_daily_register_v1(uuid,bigint,bigint,bigint,date) from service_role;
revoke execute on function public.record_quran_hifz_daily_quick_v1(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,bigint,text,jsonb,date) from service_role;
revoke execute on function public.record_quran_hifz_attempt_idempotent(uuid,bigint,bigint,text,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,bigint,text,text,text,jsonb) from service_role;
revoke execute on function public.get_quran_student_detail_v2(uuid,bigint,bigint,bigint,integer) from service_role;
revoke execute on function public.get_quran_juz_wall_v2(uuid,bigint,bigint,bigint) from service_role;
revoke execute on function public.get_quran_revision_queue_v1(uuid,bigint,bigint,text,integer,integer) from service_role;
revoke execute on function public.correct_quran_recitation_attempt_v1(uuid,bigint,bigint,text,bigint,text,numeric,numeric,numeric,numeric,integer,text,text,text,text) from service_role;

commit;
