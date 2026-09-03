begin;

create or replace function private.ensure_program_curriculum_draft_v1(
  p_tenant_id bigint,
  p_program_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft_id bigint;
  v_source public.curriculum_versions%rowtype;
  v_new_version integer;
  v_new_item_id bigint;
  v_new_unit_id bigint;
  v_new_parent_id bigint;
  v_item record;
  v_unit record;
begin
  select cv.id into v_draft_id
  from public.curriculum_versions cv
  where cv.tenant_id=p_tenant_id and cv.program_id=p_program_id and cv.state='draft'
  order by cv.version desc,cv.id desc
  limit 1;
  if v_draft_id is not null then return v_draft_id; end if;

  select cv.* into v_source
  from public.curriculum_versions cv
  where cv.tenant_id=p_tenant_id and cv.program_id=p_program_id and cv.state='published'
  order by cv.version desc,cv.id desc
  limit 1;

  select coalesce(max(cv.version),0)+1 into v_new_version
  from public.curriculum_versions cv
  where cv.tenant_id=p_tenant_id and cv.program_id=p_program_id;

  insert into public.curriculum_versions(
    tenant_id,program_id,version,labels,state,entry_rules,completion_rules,assessment_rules
  )
  select
    p_tenant_id,
    p_program_id,
    v_new_version,
    coalesce(v_source.labels,p.labels),
    'draft',
    coalesce(v_source.entry_rules,'{}'::jsonb),
    coalesce(v_source.completion_rules,'{}'::jsonb),
    coalesce(v_source.assessment_rules,'{}'::jsonb)
  from public.programs p
  where p.tenant_id=p_tenant_id and p.id=p_program_id
  returning id into v_draft_id;

  if v_draft_id is null then raise exception 'program is invalid'; end if;
  if v_source.id is null then return v_draft_id; end if;

  create temporary table if not exists pg_temp.phase3_item_map(old_id bigint primary key,new_id bigint not null) on commit drop;
  truncate table pg_temp.phase3_item_map;

  for v_item in
    select cvi.*
    from public.curriculum_version_items cvi
    where cvi.tenant_id=p_tenant_id and cvi.curriculum_version_id=v_source.id
    order by cvi.sequence,cvi.id
  loop
    insert into public.curriculum_version_items(
      tenant_id,curriculum_version_id,level_id,subject_id,book_id,sequence,required,credit_weight,teaching_rules,progress_method,unit_structure
    ) values(
      p_tenant_id,v_draft_id,v_item.level_id,v_item.subject_id,v_item.book_id,v_item.sequence,v_item.required,v_item.credit_weight,v_item.teaching_rules,v_item.progress_method,v_item.unit_structure
    ) returning id into v_new_item_id;
    insert into pg_temp.phase3_item_map(old_id,new_id) values(v_item.id,v_new_item_id);
  end loop;

  create temporary table if not exists pg_temp.phase3_unit_map(old_id bigint primary key,new_id bigint not null) on commit drop;
  truncate table pg_temp.phase3_unit_map;

  for v_unit in
    with recursive unit_tree as (
      select cu.*,0 as depth
      from public.curriculum_units cu
      join pg_temp.phase3_item_map im on im.old_id=cu.curriculum_item_id
      where cu.tenant_id=p_tenant_id and cu.parent_unit_id is null
      union all
      select child.*,parent.depth+1
      from public.curriculum_units child
      join unit_tree parent on parent.tenant_id=child.tenant_id and parent.id=child.parent_unit_id
      where child.tenant_id=p_tenant_id
    )
    select * from unit_tree order by depth,sequence,id
  loop
    select im.new_id into v_new_item_id from pg_temp.phase3_item_map im where im.old_id=v_unit.curriculum_item_id;
    v_new_parent_id := null;
    if v_unit.parent_unit_id is not null then
      select um.new_id into v_new_parent_id from pg_temp.phase3_unit_map um where um.old_id=v_unit.parent_unit_id;
    end if;
    insert into public.curriculum_units(
      tenant_id,curriculum_item_id,parent_unit_id,key,labels,sequence,expected_periods
    ) values(
      p_tenant_id,v_new_item_id,v_new_parent_id,v_unit.key,v_unit.labels,v_unit.sequence,v_unit.expected_periods
    ) returning id into v_new_unit_id;
    insert into pg_temp.phase3_unit_map(old_id,new_id) values(v_unit.id,v_new_unit_id);
  end loop;

  return v_draft_id;
end;
$$;
revoke all on function private.ensure_program_curriculum_draft_v1(bigint,bigint) from public,anon,authenticated;

create or replace function public.create_teaching_program_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_key text,
  p_labels jsonb,
  p_descriptions jsonb,
  p_program_type text,
  p_template_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_program_id bigint;
  v_curriculum_id bigint;
  v_subject_id bigint;
  v_item_id bigint;
  v_key text := lower(btrim(coalesce(p_key,'')));
  v_title text := btrim(coalesce(p_labels->>'en',''));
  v_template text := lower(btrim(coalesce(p_template_key,'blank_custom')));
  v_seed jsonb := '[]'::jsonb;
  v_component record;
begin
  v_membership_id := private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['academics.structure.manage','learning.curriculum.manage']);
  if v_membership_id is null then raise exception 'program setup permission denied'; end if;
  if v_key !~ '^[a-z][a-z0-9_]{1,63}$' then raise exception 'program key is invalid'; end if;
  if length(v_title) not between 2 and 120 then raise exception 'program title must be between 2 and 120 characters'; end if;
  if p_program_type not in ('general','hifz','nazra','qaida','dars_e_nizami','custom') then raise exception 'program type is invalid'; end if;
  if v_template not in ('hifz','nazra','amma_para','deeniyat','kitab','dars_e_nizami','general_academic','blank_custom') then raise exception 'program template is invalid'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch is required'; end if;
  if exists(select 1 from public.programs p where p.tenant_id=p_tenant_id and p.key=v_key) then raise exception 'program key already exists'; end if;

  insert into public.programs(tenant_id,branch_id,key,labels,descriptions,program_type,template_key,allows_concurrent_enrollment,status)
  values(p_tenant_id,p_branch_id,v_key,p_labels,coalesce(p_descriptions,'{}'::jsonb),p_program_type,v_template,true,'active')
  returning id into v_program_id;

  insert into public.curriculum_versions(tenant_id,program_id,version,labels,state,entry_rules,completion_rules,assessment_rules)
  values(p_tenant_id,v_program_id,1,p_labels,'draft','{}'::jsonb,'{}'::jsonb,'{}'::jsonb)
  returning id into v_curriculum_id;

  v_seed := case v_template
    when 'hifz' then jsonb_build_array(
      jsonb_build_object('key','quran_hifz','labels',jsonb_build_object('en','Qur’an Hifz','ur','قرآن حفظ','ar','حفظ القرآن'),'type','quran','progress','memorization','unit','ayah_range')
    )
    when 'nazra' then jsonb_build_array(
      jsonb_build_object('key','quran_nazra','labels',jsonb_build_object('en','Qur’an Nazra','ur','قرآن ناظرہ','ar','تلاوة القرآن'),'type','quran','progress','rating','unit','surah')
    )
    when 'amma_para' then jsonb_build_array(
      jsonb_build_object('key','amma_para','labels',jsonb_build_object('en','Amma Para','ur','عم پارہ','ar','جزء عم'),'type','quran','progress','completion','unit','surah')
    )
    when 'deeniyat' then jsonb_build_array(
      jsonb_build_object('key','fiqh','labels',jsonb_build_object('en','Fiqh','ur','فقہ','ar','الفقه'),'type','traditional','progress','completion','unit','lesson'),
      jsonb_build_object('key','aqeedah','labels',jsonb_build_object('en','Aqeedah','ur','عقیدہ','ar','العقيدة'),'type','traditional','progress','completion','unit','lesson'),
      jsonb_build_object('key','hadith','labels',jsonb_build_object('en','Hadith','ur','حدیث','ar','الحديث'),'type','traditional','progress','completion','unit','lesson'),
      jsonb_build_object('key','akhlaq','labels',jsonb_build_object('en','Akhlaq','ur','اخلاق','ar','الأخلاق'),'type','traditional','progress','rating','unit','topic')
    )
    when 'kitab' then jsonb_build_array(
      jsonb_build_object('key','kitab_study','labels',jsonb_build_object('en','Kitab Study','ur','کتاب مطالعہ','ar','دراسة الكتاب'),'type','traditional','progress','completion','unit','chapter')
    )
    when 'dars_e_nizami' then jsonb_build_array(
      jsonb_build_object('key','arabic','labels',jsonb_build_object('en','Arabic','ur','عربی','ar','العربية'),'type','language','progress','completion','unit','lesson'),
      jsonb_build_object('key','fiqh','labels',jsonb_build_object('en','Fiqh','ur','فقہ','ar','الفقه'),'type','traditional','progress','completion','unit','chapter'),
      jsonb_build_object('key','hadith','labels',jsonb_build_object('en','Hadith','ur','حدیث','ar','الحديث'),'type','traditional','progress','completion','unit','chapter')
    )
    when 'general_academic' then jsonb_build_array(
      jsonb_build_object('key','english','labels',jsonb_build_object('en','English','ur','انگریزی','ar','الإنجليزية'),'type','language','progress','marks','unit','chapter'),
      jsonb_build_object('key','mathematics','labels',jsonb_build_object('en','Mathematics','ur','ریاضی','ar','الرياضيات'),'type','academic','progress','marks','unit','chapter'),
      jsonb_build_object('key','science','labels',jsonb_build_object('en','Science','ur','سائنس','ar','العلوم'),'type','academic','progress','marks','unit','chapter')
    )
    else '[]'::jsonb
  end;

  for v_component in
    select * from jsonb_to_recordset(v_seed) as x(key text,labels jsonb,type text,progress text,unit text)
  loop
    insert into public.subjects(tenant_id,key,labels,subject_type,status)
    values(p_tenant_id,v_component.key,v_component.labels,v_component.type,'active')
    on conflict (tenant_id,key) do update set labels=excluded.labels,status='active'
    returning id into v_subject_id;

    if not exists(
      select 1 from public.curriculum_version_items cvi
      where cvi.tenant_id=p_tenant_id and cvi.curriculum_version_id=v_curriculum_id and cvi.subject_id=v_subject_id and cvi.level_id is null and cvi.book_id is null
    ) then
      insert into public.curriculum_version_items(
        tenant_id,curriculum_version_id,level_id,subject_id,book_id,sequence,required,credit_weight,teaching_rules,progress_method,unit_structure
      ) values(
        p_tenant_id,v_curriculum_id,null,v_subject_id,null,
        (select count(*) from public.curriculum_version_items i where i.tenant_id=p_tenant_id and i.curriculum_version_id=v_curriculum_id),
        true,1,'{}'::jsonb,v_component.progress,v_component.unit
      ) returning id into v_item_id;
    end if;
  end loop;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'academics.program.create','succeeded','program',v_program_id::text,gen_random_uuid(),jsonb_build_object('key',v_key,'template',v_template,'curriculum_version_id',v_curriculum_id));

  return jsonb_build_object('program_id',v_program_id,'curriculum_version_id',v_curriculum_id,'template_key',v_template);
