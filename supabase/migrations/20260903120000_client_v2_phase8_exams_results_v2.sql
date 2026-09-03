-- Client V2 Phase 8 — focused Exams & Results workflows without weakening the existing result state machine.

create or replace function public.create_exam_series_v2(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_group_id bigint,
  p_key text,
  p_labels jsonb,
  p_exam_type text,
  p_starts_on date,
  p_ends_on date,
  p_evaluator_person_id bigint,
  p_subject_ids bigint[],
  p_maximum_marks numeric default 100,
  p_pass_marks numeric default 40,
  p_grading_scale_version_id bigint default null,
  p_ranking_enabled boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $function$
declare
  v_membership_id bigint;
  v_key text:=lower(btrim(coalesce(p_key,'')));
  v_label text:=btrim(coalesce(p_labels->>'en',''));
  v_exam_type text:=lower(btrim(coalesce(p_exam_type,'custom')));
  v_session_id bigint;v_program_id bigint;v_curriculum_id bigint;v_grading_id bigint;v_exam_id bigint;v_exam_subject_id bigint;v_subject_count integer;v_subject record;
begin
  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='assessment.setup.manage')
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'exam setup permission denied';end if;
  if v_key !~ '^[a-z0-9][a-z0-9_]{2,63}$' then raise exception 'exam key must use lowercase letters, numbers, and underscores';end if;
  if length(v_label) not between 3 and 120 then raise exception 'exam title must be between 3 and 120 characters';end if;
  if v_exam_type !~ '^[a-z][a-z0-9_]{1,63}$' then raise exception 'exam type is invalid';end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on then raise exception 'valid exam dates are required';end if;
  if p_subject_ids is null or cardinality(p_subject_ids)<1 or cardinality(p_subject_ids)>12 then raise exception 'select between 1 and 12 subjects';end if;
  if p_evaluator_person_id is null then raise exception 'evaluator is required';end if;
  if p_maximum_marks is null or p_maximum_marks<=0 or p_maximum_marks>10000 then raise exception 'maximum marks must be greater than zero';end if;
  if p_pass_marks is null or p_pass_marks<0 or p_pass_marks>p_maximum_marks then raise exception 'pass marks must be between zero and maximum marks';end if;

  select g.session_id,g.program_id into v_session_id,v_program_id
  from public.academic_groups g
  join public.academic_sessions s on s.tenant_id=g.tenant_id and s.id=g.session_id
  join public.programs p on p.tenant_id=g.tenant_id and p.id=g.program_id
  where g.tenant_id=p_tenant_id and g.id=p_group_id and g.branch_id=p_branch_id and g.status='active' and s.status='active' and p.status='active' and current_date between s.starts_on and s.ends_on;
  if v_session_id is null then raise exception 'active exam group is required';end if;
  if not exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.employee_person_id=p_evaluator_person_id and e.state='active') then raise exception 'active evaluator is required';end if;
  select count(distinct s.id)::integer into v_subject_count from public.subjects s where s.tenant_id=p_tenant_id and s.status='active' and s.id=any(p_subject_ids);
  if v_subject_count<>cardinality(p_subject_ids) then raise exception 'one or more selected subjects are invalid';end if;
  select cv.id into v_curriculum_id from public.curriculum_versions cv where cv.tenant_id=p_tenant_id and cv.program_id=v_program_id and cv.state='published' order by cv.version desc,cv.id desc limit 1;
  if v_curriculum_id is null then raise exception 'published curriculum is required';end if;

  if p_grading_scale_version_id is null then
    select gv.id into v_grading_id from public.grading_scale_versions gv where gv.tenant_id=p_tenant_id and gv.state='published' order by (gv.key='standard_percentage') desc,gv.version desc,gv.id desc limit 1;
  else
    select gv.id into v_grading_id from public.grading_scale_versions gv where gv.tenant_id=p_tenant_id and gv.id=p_grading_scale_version_id and gv.state='published';
  end if;
  if v_grading_id is null then raise exception 'published grading scale is required';end if;
  if exists(select 1 from public.exam_series es where es.tenant_id=p_tenant_id and es.branch_id=p_branch_id and es.session_id=v_session_id and es.key=v_key) then raise exception 'exam key already exists for this session';end if;

  insert into public.exam_series(tenant_id,branch_id,session_id,program_id,group_id,curriculum_version_id,grading_scale_version_id,key,labels,starts_on,ends_on,state,publication_policy,ranking_enabled,rules_snapshot)
  values(p_tenant_id,p_branch_id,v_session_id,v_program_id,p_group_id,v_curriculum_id,v_grading_id,v_key,p_labels,p_starts_on,p_ends_on,'marks_open',jsonb_build_object('audience','portal','report_card',true),coalesce(p_ranking_enabled,false),jsonb_build_object('exam_type',v_exam_type,'pass_each_subject',true,'maximum_marks',p_maximum_marks,'pass_marks',p_pass_marks)) returning id into v_exam_id;

  for v_subject in select s.id,s.key,s.labels from public.subjects s where s.tenant_id=p_tenant_id and s.status='active' and s.id=any(p_subject_ids) order by s.key loop
    insert into public.exam_subjects(tenant_id,exam_series_id,subject_id,evaluator_person_id,maximum_marks,pass_marks,weight,optional,rules_snapshot)
    values(p_tenant_id,v_exam_id,v_subject.id,p_evaluator_person_id,p_maximum_marks,p_pass_marks,100,false,jsonb_build_object('grading','selected_scale','exam_type',v_exam_type)) returning id into v_exam_subject_id;
    insert into public.assessment_components(tenant_id,exam_subject_id,key,labels,entry_mode,maximum_marks,pass_marks,weight,required,sequence)
    values(p_tenant_id,v_exam_subject_id,'primary',jsonb_build_object('en','Primary assessment','ur','بنیادی امتحان','ar','التقييم الأساسي'),'marks',p_maximum_marks,p_pass_marks,100,true,1);
    insert into public.marksheets(tenant_id,exam_subject_id,group_id,evaluator_person_id,state,version,idempotency_key)
    values(p_tenant_id,v_exam_subject_id,p_group_id,p_evaluator_person_id,'draft',1,'exam-'||v_exam_id::text||'-subject-'||v_subject.id::text||'-group-'||p_group_id::text);
  end loop;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'assessment.exam.create','succeeded','exam_series',v_exam_id::text,gen_random_uuid(),jsonb_build_object('key',v_key,'exam_type',v_exam_type,'group_id',p_group_id,'subjects',v_subject_count,'starts_on',p_starts_on,'ends_on',p_ends_on,'maximum_marks',p_maximum_marks,'pass_marks',p_pass_marks,'grading_scale_version_id',v_grading_id,'ranking_enabled',coalesce(p_ranking_enabled,false)));
  return jsonb_build_object('exam_series_id',v_exam_id,'key',v_key,'state','marks_open','subject_count',v_subject_count,'exam_type',v_exam_type);
