begin;

create or replace function public.quran_operator_teacher_person_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint)
returns bigint language sql stable security definer set search_path='' as $$
  select l.person_id
  from public.identity_person_links l
  join public.employee_profiles ep on ep.tenant_id=l.tenant_id and ep.person_id=l.person_id and ep.status='active'
  join public.hr_employments he on he.tenant_id=l.tenant_id and he.employee_person_id=l.person_id and he.branch_id=p_branch_id and he.state in('active','on_leave')
  where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='employee' and l.status='verified'
  order by l.updated_at desc,l.id desc limit 1;
$$;

create or replace function public.quran_operator_is_privileged_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
  select public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'settings.roles.manage')
      or public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage')
      or public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'academics.structure.manage')
      or public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'learning.recitation.correct');
$$;

create or replace function public.quran_operator_can_access_group_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_group_id bigint)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_teacher bigint;v_local_date date:=public.institution_local_date(p_tenant_id);begin
  if public.quran_operator_is_privileged_v1(p_identity_id,p_tenant_id,p_branch_id) then return true;end if;
  v_teacher:=public.quran_operator_teacher_person_v1(p_identity_id,p_tenant_id,p_branch_id);if v_teacher is null then return false;end if;
  return exists(select 1 from public.academic_groups g where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.id=p_group_id and g.status='active' and g.primary_teacher_person_id=v_teacher)
    or exists(select 1 from public.curriculum_teaching_assignments c join public.academic_groups g on g.tenant_id=c.tenant_id and g.id=c.group_id where c.tenant_id=p_tenant_id and g.branch_id=p_branch_id and c.group_id=p_group_id and c.teacher_person_id=v_teacher and c.status='active' and (c.starts_on is null or c.starts_on<=v_local_date) and (c.ends_on is null or c.ends_on>=v_local_date))
    or exists(select 1 from public.timetable_entries te where te.tenant_id=p_tenant_id and te.branch_id=p_branch_id and te.group_id=p_group_id and te.teacher_person_id=v_teacher and te.status='active' and te.effective_from<=v_local_date and (te.effective_to is null or te.effective_to>=v_local_date));
end;$$;

create or replace function public.quran_operator_can_access_student_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_teacher bigint;v_group bigint;v_local_date date:=public.institution_local_date(p_tenant_id);begin
  if public.quran_operator_is_privileged_v1(p_identity_id,p_tenant_id,p_branch_id) then return true;end if;
  v_teacher:=public.quran_operator_teacher_person_v1(p_identity_id,p_tenant_id,p_branch_id);if v_teacher is null then return false;end if;
  select e.group_id into v_group from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active' order by e.starts_on desc nulls last,e.id desc limit 1;
  if v_group is not null and public.quran_operator_can_access_group_v1(p_identity_id,p_tenant_id,p_branch_id,v_group) then return true;end if;
  return exists(select 1 from public.curriculum_teaching_assignments c where c.tenant_id=p_tenant_id and c.student_person_id=p_student_person_id and c.teacher_person_id=v_teacher and c.status='active' and (c.starts_on is null or c.starts_on<=v_local_date) and (c.ends_on is null or c.ends_on>=v_local_date));
end;$$;