end;
$$;
revoke all on function public.create_teaching_program_v1(uuid,bigint,bigint,text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_teaching_program_v1(uuid,bigint,bigint,text,jsonb,jsonb,text,text) to service_role;

create or replace function public.add_program_level_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_program_id bigint,p_key text,p_labels jsonb,p_sequence integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership_id bigint;v_level_id bigint;v_key text:=lower(btrim(coalesce(p_key,'')));v_title text:=btrim(coalesce(p_labels->>'en',''));
begin
  v_membership_id:=private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['academics.structure.manage']);
  if v_membership_id is null then raise exception 'academic structure permission denied'; end if;
  if v_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then raise exception 'level key is invalid'; end if;
  if length(v_title) not between 1 and 120 then raise exception 'level title is invalid'; end if;
  if p_sequence is null or p_sequence<0 or p_sequence>500 then raise exception 'level sequence is invalid'; end if;
  if not exists(select 1 from public.programs p where p.tenant_id=p_tenant_id and p.id=p_program_id and p.status='active' and (p.branch_id is null or p.branch_id=p_branch_id)) then raise exception 'active program is required'; end if;
  insert into public.academic_levels(tenant_id,program_id,key,labels,sequence,status)
  values(p_tenant_id,p_program_id,v_key,p_labels,p_sequence,'active')
  returning id into v_level_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'academics.level.create','succeeded','academic_level',v_level_id::text,gen_random_uuid(),jsonb_build_object('program_id',p_program_id,'key',v_key,'sequence',p_sequence));
  return jsonb_build_object('level_id',v_level_id,'program_id',p_program_id,'key',v_key);
