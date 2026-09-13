-- Master audit remediation: FUR-AUD-007 / FUR-AUD-008.
-- One transaction, deterministic reactivation/upsert, structured confirmed metadata,
-- and metadata inheritance for future curriculum draft clones.

alter table public.curriculum_versions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function private.inherit_curriculum_metadata_v1()
returns trigger
language plpgsql
set search_path=''
as $$
declare v_metadata jsonb;
begin
  if new.state='draft' and coalesce(new.metadata,'{}'::jsonb)='{}'::jsonb then
    select cv.metadata into v_metadata
    from public.curriculum_versions cv
    where cv.tenant_id=new.tenant_id and cv.program_id=new.program_id and cv.state='published'
    order by cv.version desc,cv.id desc limit 1;
    new.metadata:=coalesce(v_metadata,'{}'::jsonb);
  end if;
  return new;
end;
$$;

drop trigger if exists curriculum_versions_inherit_metadata on public.curriculum_versions;
create trigger curriculum_versions_inherit_metadata
before insert on public.curriculum_versions
for each row execute function private.inherit_curriculum_metadata_v1();

revoke all on function private.inherit_curriculum_metadata_v1() from public,anon,authenticated;

create or replace function public.bootstrap_furkania_deeniyat_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_program_key text,
  p_program_labels jsonb,
  p_program_descriptions jsonb,
  p_levels jsonb,
  p_subjects jsonb,
  p_entry_rules jsonb,
  p_metadata jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_membership_id bigint;
  v_program_id bigint;
  v_curriculum_id bigint;
  v_level record;
  v_subject record;
  v_level_id bigint;
  v_subject_id bigint;
  v_item_id bigint;
  v_sequence integer;
  v_program_created boolean:=false;
  v_levels_created integer:=0;
  v_levels_reactivated integer:=0;
  v_components_created integer:=0;
  v_components_updated integer:=0;
  v_key text:=lower(btrim(coalesce(p_program_key,'')));
