create or replace function public.get_exam_setup_options_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_membership_id bigint;
  v_can_create boolean := false;
begin
  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id
    and m.identity_id=p_identity_id
    and m.status='active'
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
    and (
      m.all_branches
      or exists(
        select 1 from public.membership_branch_scopes s
        where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id
      )
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'active branch membership required';
  end if;

  select exists(
    select 1
    from public.membership_roles mr
    join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
    where mr.tenant_id=p_tenant_id
      and mr.membership_id=v_membership_id
      and rp.permission_code='assessment.setup.manage'
  ) into v_can_create;

  return jsonb_build_object(
    'can_create',v_can_create,
    'groups',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',g.id,
        'label',coalesce(g.labels->>'en',g.key),
        'labels',g.labels,
        'session_id',g.session_id,
        'session_label',coalesce(s.labels->>'en',s.key),
        'program_id',g.program_id,
        'program_label',coalesce(p.labels->>'en',p.key),
        'candidate_count',(
          select count(*)
          from public.enrollments e
          where e.tenant_id=g.tenant_id and e.branch_id=g.branch_id
            and e.session_id=g.session_id and e.program_id=g.program_id
            and e.group_id=g.id and e.status='active'
        )
      ) order by p.key,g.key)
      from public.academic_groups g
      join public.academic_sessions s on s.tenant_id=g.tenant_id and s.id=g.session_id
      join public.programs p on p.tenant_id=g.tenant_id and p.id=g.program_id
      where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id
        and g.status='active' and s.status='active' and p.status='active'
        and current_date between s.starts_on and s.ends_on
    ),'[]'::jsonb),
    'subjects',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'key',s.key,'label',coalesce(s.labels->>'en',s.key),'labels',s.labels
      ) order by s.key)
      from public.subjects s
      where s.tenant_id=p_tenant_id and s.status='active'
    ),'[]'::jsonb),
    'evaluators',coalesce((
      select jsonb_agg(jsonb_build_object(
        'person_id',e.employee_person_id,
        'name',p.display_name,
        'employee_number',e.employee_number,
        'designation',e.designation_key
      ) order by p.display_name)
      from public.hr_employments e
      join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.state='active'
    ),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.create_exam_series_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_group_id bigint,
  p_key text,
  p_labels jsonb,
  p_starts_on date,
  p_ends_on date,
  p_evaluator_person_id bigint,
  p_subject_ids bigint[]
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_membership_id bigint;
  v_key text := lower(btrim(coalesce(p_key,'')));
  v_label text := btrim(coalesce(p_labels->>'en',''));
  v_session_id bigint;
  v_program_id bigint;
  v_curriculum_id bigint;
  v_grading_id bigint;
  v_exam_id bigint;
  v_exam_subject_id bigint;
  v_subject_count integer;
  v_subject record;
begin
  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id
    and m.identity_id=p_identity_id
    and m.status='active'
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
    and (
      m.all_branches
      or exists(
        select 1 from public.membership_branch_scopes s
        where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id
      )
    )
    and exists(
      select 1
      from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id
        and rp.permission_code='assessment.setup.manage'
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then raise exception 'exam setup permission denied'; end if;
  if v_key !~ '^[a-z0-9][a-z0-9_]{2,63}$' then raise exception 'exam key must use lowercase letters, numbers, and underscores'; end if;
  if length(v_label) not between 3 and 120 then raise exception 'exam title must be between 3 and 120 characters'; end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on then raise exception 'valid exam dates are required'; end if;
  if p_subject_ids is null or cardinality(p_subject_ids)<1 or cardinality(p_subject_ids)>12 then raise exception 'select between 1 and 12 subjects'; end if;
  if p_evaluator_person_id is null then raise exception 'evaluator is required'; end if;

  select g.session_id,g.program_id into v_session_id,v_program_id
  from public.academic_groups g
  join public.academic_sessions s on s.tenant_id=g.tenant_id and s.id=g.session_id
  join public.programs p on p.tenant_id=g.tenant_id and p.id=g.program_id
  where g.tenant_id=p_tenant_id and g.id=p_group_id and g.branch_id=p_branch_id
    and g.status='active' and s.status='active' and p.status='active'
    and current_date between s.starts_on and s.ends_on;
  if v_session_id is null then raise exception 'active exam group is required'; end if;

  if not exists(
    select 1 from public.hr_employments e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and e.employee_person_id=p_evaluator_person_id and e.state='active'
  ) then raise exception 'active evaluator is required'; end if;

  select count(distinct s.id)::integer into v_subject_count
  from public.subjects s
  where s.tenant_id=p_tenant_id and s.status='active' and s.id=any(p_subject_ids);
  if v_subject_count<>cardinality(p_subject_ids) then raise exception 'one or more selected subjects are invalid'; end if;

  select cv.id into v_curriculum_id
  from public.curriculum_versions cv
  where cv.tenant_id=p_tenant_id and cv.program_id=v_program_id and cv.state='published'
  order by cv.version desc,cv.id desc limit 1;
  if v_curriculum_id is null then raise exception 'published curriculum is required'; end if;

  select gv.id into v_grading_id
  from public.grading_scale_versions gv
  where gv.tenant_id=p_tenant_id and gv.state='published'
  order by (gv.key='standard_percentage') desc,gv.version desc,gv.id desc limit 1;
  if v_grading_id is null then raise exception 'published grading scale is required'; end if;

  if exists(
    select 1 from public.exam_series es
    where es.tenant_id=p_tenant_id and es.branch_id=p_branch_id
      and es.session_id=v_session_id and es.key=v_key
  ) then raise exception 'exam key already exists for this session'; end if;

  insert into public.exam_series(
    tenant_id,branch_id,session_id,program_id,group_id,curriculum_version_id,grading_scale_version_id,
    key,labels,starts_on,ends_on,state,publication_policy,ranking_enabled,rules_snapshot
  ) values(
    p_tenant_id,p_branch_id,v_session_id,v_program_id,p_group_id,v_curriculum_id,v_grading_id,
    v_key,p_labels,p_starts_on,p_ends_on,'marks_open',
    jsonb_build_object('audience','portal','report_card',true),false,
    jsonb_build_object('pass_each_subject',true,'pass_marks',40)
  ) returning id into v_exam_id;

  for v_subject in
    select s.id,s.key,s.labels
    from public.subjects s
    where s.tenant_id=p_tenant_id and s.status='active' and s.id=any(p_subject_ids)
    order by s.key
  loop
    insert into public.exam_subjects(
      tenant_id,exam_series_id,subject_id,evaluator_person_id,maximum_marks,pass_marks,weight,optional,rules_snapshot
    ) values(
      p_tenant_id,v_exam_id,v_subject.id,p_evaluator_person_id,100,40,100,false,jsonb_build_object('grading','percentage')
    ) returning id into v_exam_subject_id;

    insert into public.assessment_components(
      tenant_id,exam_subject_id,key,labels,entry_mode,maximum_marks,pass_marks,weight,required,sequence
    ) values(
      p_tenant_id,v_exam_subject_id,'written',
      jsonb_build_object('en','Written examination','ur','تحریری امتحان','ar','الاختبار التحريري'),
      'marks',100,40,100,true,1
    );

    insert into public.marksheets(
      tenant_id,exam_subject_id,group_id,evaluator_person_id,state,version,idempotency_key
    ) values(
      p_tenant_id,v_exam_subject_id,p_group_id,p_evaluator_person_id,'draft',1,
      'exam-'||v_exam_id::text||'-subject-'||v_subject.id::text||'-group-'||p_group_id::text
    );
  end loop;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'assessment.exam.create','succeeded','exam_series',v_exam_id::text,
    gen_random_uuid(),jsonb_build_object('key',v_key,'group_id',p_group_id,'subjects',v_subject_count,'starts_on',p_starts_on,'ends_on',p_ends_on)
  );

  return jsonb_build_object('exam_series_id',v_exam_id,'key',v_key,'state','marks_open','subject_count',v_subject_count);
end;
$function$;

revoke all on function public.get_exam_setup_options_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.create_exam_series_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date,bigint,bigint[]) from public,anon,authenticated;
grant execute on function public.get_exam_setup_options_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.create_exam_series_v1(uuid,bigint,bigint,bigint,text,jsonb,date,date,bigint,bigint[]) to service_role;