end;
$$;
revoke all on function public.add_program_level_v1(uuid,bigint,bigint,bigint,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.add_program_level_v1(uuid,bigint,bigint,bigint,text,jsonb,integer) to service_role;

create or replace function public.add_curriculum_component_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_program_id bigint,p_level_id bigint,p_subject_key text,p_subject_labels jsonb,p_subject_type text,p_progress_method text,p_unit_structure text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership_id bigint;v_curriculum_id bigint;v_subject_id bigint;v_item_id bigint;v_key text:=lower(btrim(coalesce(p_subject_key,'')));v_title text:=btrim(coalesce(p_subject_labels->>'en',''));v_sequence integer;
begin
  v_membership_id:=private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['academics.structure.manage','learning.curriculum.manage']);
  if v_membership_id is null then raise exception 'curriculum setup permission denied'; end if;
  if v_key !~ '^[a-z][a-z0-9_]{1,63}$' then raise exception 'subject key is invalid'; end if;
  if length(v_title) not between 1 and 120 then raise exception 'subject title is invalid'; end if;
  if p_subject_type not in ('academic','language','quran','traditional','activity','custom') then raise exception 'subject type is invalid'; end if;
  if p_progress_method not in ('completion','percentage','rating','score','marks','memorization','range','checklist','rubric','pass_repeat','custom') then raise exception 'progress method is invalid'; end if;
  if p_unit_structure not in ('juz','surah','ayah_range','chapter','lesson','topic','book','custom_unit') then raise exception 'unit structure is invalid'; end if;
  if not exists(select 1 from public.programs p where p.tenant_id=p_tenant_id and p.id=p_program_id and p.status='active' and (p.branch_id is null or p.branch_id=p_branch_id)) then raise exception 'active program is required'; end if;
  if p_level_id is not null and not exists(select 1 from public.academic_levels l where l.tenant_id=p_tenant_id and l.id=p_level_id and l.program_id=p_program_id and l.status='active') then raise exception 'selected level is invalid'; end if;

  v_curriculum_id:=private.ensure_program_curriculum_draft_v1(p_tenant_id,p_program_id);
  insert into public.subjects(tenant_id,key,labels,subject_type,status)
  values(p_tenant_id,v_key,p_subject_labels,p_subject_type,'active')
  on conflict (tenant_id,key) do update set labels=excluded.labels,status='active'
  returning id into v_subject_id;

  if exists(select 1 from public.curriculum_version_items i where i.tenant_id=p_tenant_id and i.curriculum_version_id=v_curriculum_id and i.subject_id=v_subject_id and i.level_id is not distinct from p_level_id and i.book_id is null) then raise exception 'component already exists in this curriculum draft'; end if;
  select coalesce(max(i.sequence),-1)+1 into v_sequence from public.curriculum_version_items i where i.tenant_id=p_tenant_id and i.curriculum_version_id=v_curriculum_id;
  insert into public.curriculum_version_items(tenant_id,curriculum_version_id,level_id,subject_id,book_id,sequence,required,credit_weight,teaching_rules,progress_method,unit_structure)
  values(p_tenant_id,v_curriculum_id,p_level_id,v_subject_id,null,v_sequence,true,1,'{}'::jsonb,p_progress_method,p_unit_structure)
  returning id into v_item_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.curriculum.component.create','succeeded','curriculum_version_item',v_item_id::text,gen_random_uuid(),jsonb_build_object('program_id',p_program_id,'curriculum_version_id',v_curriculum_id,'subject_id',v_subject_id,'level_id',p_level_id,'progress_method',p_progress_method,'unit_structure',p_unit_structure));
  return jsonb_build_object('curriculum_item_id',v_item_id,'curriculum_version_id',v_curriculum_id,'subject_id',v_subject_id);
