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

revoke all on function public.record_exam_mark_v1(uuid,bigint,bigint,bigint,bigint,text,numeric,text) from public,anon,authenticated;
revoke all on function public.moderate_exam_mark_v1(uuid,bigint,bigint,bigint,numeric,text) from public,anon,authenticated;
grant execute on function public.record_exam_mark_v1(uuid,bigint,bigint,bigint,bigint,text,numeric,text) to service_role;
grant execute on function public.moderate_exam_mark_v1(uuid,bigint,bigint,bigint,numeric,text) to service_role;