create or replace function public.get_quran_hifz_daily_register_v2(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_group_id bigint default null,p_session_date date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_teacher bigint;v_groups jsonb;begin
  v_result:=public.get_quran_hifz_daily_register_v1(p_identity_id,p_tenant_id,p_branch_id,p_group_id,p_session_date);
  if public.quran_operator_is_privileged_v1(p_identity_id,p_tenant_id,p_branch_id) then return v_result;end if;
  v_teacher:=public.quran_operator_teacher_person_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_teacher is null then raise exception 'Quran teacher assignment required';end if;
  if p_group_id is not null then
    if not public.quran_operator_can_access_group_v1(p_identity_id,p_tenant_id,p_branch_id,p_group_id) then raise exception 'Quran group assignment permission denied';end if;
    return v_result;
  end if;
  select coalesce(jsonb_agg(g.value order by coalesce(g.value->>'label',g.value->>'key')),'[]'::jsonb) into v_groups from jsonb_array_elements(coalesce(v_result->'groups','[]'::jsonb)) g(value) where public.quran_operator_can_access_group_v1(p_identity_id,p_tenant_id,p_branch_id,nullif(g.value->>'id','')::bigint);
  return jsonb_set(v_result,'{groups}',coalesce(v_groups,'[]'::jsonb),true);
end;$$;

create or replace function public.record_quran_hifz_daily_quick_v2(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_request_key text,p_group_id bigint,p_session_date date,p_student_person_id bigint,p_work_category text,p_action text,
 p_target jsonb default null,p_quality_score numeric default null,p_tajweed_score numeric default null,p_fluency_score numeric default null,p_mistake_count integer default 0,p_teacher_note text default null,p_next_target jsonb default null,p_revision_due_on date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_teacher bigint;begin
  if not public.quran_operator_can_access_group_v1(p_identity_id,p_tenant_id,p_branch_id,p_group_id) then raise exception 'Quran group assignment permission denied';end if;
  if not public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id) then raise exception 'Quran student assignment permission denied';end if;
  if lower(btrim(coalesce(p_action,''))) not in ('absent','no_lesson') and exists(select 1 from public.quran_student_targets t where t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.student_person_id=p_student_person_id and t.work_category=lower(btrim(coalesce(p_work_category,''))) and t.status='active' and t.assigned_on>p_session_date) then raise exception 'later active Quran target exists';end if;
  v_teacher:=public.quran_operator_teacher_person_v1(p_identity_id,p_tenant_id,p_branch_id);
  return public.record_quran_hifz_daily_quick_v1(p_identity_id,p_tenant_id,p_branch_id,p_request_key,p_group_id,p_session_date,p_student_person_id,p_work_category,p_action,p_target,p_quality_score,p_tajweed_score,p_fluency_score,p_mistake_count,v_teacher,p_teacher_note,p_next_target,p_revision_due_on);
end;$$;

create or replace function public.record_quran_hifz_attempt_scoped_v1(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_request_key text,p_student_person_id bigint,p_work_category text,
 p_juz_number smallint default null,p_start_surah_number smallint default null,p_start_ayah_number integer default null,p_end_surah_number smallint default null,p_end_ayah_number integer default null,p_page_start integer default null,p_page_end integer default null,
 p_accuracy_score numeric default null,p_fluency_score numeric default null,p_tajweed_score numeric default null,p_overall_score numeric default null,p_prompts integer default null,p_outcome text default 'passed',p_teacher_remark text default null,p_parent_visible_remark text default null,p_private_note text default null,p_mistakes jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_teacher bigint;begin
  if not public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id) then raise exception 'Quran student assignment permission denied';end if;
  v_teacher:=public.quran_operator_teacher_person_v1(p_identity_id,p_tenant_id,p_branch_id);
  return public.record_quran_hifz_attempt_idempotent(p_identity_id,p_tenant_id,p_branch_id,p_request_key,p_student_person_id,p_work_category,p_juz_number,p_start_surah_number,p_start_ayah_number,p_end_surah_number,p_end_ayah_number,p_page_start,p_page_end,p_accuracy_score,p_fluency_score,p_tajweed_score,p_overall_score,p_prompts,p_outcome,v_teacher,p_teacher_remark,p_parent_visible_remark,p_private_note,p_mistakes);
end;$$;

create or replace function public.get_quran_student_detail_scoped_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_limit integer default 60)
returns jsonb language plpgsql security definer set search_path='' as $$begin
  if not public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id) then raise exception 'Quran student assignment permission denied';end if;
  return public.get_quran_student_detail_v2(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id,p_limit);
end;$$;

create or replace function public.get_quran_juz_wall_scoped_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$begin
  if not public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id) then raise exception 'Quran student assignment permission denied';end if;
  return public.get_quran_juz_wall_v2(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id);
end;$$;