end;
$$;
revoke all on function public.add_curriculum_component_v1(uuid,bigint,bigint,bigint,bigint,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.add_curriculum_component_v1(uuid,bigint,bigint,bigint,bigint,text,jsonb,text,text,text) to service_role;

create or replace function public.add_curriculum_unit_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_curriculum_item_id bigint,p_parent_unit_id bigint,p_key text,p_labels jsonb,p_sequence integer,p_expected_periods numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership_id bigint;v_unit_id bigint;v_program_id bigint;v_key text:=btrim(coalesce(p_key,''));v_title text:=btrim(coalesce(p_labels->>'en',''));
begin
  v_membership_id:=private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['academics.structure.manage','learning.curriculum.manage']);
  if v_membership_id is null then raise exception 'curriculum setup permission denied'; end if;
  if length(v_key) not between 1 and 80 then raise exception 'unit key is invalid'; end if;
  if length(v_title) not between 1 and 160 then raise exception 'unit title is invalid'; end if;
  if p_sequence is null or p_sequence<0 or p_sequence>5000 then raise exception 'unit sequence is invalid'; end if;
  if p_expected_periods is not null and (p_expected_periods<0 or p_expected_periods>1000) then raise exception 'expected periods are invalid'; end if;
  select cv.program_id into v_program_id
  from public.curriculum_version_items i
  join public.curriculum_versions cv on cv.tenant_id=i.tenant_id and cv.id=i.curriculum_version_id and cv.state='draft'
  join public.programs p on p.tenant_id=cv.tenant_id and p.id=cv.program_id and p.status='active' and (p.branch_id is null or p.branch_id=p_branch_id)
  where i.tenant_id=p_tenant_id and i.id=p_curriculum_item_id;
  if v_program_id is null then raise exception 'editable curriculum item is required'; end if;
  if p_parent_unit_id is not null and not exists(select 1 from public.curriculum_units u where u.tenant_id=p_tenant_id and u.id=p_parent_unit_id and u.curriculum_item_id=p_curriculum_item_id) then raise exception 'parent unit is invalid'; end if;
  insert into public.curriculum_units(tenant_id,curriculum_item_id,parent_unit_id,key,labels,sequence,expected_periods)
  values(p_tenant_id,p_curriculum_item_id,p_parent_unit_id,v_key,p_labels,p_sequence,p_expected_periods)
  returning id into v_unit_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.curriculum.unit.create','succeeded','curriculum_unit',v_unit_id::text,gen_random_uuid(),jsonb_build_object('program_id',v_program_id,'curriculum_item_id',p_curriculum_item_id,'parent_unit_id',p_parent_unit_id,'key',v_key));
  return jsonb_build_object('curriculum_unit_id',v_unit_id,'curriculum_item_id',p_curriculum_item_id);
