create index if not exists exam_series_branch_state_idx on public.exam_series(tenant_id,branch_id,state,starts_on desc);
create index if not exists exam_subjects_series_idx on public.exam_subjects(tenant_id,exam_series_id);
create index if not exists marksheets_subject_state_idx on public.marksheets(tenant_id,exam_subject_id,state);
create index if not exists mark_entries_student_idx on public.mark_entries(tenant_id,student_person_id,marksheet_id);
create index if not exists result_runs_series_idx on public.result_runs(tenant_id,exam_series_id,run_number desc);
create index if not exists result_snapshots_student_idx on public.result_snapshots(tenant_id,student_person_id,created_at desc);

do $seed$
declare
  v_tenant bigint; v_branch bigint; v_session bigint; v_program bigint; v_group bigint;
  v_enrollment bigint; v_student bigint; v_membership bigint; v_teacher bigint;
  v_curriculum bigint; v_grading bigint; v_exam bigint; v_subject bigint;
  v_exam_subject bigint; v_component bigint; v_marksheet bigint; v_mark bigint;
  v_key text; v_marks numeric; v_label jsonb;
begin
  select e.tenant_id,e.branch_id,e.session_id,e.program_id,e.group_id,e.id,e.student_person_id
    into v_tenant,v_branch,v_session,v_program,v_group,v_enrollment,v_student
  from public.enrollments e
  join public.tenants t on t.id=e.tenant_id
  where t.slug='abu-school' and e.status='active'
  order by e.created_at asc,e.id asc limit 1;
  if v_tenant is null then return; end if;

  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=v_tenant and m.status='active'
  order by m.created_at asc,m.id asc limit 1;
  if v_membership is null then return; end if;

  select ep.person_id into v_teacher
  from public.employee_profiles ep
  where ep.tenant_id=v_tenant and ep.employee_number='DEMO-EXAM-001'
  limit 1;

  if v_teacher is null then
    select ep.person_id into v_teacher
    from public.employee_profiles ep
    where ep.tenant_id=v_tenant and ep.status='active'
    order by ep.created_at asc,ep.person_id asc limit 1;
  end if;

  if v_teacher is null then
    insert into public.persons(tenant_id,public_key,display_name,name_native,preferred_locale,status,metadata)
    values(v_tenant,gen_random_uuid(),'Ustadh Imran Qasmi','استاد عمران قاسمی','en','active',jsonb_build_object('demo_seed','exams'))
    returning id into v_teacher;

    insert into public.employee_profiles(person_id,tenant_id,employee_number,department_key,designation,employment_type,joined_on,status,qualification_summary)
    values(v_teacher,v_tenant,'DEMO-EXAM-001','academics','Exam Evaluator','full_time','2026-06-01','active','Dars-e-Nizami faculty · demo evaluator');
  end if;

  insert into public.curriculum_versions(tenant_id,program_id,version,labels,state,entry_rules,completion_rules,assessment_rules,published_at)
  values(v_tenant,v_program,1,jsonb_build_object('en','Dars-e-Nizami 2026-27','ur','درس نظامی 2026-27','ar','الدرس النظامي 2026-27'),'published','{}','{}',jsonb_build_object('pass_each_subject',true),clock_timestamp())
  on conflict (tenant_id,program_id,version) do update
    set state='published',published_at=coalesce(public.curriculum_versions.published_at,clock_timestamp())
  returning id into v_curriculum;

  insert into public.grading_scale_versions(tenant_id,key,version,labels,rounding_mode,decimal_places,state,rules,published_at)
  values(v_tenant,'standard_percentage',1,jsonb_build_object('en','Standard percentage grading','ur','معیاری فیصد گریڈنگ','ar','التقدير القياسي بالنسبة المئوية'),'half_up',1,'published',
    jsonb_build_object('bands',jsonb_build_array(
      jsonb_build_object('key','A+','min',90),jsonb_build_object('key','A','min',80),jsonb_build_object('key','B','min',70),
      jsonb_build_object('key','C','min',60),jsonb_build_object('key','D','min',50),jsonb_build_object('key','E','min',40),jsonb_build_object('key','F','min',0)
    ),'pass_percentage',40),clock_timestamp())
  on conflict (tenant_id,key,version) do update
    set state='published',published_at=coalesce(public.grading_scale_versions.published_at,clock_timestamp())
  returning id into v_grading;

  insert into public.exam_series(tenant_id,branch_id,session_id,program_id,level_id,group_id,curriculum_version_id,grading_scale_version_id,key,labels,starts_on,ends_on,state,publication_policy,ranking_enabled,rules_snapshot)
  values(v_tenant,v_branch,v_session,v_program,null,v_group,v_curriculum,v_grading,'term_assessment_2026_27',
    jsonb_build_object('en','Term Assessment 2026-27','ur','ٹرم امتحان 2026-27','ar','اختبار الفصل 2026-27'),
    '2026-08-24','2026-09-05','marks_open',jsonb_build_object('audience','portal','report_card',true),false,jsonb_build_object('pass_each_subject',true,'pass_marks',40))
  on conflict (tenant_id,branch_id,session_id,key) do update
    set state=case when public.exam_series.state in ('results_published','results_approved','marks_locked') then public.exam_series.state else 'marks_open' end,
        updated_at=clock_timestamp()
  returning id into v_exam;

  for v_key,v_label,v_marks in
    select * from (values
      ('arabic_language'::text,jsonb_build_object('en','Arabic Language','ur','عربی زبان','ar','اللغة العربية'),84::numeric),
      ('fiqh'::text,jsonb_build_object('en','Fiqh','ur','فقہ','ar','الفقه'),76::numeric),
      ('hadith_studies'::text,jsonb_build_object('en','Hadith Studies','ur','حدیث','ar','الحديث'),91::numeric)
    ) x(key,label,marks)
  loop
    insert into public.subjects(tenant_id,key,labels,subject_type,status)
    values(v_tenant,v_key,v_label,case when v_key='arabic_language' then 'language' else 'traditional' end,'active')
    on conflict (tenant_id,key) do update set labels=excluded.labels,status='active'
    returning id into v_subject;

    insert into public.exam_subjects(tenant_id,exam_series_id,subject_id,evaluator_person_id,maximum_marks,pass_marks,weight,optional,rules_snapshot)
    values(v_tenant,v_exam,v_subject,v_teacher,100,40,100,false,jsonb_build_object('grading','percentage'))
    on conflict (tenant_id,exam_series_id,subject_id) do update
      set evaluator_person_id=excluded.evaluator_person_id,maximum_marks=100,pass_marks=40
    returning id into v_exam_subject;

    insert into public.assessment_components(tenant_id,exam_subject_id,key,labels,entry_mode,maximum_marks,pass_marks,weight,required,sequence)
    values(v_tenant,v_exam_subject,'written',jsonb_build_object('en','Written examination','ur','تحریری امتحان','ar','الاختبار التحريري'),'marks',100,40,100,true,1)
    on conflict (tenant_id,exam_subject_id,key) do update set maximum_marks=100,pass_marks=40,weight=100
    returning id into v_component;

    insert into public.marksheets(tenant_id,exam_subject_id,group_id,evaluator_person_id,state,version,idempotency_key)
    values(v_tenant,v_exam_subject,v_group,v_teacher,'draft',1,'exam-2026-'||v_key||'-group-'||v_group::text)
    on conflict (tenant_id,idempotency_key) do update set evaluator_person_id=excluded.evaluator_person_id
    returning id into v_marksheet;

    v_mark:=null;
    insert into public.mark_entries(tenant_id,marksheet_id,assessment_component_id,enrollment_id,student_person_id,entry_status,raw_marks,grade_key,comment,current_version)
    values(v_tenant,v_marksheet,v_component,v_enrollment,v_student,'present',v_marks,null,'Seeded operational demo mark',1)
    on conflict (tenant_id,marksheet_id,assessment_component_id,enrollment_id) do nothing
    returning id into v_mark;

    if v_mark is null then
      select id into v_mark from public.mark_entries
      where tenant_id=v_tenant and marksheet_id=v_marksheet and assessment_component_id=v_component and enrollment_id=v_enrollment;
    end if;

    insert into public.mark_entry_versions(tenant_id,mark_entry_id,version,entry_status,raw_marks,grade_key,comment,source,actor_membership_id,reason)
    values(v_tenant,v_mark,1,'present',v_marks,null,'Seeded operational demo mark','entry',v_membership,'Initial exam workspace seed')
    on conflict (tenant_id,mark_entry_id,version) do nothing;
  end loop;
end;
$seed$;