begin
  if not exists(select 1 from public.tenants t where t.id=p_tenant_id and t.slug='madrasa-e-furkania') then
    raise exception 'Furkania tenant required';
  end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then
    raise exception 'active Furkania branch required';
  end if;

  -- Authorization is checked before any no-op/idempotent return path.
  v_membership_id:=private.resolve_staff_membership(
    p_identity_id,p_tenant_id,p_branch_id,array['academics.structure.manage','learning.curriculum.manage']
  );
  if v_membership_id is null then raise exception 'Furkania academic setup permission denied'; end if;

  if v_key<>'deeniyat_primary' then raise exception 'Furkania Deeniyat program key is invalid'; end if;
  if jsonb_typeof(p_levels)<>'array' or jsonb_array_length(p_levels)<>5 then raise exception 'Furkania requires exactly five course levels'; end if;
  if jsonb_typeof(p_subjects)<>'array' or jsonb_array_length(p_subjects)<>5 then raise exception 'Furkania requires exactly five subject families'; end if;
  if coalesce(p_entry_rules->'age_4_to_5'->>'default_level_key','')<>'course_1' then raise exception 'Furkania age 4-5 entry rule must be Course 1'; end if;
  if lower(coalesce(p_metadata->>'book_medium',''))<>'hinglish' then raise exception 'Furkania book medium must be Hinglish'; end if;

  perform pg_advisory_xact_lock(hashtextextended(format('furkania_academic_bootstrap:%s',p_tenant_id),0));

  select p.id into v_program_id
  from public.programs p
  where p.tenant_id=p_tenant_id and p.key=v_key
  order by p.id limit 1
  for update;

  if v_program_id is null then
    insert into public.programs(
      tenant_id,branch_id,key,labels,descriptions,program_type,template_key,allows_concurrent_enrollment,status
    ) values(
      p_tenant_id,p_branch_id,v_key,p_program_labels,coalesce(p_program_descriptions,'{}'::jsonb),'custom','blank_custom',true,'active'
    ) returning id into v_program_id;
    insert into public.curriculum_versions(
      tenant_id,program_id,version,labels,state,entry_rules,completion_rules,assessment_rules,metadata
    ) values(
      p_tenant_id,v_program_id,1,p_program_labels,'draft',p_entry_rules,'{}'::jsonb,'{}'::jsonb,p_metadata
    ) returning id into v_curriculum_id;
    v_program_created:=true;
  else
    update public.programs set
      branch_id=coalesce(branch_id,p_branch_id),labels=p_program_labels,descriptions=coalesce(p_program_descriptions,'{}'::jsonb),
      program_type='custom',template_key='blank_custom',status='active',updated_at=now()
    where tenant_id=p_tenant_id and id=v_program_id
      and (branch_id is null or branch_id=p_branch_id);
    if not found then raise exception 'existing Furkania program belongs to another branch'; end if;
  end if;

  for v_level in
    select * from jsonb_to_recordset(p_levels) as x(key text,labels jsonb,sequence integer)
    order by sequence
  loop
    if v_level.key not in('course_1','course_2','course_3','course_4','course_5') then raise exception 'unexpected Furkania course key'; end if;
    select l.id into v_level_id from public.academic_levels l
    where l.tenant_id=p_tenant_id and l.program_id=v_program_id and l.key=v_level.key
    for update;
    if v_level_id is null then
      insert into public.academic_levels(tenant_id,program_id,key,labels,sequence,status)
      values(p_tenant_id,v_program_id,v_level.key,v_level.labels,v_level.sequence,'active')
      returning id into v_level_id;
      v_levels_created:=v_levels_created+1;
    else
      if exists(select 1 from public.academic_levels l where l.tenant_id=p_tenant_id and l.id=v_level_id and l.status<>'active') then
        v_levels_reactivated:=v_levels_reactivated+1;
      end if;
      update public.academic_levels set labels=v_level.labels,sequence=v_level.sequence,status='active',updated_at=now()
      where tenant_id=p_tenant_id and id=v_level_id;
    end if;
  end loop;

  if v_curriculum_id is null then
    v_curriculum_id:=private.ensure_program_curriculum_draft_v1(p_tenant_id,v_program_id);
  end if;
  update public.curriculum_versions set
    labels=p_program_labels,
    entry_rules=coalesce(entry_rules,'{}'::jsonb)||p_entry_rules,
    metadata=coalesce(metadata,'{}'::jsonb)||p_metadata
  where tenant_id=p_tenant_id and id=v_curriculum_id and state='draft';

  for v_level in
    select * from jsonb_to_recordset(p_levels) as x(key text,labels jsonb,sequence integer)
    order by sequence
  loop
    select l.id into v_level_id from public.academic_levels l
    where l.tenant_id=p_tenant_id and l.program_id=v_program_id and l.key=v_level.key and l.status='active';

    for v_subject in
      select * from jsonb_to_recordset(p_subjects) as x(key text,labels jsonb,subject_type text,progress_method text,unit_structure text)
    loop
      if v_subject.key not in('quraan','hadeeth','aqaaid_and_masaail','islamic_upbringing','language') then raise exception 'unexpected Furkania subject key'; end if;
      insert into public.subjects(tenant_id,key,labels,subject_type,status)
      values(p_tenant_id,v_subject.key,v_subject.labels,v_subject.subject_type,'active')
      on conflict(tenant_id,key) do update set labels=excluded.labels,subject_type=excluded.subject_type,status='active',updated_at=now()
      returning id into v_subject_id;

      select i.id into v_item_id
      from public.curriculum_version_items i
      where i.tenant_id=p_tenant_id and i.curriculum_version_id=v_curriculum_id
        and i.level_id=v_level_id and i.subject_id=v_subject_id and i.book_id is null
      order by i.id limit 1 for update;

      if v_item_id is null then
        select coalesce(max(i.sequence),-1)+1 into v_sequence
        from public.curriculum_version_items i
        where i.tenant_id=p_tenant_id and i.curriculum_version_id=v_curriculum_id;
        insert into public.curriculum_version_items(
          tenant_id,curriculum_version_id,level_id,subject_id,book_id,sequence,required,credit_weight,teaching_rules,progress_method,unit_structure
        ) values(
          p_tenant_id,v_curriculum_id,v_level_id,v_subject_id,null,v_sequence,true,1,
          jsonb_build_object('book_medium','hinglish','client_profile','madrasa_e_furkania'),
          v_subject.progress_method,v_subject.unit_structure
        );
        v_components_created:=v_components_created+1;
      else
        update public.curriculum_version_items set
          teaching_rules=coalesce(teaching_rules,'{}'::jsonb)||jsonb_build_object('book_medium','hinglish','client_profile','madrasa_e_furkania'),
          progress_method=v_subject.progress_method,unit_structure=v_subject.unit_structure
        where tenant_id=p_tenant_id and id=v_item_id;
        v_components_updated:=v_components_updated+1;
      end if;
    end loop;
  end loop;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'client.furkania.academics.bootstrap','succeeded','program',v_program_id::text,gen_random_uuid(),
    jsonb_build_object(
      'program_created',v_program_created,'levels_created',v_levels_created,'levels_reactivated',v_levels_reactivated,
      'components_created',v_components_created,'components_updated',v_components_updated,
      'book_medium','hinglish','age_4_to_5_entry','course_1','curriculum_version_id',v_curriculum_id
    )
  );

  return jsonb_build_object(
    'program_id',v_program_id,'curriculum_version_id',v_curriculum_id,
    'changed',v_program_created or v_levels_created>0 or v_levels_reactivated>0 or v_components_created>0,
    'program_created',v_program_created,'levels_created',v_levels_created,'levels_reactivated',v_levels_reactivated,
    'components_created',v_components_created,'components_updated',v_components_updated,
    'book_medium','hinglish','age_4_to_5_entry','course_1',
    'timetable_created',false,'timetable_status','blocked_until_exact_shift_times_are_confirmed'
  );
end;
$$;

revoke all on function public.bootstrap_furkania_deeniyat_v1(uuid,bigint,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.bootstrap_furkania_deeniyat_v1(uuid,bigint,bigint,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