end;
$$;
revoke all on function public.add_curriculum_unit_v1(uuid,bigint,bigint,bigint,bigint,text,jsonb,integer,numeric) from public,anon,authenticated;
grant execute on function public.add_curriculum_unit_v1(uuid,bigint,bigint,bigint,bigint,text,jsonb,integer,numeric) to service_role;

create or replace function public.publish_program_curriculum_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_program_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership_id bigint;v_curriculum_id bigint;v_version integer;v_item_count integer;v_missing_units integer;
begin
  v_membership_id:=private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['academics.structure.manage','learning.curriculum.manage']);
  if v_membership_id is null then raise exception 'curriculum publish permission denied'; end if;
  select cv.id,cv.version into v_curriculum_id,v_version
  from public.curriculum_versions cv
  join public.programs p on p.tenant_id=cv.tenant_id and p.id=cv.program_id and p.status='active' and (p.branch_id is null or p.branch_id=p_branch_id)
  where cv.tenant_id=p_tenant_id and cv.program_id=p_program_id and cv.state='draft'
  order by cv.version desc,cv.id desc limit 1;
  if v_curriculum_id is null then raise exception 'curriculum draft is required'; end if;
  select count(*)::integer into v_item_count from public.curriculum_version_items i where i.tenant_id=p_tenant_id and i.curriculum_version_id=v_curriculum_id;
  if v_item_count<1 then raise exception 'add at least one curriculum component before publishing'; end if;
  select count(*)::integer into v_missing_units
  from public.curriculum_version_items i
  where i.tenant_id=p_tenant_id and i.curriculum_version_id=v_curriculum_id
    and not exists(select 1 from public.curriculum_units u where u.tenant_id=i.tenant_id and u.curriculum_item_id=i.id);
  if v_missing_units>0 then raise exception 'every curriculum component requires at least one unit before publishing'; end if;
  update public.curriculum_versions set state='superseded'
  where tenant_id=p_tenant_id and program_id=p_program_id and state='published';
  update public.curriculum_versions set state='published',published_at=now()
  where tenant_id=p_tenant_id and id=v_curriculum_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.curriculum.publish','succeeded','curriculum_version',v_curriculum_id::text,gen_random_uuid(),jsonb_build_object('program_id',p_program_id,'version',v_version,'item_count',v_item_count));
  return jsonb_build_object('curriculum_version_id',v_curriculum_id,'program_id',p_program_id,'version',v_version,'state','published');