create or replace function public.get_quran_revision_queue_v2(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_state text default 'open',p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_page integer:=greatest(coalesce(p_page,1),1);v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);v_local_date date:=public.institution_local_date(p_tenant_id);v_total integer;v_rows jsonb;begin
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'learning.recitation.read') then raise exception 'Quran recitation read permission denied';end if;
  select count(*)::integer into v_total from public.revision_obligations r where r.tenant_id=p_tenant_id and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,r.student_person_id) and ((p_state='open' and r.state in('due','assigned','attempted')) or (p_state='completed' and r.state='completed') or p_state='all');
  select coalesce(jsonb_agg(row_to_json(x) order by x.due_on,x.name),'[]'::jsonb) into v_rows from(select r.id,r.student_person_id,p.display_name name,sp.student_number,r.source_type,r.source_key,r.due_on,r.state,(r.due_on<v_local_date and r.state in('due','assigned','attempted')) overdue,r.created_at from public.revision_obligations r join public.persons p on p.tenant_id=r.tenant_id and p.id=r.student_person_id join public.student_profiles sp on sp.tenant_id=r.tenant_id and sp.person_id=r.student_person_id where r.tenant_id=p_tenant_id and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,r.student_person_id) and ((p_state='open' and r.state in('due','assigned','attempted')) or (p_state='completed' and r.state='completed') or p_state='all') order by r.due_on,p.display_name limit v_size offset((v_page-1)*v_size))x;
  return jsonb_build_object('local_date',v_local_date,'total',v_total,'page',v_page,'page_size',v_size,'rows',v_rows);
end;$$;

create or replace function public.correct_quran_recitation_attempt_scoped_v1(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_request_key text,p_recitation_attempt_id bigint,p_reason text,
 p_accuracy_score numeric,p_fluency_score numeric,p_tajweed_score numeric,p_overall_score numeric,p_prompts integer,p_outcome text,p_teacher_remark text default null,p_parent_visible_remark text default null,p_private_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_student bigint;begin
  select a.student_person_id into v_student from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.id=p_recitation_attempt_id and rs.branch_id=p_branch_id limit 1;
  if v_student is null then raise exception 'recitation attempt not found';end if;
  if not public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,v_student) then raise exception 'Quran student assignment permission denied';end if;
  return public.correct_quran_recitation_attempt_v1(p_identity_id,p_tenant_id,p_branch_id,p_request_key,p_recitation_attempt_id,p_reason,p_accuracy_score,p_fluency_score,p_tajweed_score,p_overall_score,p_prompts,p_outcome,p_teacher_remark,p_parent_visible_remark,p_private_note);
end;$$;

revoke all on function public.quran_operator_teacher_person_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.quran_operator_is_privileged_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.quran_operator_can_access_group_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.quran_operator_can_access_student_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.get_quran_hifz_daily_register_v2(uuid,bigint,bigint,bigint,date) from public,anon,authenticated;
revoke all on function public.record_quran_hifz_daily_quick_v2(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,text,jsonb,date) from public,anon,authenticated;
revoke all on function public.record_quran_hifz_attempt_scoped_v1(uuid,bigint,bigint,text,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.get_quran_student_detail_scoped_v1(uuid,bigint,bigint,bigint,integer) from public,anon,authenticated;
revoke all on function public.get_quran_juz_wall_scoped_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.get_quran_revision_queue_v2(uuid,bigint,bigint,text,integer,integer) from public,anon,authenticated;
revoke all on function public.correct_quran_recitation_attempt_scoped_v1(uuid,bigint,bigint,text,bigint,text,numeric,numeric,numeric,numeric,integer,text,text,text,text) from public,anon,authenticated;

grant execute on function public.get_quran_hifz_daily_register_v2(uuid,bigint,bigint,bigint,date) to service_role;
grant execute on function public.record_quran_hifz_daily_quick_v2(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,text,jsonb,date) to service_role;
grant execute on function public.record_quran_hifz_attempt_scoped_v1(uuid,bigint,bigint,text,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,text,text,text,jsonb) to service_role;
grant execute on function public.get_quran_student_detail_scoped_v1(uuid,bigint,bigint,bigint,integer) to service_role;
grant execute on function public.get_quran_juz_wall_scoped_v1(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.get_quran_revision_queue_v2(uuid,bigint,bigint,text,integer,integer) to service_role;
grant execute on function public.correct_quran_recitation_attempt_scoped_v1(uuid,bigint,bigint,text,bigint,text,numeric,numeric,numeric,numeric,integer,text,text,text,text) to service_role;

commit;