end;
$function$;

create or replace function public.get_exam_setup_options_v2(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $function$
declare v_membership_id bigint;v_can_create boolean:=false;begin
  select m.id into v_membership_id from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'active branch membership required';end if;
  select exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code='assessment.setup.manage') into v_can_create;
  return jsonb_build_object(
    'can_create',v_can_create,
    'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'label',coalesce(g.labels->>'en',g.key),'labels',g.labels,'session_id',g.session_id,'session_label',coalesce(s.labels->>'en',s.key),'program_id',g.program_id,'program_label',coalesce(p.labels->>'en',p.key),'candidate_count',(select count(*) from public.enrollments e where e.tenant_id=g.tenant_id and e.branch_id=g.branch_id and e.session_id=g.session_id and e.program_id=g.program_id and e.group_id=g.id and e.status='active')) order by s.starts_on desc,p.key,g.key) from public.academic_groups g join public.academic_sessions s on s.tenant_id=g.tenant_id and s.id=g.session_id join public.programs p on p.tenant_id=g.tenant_id and p.id=g.program_id where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.status='active' and s.status='active' and p.status='active'),'[]'::jsonb),
    'subjects',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'key',s.key,'label',coalesce(s.labels->>'en',s.key),'labels',s.labels) order by s.key) from public.subjects s where s.tenant_id=p_tenant_id and s.status='active'),'[]'::jsonb),
    'evaluators',coalesce((select jsonb_agg(jsonb_build_object('person_id',e.employee_person_id,'name',p.display_name,'employee_number',e.employee_number,'designation',e.designation_key) order by p.display_name) from public.hr_employments e join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.state='active'),'[]'::jsonb),
    'grading_scales',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'key',g.key,'version',g.version,'labels',g.labels,'rounding_mode',g.rounding_mode,'decimal_places',g.decimal_places) order by (g.key='standard_percentage') desc,g.key,g.version desc) from public.grading_scale_versions g where g.tenant_id=p_tenant_id and g.state='published'),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.get_exam_results_workspace_v3(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_exam_series_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $function$
declare
  v_membership bigint;v_exam bigint;v_result jsonb;
  v_can_read boolean:=false;v_can_enter boolean:=false;v_can_moderate boolean:=false;v_can_approve boolean:=false;v_can_publish boolean:=false;
begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
  order by m.created_at asc limit 1;
  if v_membership is null then raise exception 'active branch membership required';end if;
  select exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code='assessment.marks.read') into v_can_read;
  select exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code='assessment.marks.enter') into v_can_enter;
  select exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code='assessment.marks.moderate') into v_can_moderate;
  select exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code='assessment.results.approve') into v_can_approve;
  select exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code='assessment.results.publish') into v_can_publish;
  if not(v_can_read or v_can_enter or v_can_moderate or v_can_approve or v_can_publish) then raise exception 'exam workspace permission denied';end if;

  if p_exam_series_id is null then
    select es.id into v_exam from public.exam_series es where es.tenant_id=p_tenant_id and es.branch_id=p_branch_id order by (es.state<>'archived') desc,es.starts_on desc,es.id desc limit 1;
  else
    select es.id into v_exam from public.exam_series es where es.tenant_id=p_tenant_id and es.branch_id=p_branch_id and es.id=p_exam_series_id;
    if v_exam is null then raise exception 'exam series not available in this branch';end if;
  end if;

  if v_exam is null then
    return jsonb_build_object('exam',null,'exams','[]'::jsonb,'subjects','[]'::jsonb,'summary',jsonb_build_object('candidates',0,'subjects',0,'marks_recorded',0,'marks_expected',0,'average_percentage',null),'latest_result',null,'can_read',v_can_read,'can_enter',v_can_enter,'can_moderate',v_can_moderate,'can_approve',v_can_approve,'can_publish',v_can_publish);
  end if;

  select jsonb_build_object(
    'exam',jsonb_build_object('id',es.id,'key',es.key,'label',coalesce(es.labels->>'en',es.key),'labels',es.labels,'state',es.state,'starts_on',es.starts_on,'ends_on',es.ends_on,'session_id',es.session_id,'session_label',coalesce(sess.labels->>'en',sess.key),'program_id',es.program_id,'program_label',coalesce(pr.labels->>'en',pr.key),'group_id',es.group_id,'group_label',coalesce(g.labels->>'en',g.key),'grading_scale_version_id',es.grading_scale_version_id,'grading_scale_label',coalesce(gs.labels->>'en',gs.key),'ranking_enabled',es.ranking_enabled,'exam_type',coalesce(es.rules_snapshot->>'exam_type','assessment')),
    'exams',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'key',x.key,'labels',x.labels,'state',x.state,'starts_on',x.starts_on,'ends_on',x.ends_on,'session_id',x.session_id,'session_label',coalesce(xs.labels->>'en',xs.key),'program_id',x.program_id,'program_label',coalesce(xp.labels->>'en',xp.key),'group_id',x.group_id,'group_label',coalesce(xg.labels->>'en',xg.key),'exam_type',coalesce(x.rules_snapshot->>'exam_type','assessment')) order by x.starts_on desc,x.id desc) from public.exam_series x join public.academic_sessions xs on xs.tenant_id=x.tenant_id and xs.id=x.session_id join public.programs xp on xp.tenant_id=x.tenant_id and xp.id=x.program_id left join public.academic_groups xg on xg.tenant_id=x.tenant_id and xg.id=x.group_id where x.tenant_id=p_tenant_id and x.branch_id=p_branch_id),'[]'::jsonb),
    'summary',jsonb_build_object(
      'candidates',(select count(*) from public.enrollments e where e.tenant_id=es.tenant_id and e.branch_id=es.branch_id and e.session_id=es.session_id and e.program_id=es.program_id and (es.group_id is null or e.group_id=es.group_id) and e.status='active'),
      'subjects',(select count(*) from public.exam_subjects x where x.tenant_id=es.tenant_id and x.exam_series_id=es.id),
      'marks_recorded',(select count(*) from public.mark_entries me join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id join public.exam_subjects x on x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id where me.tenant_id=es.tenant_id and x.exam_series_id=es.id),
      'marks_expected',((select count(*) from public.enrollments e where e.tenant_id=es.tenant_id and e.branch_id=es.branch_id and e.session_id=es.session_id and e.program_id=es.program_id and (es.group_id is null or e.group_id=es.group_id) and e.status='active')*(select count(*) from public.exam_subjects x where x.tenant_id=es.tenant_id and x.exam_series_id=es.id)),
      'average_percentage',(select round(avg((me.raw_marks/nullif(ac.maximum_marks,0))*100),1) from public.mark_entries me join public.assessment_components ac on ac.tenant_id=me.tenant_id and ac.id=me.assessment_component_id join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id join public.exam_subjects x on x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id where me.tenant_id=es.tenant_id and x.exam_series_id=es.id and me.entry_status='present')
    ),
    'subjects',coalesce((select jsonb_agg(jsonb_build_object('exam_subject_id',x.id,'subject_id',s.id,'subject_key',s.key,'subject_name',coalesce(s.labels->>'en',s.key),'labels',s.labels,'maximum_marks',x.maximum_marks,'pass_marks',x.pass_marks,'marksheet_id',ms.id,'marksheet_state',ms.state,'evaluator',teacher.display_name,'marks',coalesce((select jsonb_agg(jsonb_build_object('mark_entry_id',coalesce(me.id,0),'student_person_id',e.student_person_id,'student_name',pe.display_name,'student_number',sp.student_number,'entry_status',coalesce(me.entry_status,'incomplete'),'raw_marks',me.raw_marks,'comment',me.comment,'current_version',coalesce(me.current_version,0)) order by pe.display_name) from public.enrollments e join public.persons pe on pe.tenant_id=e.tenant_id and pe.id=e.student_person_id join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id left join public.mark_entries me on me.tenant_id=e.tenant_id and me.marksheet_id=ms.id and me.assessment_component_id=ac.id and me.enrollment_id=e.id where e.tenant_id=es.tenant_id and e.branch_id=es.branch_id and e.session_id=es.session_id and e.program_id=es.program_id and (es.group_id is null or e.group_id=es.group_id) and e.status='active'),'[]'::jsonb)) order by s.key) from public.exam_subjects x join public.subjects s on s.tenant_id=x.tenant_id and s.id=x.subject_id left join lateral(select z.* from public.marksheets z where z.tenant_id=x.tenant_id and z.exam_subject_id=x.id and (z.group_id=es.group_id or(z.group_id is null and es.group_id is null)) order by z.version desc,z.id desc limit 1)ms on true left join lateral(select z.* from public.assessment_components z where z.tenant_id=x.tenant_id and z.exam_subject_id=x.id and z.entry_mode='marks' order by z.sequence,z.id limit 1)ac on true left join public.persons teacher on teacher.tenant_id=x.tenant_id and teacher.id=x.evaluator_person_id where x.tenant_id=es.tenant_id and x.exam_series_id=es.id),'[]'::jsonb),
    'latest_result',(select jsonb_build_object('run_id',rr.id,'run_number',rr.run_number,'state',rr.state,'calculated_at',rr.calculated_at,'approved_at',rr.approved_at,'publication_id',pub.id,'published_at',pub.published_at,'snapshot',case when rs.id is null then null else jsonb_build_object('id',rs.id,'student_person_id',rs.student_person_id,'percentage',rs.percentage,'aggregate_status',rs.aggregate_status,'grade_key',rs.grade_key,'rank_value',rs.rank_value) end) from public.result_runs rr left join lateral(select z.* from public.result_publications z where z.tenant_id=rr.tenant_id and z.result_run_id=rr.id and z.revoked_at is null order by z.id desc limit 1)pub on true left join lateral(select z.* from public.result_snapshots z where z.tenant_id=rr.tenant_id and z.result_run_id=rr.id order by z.id limit 1)rs on true where rr.tenant_id=es.tenant_id and rr.exam_series_id=es.id order by rr.run_number desc limit 1),
    'can_read',v_can_read,'can_enter',v_can_enter,'can_moderate',v_can_moderate,'can_approve',v_can_approve,'can_publish',v_can_publish
  ) into v_result
  from public.exam_series es
  join public.academic_sessions sess on sess.tenant_id=es.tenant_id and sess.id=es.session_id
  join public.programs pr on pr.tenant_id=es.tenant_id and pr.id=es.program_id
  left join public.academic_groups g on g.tenant_id=es.tenant_id and g.id=es.group_id
  join public.grading_scale_versions gs on gs.tenant_id=es.tenant_id and gs.id=es.grading_scale_version_id
  where es.tenant_id=p_tenant_id and es.id=v_exam;
  return v_result;