end;
$$;
revoke all on function public.publish_program_curriculum_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.publish_program_curriculum_v1(uuid,bigint,bigint,bigint) to service_role;

create or replace function public.assign_curriculum_teaching_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_session_id bigint,p_curriculum_item_id bigint,p_group_id bigint,p_student_person_id bigint,p_teacher_person_id bigint,p_evaluation_method text,p_starts_on date,p_ends_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership_id bigint;v_assignment_id bigint;v_program_id bigint;v_progress_method text;
begin
  v_membership_id:=private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['academics.structure.manage','learning.curriculum.manage']);
  if v_membership_id is null then raise exception 'curriculum assignment permission denied'; end if;
  if ((p_group_id is not null)::int + (p_student_person_id is not null)::int)<>1 then raise exception 'select exactly one group or student target'; end if;
  if p_teacher_person_id is null or not exists(select 1 from public.employee_profiles e where e.tenant_id=p_tenant_id and e.person_id=p_teacher_person_id and e.status='active') then raise exception 'active teacher is required'; end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on<p_starts_on) then raise exception 'assignment dates are invalid'; end if;
  select cv.program_id,i.progress_method into v_program_id,v_progress_method
  from public.curriculum_version_items i
  join public.curriculum_versions cv on cv.tenant_id=i.tenant_id and cv.id=i.curriculum_version_id and cv.state='published'
  join public.programs p on p.tenant_id=cv.tenant_id and p.id=cv.program_id and p.status='active' and (p.branch_id is null or p.branch_id=p_branch_id)
  where i.tenant_id=p_tenant_id and i.id=p_curriculum_item_id;
  if v_program_id is null then raise exception 'published curriculum item is required'; end if;
  if p_evaluation_method is distinct from v_progress_method then raise exception 'evaluation method must match the published curriculum progress method'; end if;
  if not exists(select 1 from public.academic_sessions s where s.tenant_id=p_tenant_id and s.id=p_session_id and s.status='active') then raise exception 'active academic session is required'; end if;
  if p_group_id is not null and not exists(select 1 from public.academic_groups g where g.tenant_id=p_tenant_id and g.id=p_group_id and g.branch_id=p_branch_id and g.session_id=p_session_id and g.program_id=v_program_id and g.status='active') then raise exception 'group target is invalid'; end if;
  if p_student_person_id is not null and not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.session_id=p_session_id and e.program_id=v_program_id and e.status='active') then raise exception 'student target is not actively enrolled in this program'; end if;
  insert into public.curriculum_teaching_assignments(tenant_id,session_id,program_id,curriculum_item_id,group_id,student_person_id,teacher_person_id,evaluation_method,status,starts_on,ends_on)
  values(p_tenant_id,p_session_id,v_program_id,p_curriculum_item_id,p_group_id,p_student_person_id,p_teacher_person_id,p_evaluation_method,'active',p_starts_on,p_ends_on)
  returning id into v_assignment_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.curriculum.assign','succeeded','curriculum_teaching_assignment',v_assignment_id::text,gen_random_uuid(),jsonb_build_object('program_id',v_program_id,'session_id',p_session_id,'curriculum_item_id',p_curriculum_item_id,'group_id',p_group_id,'student_person_id',p_student_person_id,'teacher_person_id',p_teacher_person_id));
  return jsonb_build_object('assignment_id',v_assignment_id,'program_id',v_program_id,'evaluation_method',p_evaluation_method);
end;
$$;
revoke all on function public.assign_curriculum_teaching_v1(uuid,bigint,bigint,bigint,bigint,bigint,bigint,bigint,text,date,date) from public,anon,authenticated;
grant execute on function public.assign_curriculum_teaching_v1(uuid,bigint,bigint,bigint,bigint,bigint,bigint,bigint,text,date,date) to service_role;