end;
$function$;

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
  from public.result_snapshots rs join public.persons p on p.tenant_id=rs.tenant_id and p.id=rs.student_person_id join public.student_profiles sp on sp.tenant_id=rs.tenant_id and sp.person_id=rs.student_person_id where rs.tenant_id=p_tenant_id and rs.result_run_id=v_run and rs.state='approved';

  select coalesce(jsonb_agg(row_to_json(x) order by x.subject_name),'[]'::jsonb) into v_subjects from(
    select exs.id exam_subject_id,s.id subject_id,coalesce(s.labels->>'en',s.key) subject_name,s.labels,exs.maximum_marks,exs.pass_marks,
      round(avg(case when rss.raw_marks is not null then (rss.raw_marks/nullif(rss.maximum_marks,0))*100 end),1) average_percentage,
      count(*) filter(where rss.outcome='pass')::int pass_count,
      count(*) filter(where rss.outcome='fail')::int fail_count,
      count(*) filter(where rss.outcome not in('pass','fail'))::int other_count
    from public.result_subject_snapshots rss join public.result_snapshots rs on rs.tenant_id=rss.tenant_id and rs.id=rss.result_snapshot_id join public.exam_subjects exs on exs.tenant_id=rss.tenant_id and exs.id=rss.exam_subject_id join public.subjects s on s.tenant_id=exs.tenant_id and s.id=exs.subject_id
    where rss.tenant_id=p_tenant_id and rs.result_run_id=v_run
    group by exs.id,s.id,s.key,s.labels,exs.maximum_marks,exs.pass_marks
  )x;
  select coalesce(jsonb_agg(jsonb_build_object('grade_key',x.grade_key,'count',x.count) order by x.grade_key),'[]'::jsonb) into v_grades from(select coalesce(rs.grade_key,'ungraded') grade_key,count(*)::int count from public.result_snapshots rs where rs.tenant_id=p_tenant_id and rs.result_run_id=v_run group by coalesce(rs.grade_key,'ungraded'))x;

  return jsonb_build_object(
    'exam_series_id',p_exam_series_id,'result_run_id',v_run,'available',true,'ranking_enabled',v_exam.ranking_enabled,
    'summary',(select jsonb_build_object('students',count(*)::int,'average',round(avg(rs.percentage),1),'highest',max(rs.percentage),'lowest',min(rs.percentage),'pass',count(*) filter(where rs.aggregate_status='pass')::int,'fail',count(*) filter(where rs.aggregate_status='fail')::int,'incomplete',count(*) filter(where rs.aggregate_status not in('pass','fail'))::int,'pass_rate',round((count(*) filter(where rs.aggregate_status='pass')::numeric/nullif(count(*),0))*100,1)) from public.result_snapshots rs where rs.tenant_id=p_tenant_id and rs.result_run_id=v_run),
    'students',v_students,'subjects',v_subjects,'grade_distribution',v_grades
  );
end;
$function$;

revoke all on function public.create_exam_series_v2(uuid,bigint,bigint,bigint,text,jsonb,text,date,date,bigint,bigint[],numeric,numeric,bigint,boolean) from public,anon,authenticated;
grant execute on function public.create_exam_series_v2(uuid,bigint,bigint,bigint,text,jsonb,text,date,date,bigint,bigint[],numeric,numeric,bigint,boolean) to service_role;
revoke all on function public.get_exam_setup_options_v2(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_exam_setup_options_v2(uuid,bigint,bigint) to service_role;
revoke all on function public.get_exam_results_workspace_v3(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_exam_results_workspace_v3(uuid,bigint,bigint,bigint) to service_role;
revoke all on function public.get_exam_results_analysis_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_exam_results_analysis_v1(uuid,bigint,bigint,bigint) to service_role;