create or replace function public.record_student_curriculum_progress_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_assignment_id bigint,p_student_person_id bigint,p_curriculum_unit_id bigint,p_teacher_person_id bigint,p_state text,p_progress_value jsonb,p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_membership_id bigint;v_progress_id bigint;v_method text;v_assignment public.curriculum_teaching_assignments%rowtype;v_numeric numeric;v_max numeric;
begin
  v_membership_id:=private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['learning.progress.manage']);
  if v_membership_id is null then raise exception 'curriculum progress permission denied'; end if;
  select a.* into v_assignment from public.curriculum_teaching_assignments a where a.tenant_id=p_tenant_id and a.id=p_assignment_id and a.status='active' and (a.ends_on is null or a.ends_on>=current_date);
  if v_assignment.id is null then raise exception 'active teaching assignment is required'; end if;
  if p_teacher_person_id is null or p_teacher_person_id is distinct from v_assignment.teacher_person_id then raise exception 'assigned teacher is required'; end if;
  if p_state not in ('not_started','in_progress','completed','passed','repeat','needs_support','skipped') then raise exception 'progress state is invalid'; end if;
  if length(coalesce(p_notes,''))>2000 then raise exception 'progress notes are too long'; end if;
  if length(coalesce(p_progress_value,'{}'::jsonb)::text)>4000 then raise exception 'progress value is too large'; end if;
  if not exists(select 1 from public.curriculum_units u where u.tenant_id=p_tenant_id and u.id=p_curriculum_unit_id and u.curriculum_item_id=v_assignment.curriculum_item_id) then raise exception 'curriculum unit is outside this assignment'; end if;
  if not (
    v_assignment.student_person_id=p_student_person_id
    or (v_assignment.group_id is not null and exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.session_id=v_assignment.session_id and e.program_id=v_assignment.program_id and e.group_id=v_assignment.group_id and e.status='active'))
  ) then raise exception 'student is outside this teaching assignment'; end if;
  v_method:=v_assignment.evaluation_method;
  if v_method='percentage' then
    begin v_numeric:=(p_progress_value->>'percent')::numeric; exception when others then raise exception 'percentage progress requires numeric percent'; end;
    if v_numeric<0 or v_numeric>100 then raise exception 'percentage progress must be between 0 and 100'; end if;
  elsif v_method='rating' then
    begin v_numeric:=(p_progress_value->>'rating')::numeric; exception when others then raise exception 'rating progress requires numeric rating'; end;
    if v_numeric<1 or v_numeric>5 then raise exception 'rating must be between 1 and 5'; end if;
  elsif v_method in ('score','marks') then
    begin v_numeric:=(p_progress_value->>'score')::numeric;v_max:=(p_progress_value->>'max')::numeric; exception when others then raise exception 'score progress requires score and max'; end;
    if v_max<=0 or v_numeric<0 or v_numeric>v_max then raise exception 'score progress is invalid'; end if;
  end if;
  insert into public.student_curriculum_progress(tenant_id,student_person_id,curriculum_unit_id,teaching_assignment_id,teacher_person_id,progress_method,state,progress_value,notes)
  values(p_tenant_id,p_student_person_id,p_curriculum_unit_id,p_assignment_id,p_teacher_person_id,v_method,p_state,coalesce(p_progress_value,'{}'::jsonb),nullif(btrim(coalesce(p_notes,'')),''))
  returning id into v_progress_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.curriculum.progress.record','succeeded','student_curriculum_progress',v_progress_id::text,gen_random_uuid(),jsonb_build_object('assignment_id',p_assignment_id,'student_person_id',p_student_person_id,'curriculum_unit_id',p_curriculum_unit_id,'state',p_state,'progress_method',v_method));
  return jsonb_build_object('progress_id',v_progress_id,'assignment_id',p_assignment_id,'student_person_id',p_student_person_id,'state',p_state,'progress_method',v_method);
end;
$$;
revoke all on function public.record_student_curriculum_progress_v1(uuid,bigint,bigint,bigint,bigint,bigint,bigint,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_student_curriculum_progress_v1(uuid,bigint,bigint,bigint,bigint,bigint,bigint,text,jsonb,text) to service_role;

commit;
