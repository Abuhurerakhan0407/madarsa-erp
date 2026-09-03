begin;

create or replace function public.record_quran_hifz_daily_quick_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_request_key text,
  p_group_id bigint,
  p_session_date date,
  p_student_person_id bigint,
  p_work_category text,
  p_action text,
  p_target jsonb default null,
  p_quality_score numeric default null,
  p_tajweed_score numeric default null,
  p_fluency_score numeric default null,
  p_mistake_count integer default 0,
  p_teacher_person_id bigint default null,
  p_teacher_note text default null,
  p_next_target jsonb default null,
  p_revision_due_on date default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_local_date date:=public.institution_local_date(p_tenant_id);
  v_action text:=lower(btrim(coalesce(p_action,'')));
  v_work text:=lower(btrim(coalesce(p_work_category,'sabaq')));
  v_outcome text;
  v_target jsonb:=p_target;
  v_mode text;v_juz smallint;v_ss smallint;v_sa integer;v_es smallint;v_ea integer;v_ps integer;v_pe integer;
  v_result jsonb;v_attempt_id bigint;v_session_id bigint;v_revision_id bigint;v_active_target_id bigint;v_next_id bigint;
  v_mistakes jsonb:='[]'::jsonb;
  v_next_work text;v_next_mode text;v_next_juz smallint;v_next_ss smallint;v_next_sa integer;v_next_es smallint;v_next_ea integer;v_next_ps integer;v_next_pe integer;
  v_range_key text;
  v_future_revisions jsonb:='[]'::jsonb;
  v_revision_snapshot jsonb;
  v_restored_revisions integer:=0;
  v_reported_completed integer:=0;
begin
  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.record'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation recording permission denied'; end if;
  if p_request_key is null or length(btrim(p_request_key)) not between 16 and 96 then raise exception 'request key must be between 16 and 96 characters'; end if;
  if p_session_date is null or p_session_date>v_local_date or p_session_date<v_local_date-90 then raise exception 'daily register date must be within the last 90 days'; end if;
  if p_revision_due_on is not null and p_revision_due_on<p_session_date then raise exception 'revision due date cannot be before the lesson date'; end if;
  if not exists(select 1 from public.academic_groups g where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.id=p_group_id and g.status='active') then raise exception 'active Halaqah or group is required'; end if;
  if not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id and e.student_person_id=p_student_person_id and e.status='active') then raise exception 'student is not actively enrolled in this Halaqah or group'; end if;
  if v_work not in ('sabaq','sabqi','manzil','nazra','qaida','tajweed') then raise exception 'Quran work category is invalid'; end if;
  if v_action not in ('pass','repeat','needs_support','absent','no_lesson') then raise exception 'daily register action is invalid'; end if;
  if p_quality_score is not null and (p_quality_score<0 or p_quality_score>100) then raise exception 'quality score is invalid'; end if;
  if p_tajweed_score is not null and (p_tajweed_score<0 or p_tajweed_score>100) then raise exception 'tajweed score is invalid'; end if;
  if p_fluency_score is not null and (p_fluency_score<0 or p_fluency_score>100) then raise exception 'fluency score is invalid'; end if;
  if p_mistake_count<0 or p_mistake_count>99 then raise exception 'mistake count is invalid'; end if;
  if length(coalesce(p_teacher_note,''))>1000 then raise exception 'teacher note is too long'; end if;

  if v_action in ('absent','no_lesson') then
    insert into public.quran_daily_roster_statuses(tenant_id,branch_id,group_id,student_person_id,session_date,status,note,recorded_by_membership_id)
    values(p_tenant_id,p_branch_id,p_group_id,p_student_person_id,p_session_date,v_action,nullif(btrim(coalesce(p_teacher_note,'')),''),v_membership_id)
    on conflict (tenant_id,branch_id,group_id,student_person_id,session_date)
    do update set status=excluded.status,note=excluded.note,recorded_by_membership_id=excluded.recorded_by_membership_id,updated_at=clock_timestamp();
    insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
    values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.recitation.daily_status','succeeded','student',p_student_person_id::text,gen_random_uuid(),jsonb_build_object('group_id',p_group_id,'session_date',p_session_date,'status',v_action));
    return jsonb_build_object('recorded',false,'status',v_action,'student_person_id',p_student_person_id,'session_date',p_session_date);
  end if;

  select t.id into v_active_target_id
  from public.quran_student_targets t
  where t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.student_person_id=p_student_person_id and t.work_category=v_work and t.status='active'
  order by t.assigned_on desc,t.id desc limit 1;

  if v_target is null and v_active_target_id is not null then
    select jsonb_build_object('mode',t.target_mode,'juz_number',t.juz_number,'start_surah_number',t.start_surah_number,'start_ayah_number',t.start_ayah_number,'end_surah_number',t.end_surah_number,'end_ayah_number',t.end_ayah_number,'page_start',t.page_start,'page_end',t.page_end)
    into v_target from public.quran_student_targets t where t.tenant_id=p_tenant_id and t.id=v_active_target_id;
  end if;
  if v_target is null then
    select jsonb_build_object('mode',case when a.juz_number is not null then 'juz' when a.start_surah_number is not null then 'ayah' else 'page' end,'juz_number',a.juz_number,'start_surah_number',a.start_surah_number,'start_ayah_number',a.start_ayah_number,'end_surah_number',a.end_surah_number,'end_ayah_number',a.end_ayah_number,'page_start',a.page_start,'page_end',a.page_end)
    into v_target
    from public.quran_effective_recitation_attempts_v1 a
    join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
    where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and rs.branch_id=p_branch_id and rs.session_date<=p_session_date and a.work_category=v_work
    order by rs.session_date desc,a.occurred_at desc,a.id desc limit 1;
  end if;
  if v_target is null then raise exception 'set a Quran target before using quick entry'; end if;

  begin
    v_mode:=lower(btrim(coalesce(v_target->>'mode','')));
    v_juz:=nullif(v_target->>'juz_number','')::smallint;
    v_ss:=nullif(v_target->>'start_surah_number','')::smallint;v_sa:=nullif(v_target->>'start_ayah_number','')::integer;
    v_es:=nullif(v_target->>'end_surah_number','')::smallint;v_ea:=nullif(v_target->>'end_ayah_number','')::integer;
    v_ps:=nullif(v_target->>'page_start','')::integer;v_pe:=nullif(v_target->>'page_end','')::integer;
  exception when others then raise exception 'quick entry target is invalid'; end;
  if not (
    (v_mode='juz' and v_juz between 1 and 30 and v_ss is null and v_ps is null)
    or (v_mode='ayah' and v_juz is null and v_ss between 1 and 114 and v_es between 1 and 114 and v_sa>0 and v_ea>0 and (v_es>v_ss or (v_es=v_ss and v_ea>=v_sa)) and v_ps is null)
    or (v_mode='page' and v_juz is null and v_ss is null and v_ps between 1 and 604 and v_pe between v_ps and 604)
  ) then raise exception 'quick entry target is invalid'; end if;

  v_range_key:=case
    when v_juz is not null then 'juz:'||v_juz
    when v_ss is not null then format('surah:%s:%s-%s:%s',v_ss,v_sa,v_es,v_ea)
    else format('pages:%s-%s',v_ps,v_pe)
  end;

  if v_action='pass' and p_session_date<v_local_date then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,'state',o.state,'completed_by_attempt_id',o.completed_by_attempt_id
    ) order by o.id),'[]'::jsonb)
    into v_future_revisions
    from public.revision_obligations o
    where o.tenant_id=p_tenant_id and o.student_person_id=p_student_person_id and o.source_key=v_range_key
      and o.state in ('due','assigned','attempted')
      and (o.due_on>p_session_date or o.created_at::date>p_session_date);
  end if;

  v_outcome:=case v_action when 'pass' then 'passed' when 'repeat' then 'repeat' else 'partial' end;
  if p_mistake_count>0 then
    v_mistakes:=jsonb_build_array(jsonb_build_object('category','quick_count','severity',case when p_mistake_count>=4 then 3 else 2 end,'count',p_mistake_count));
  end if;

  v_result:=public.record_quran_hifz_attempt_idempotent(
    p_identity_id,p_tenant_id,p_branch_id,btrim(p_request_key),p_student_person_id,v_work,
    v_juz,v_ss,v_sa,v_es,v_ea,v_ps,v_pe,
    null,p_fluency_score,p_tajweed_score,p_quality_score,0,v_outcome,p_teacher_person_id,p_teacher_note,null,null,v_mistakes
  );
  if coalesce((v_result->>'replayed')::boolean,false) then
    return v_result||jsonb_build_object('action',v_action,'session_date',p_session_date);
  end if;

  v_attempt_id:=nullif(v_result->>'attempt_id','')::bigint;
  v_session_id:=nullif(v_result->>'session_id','')::bigint;
  v_revision_id:=nullif(v_result->>'revision_obligation_id','')::bigint;

  if jsonb_array_length(v_future_revisions)>0 then
    for v_revision_snapshot in select value from jsonb_array_elements(v_future_revisions) loop
      update public.revision_obligations
      set state=v_revision_snapshot->>'state',
          completed_by_attempt_id=nullif(v_revision_snapshot->>'completed_by_attempt_id','')::bigint,
          updated_at=clock_timestamp()
      where tenant_id=p_tenant_id
        and id=(v_revision_snapshot->>'id')::bigint
        and completed_by_attempt_id=v_attempt_id;
      if found then v_restored_revisions:=v_restored_revisions+1; end if;
    end loop;
  end if;

  if v_restored_revisions>0 then
    v_reported_completed:=greatest(coalesce(nullif(v_result->>'revisions_completed','')::integer,0)-v_restored_revisions,0);
    v_result:=v_result||jsonb_build_object('revisions_completed',v_reported_completed,'future_revisions_preserved',v_restored_revisions);
  end if;

  update public.recitation_sessions set group_id=p_group_id,session_date=p_session_date,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_session_id;
  if v_revision_id is not null then
    update public.revision_obligations set due_on=coalesce(p_revision_due_on,p_session_date+case when v_action='repeat' then 1 else 3 end),updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_revision_id;
  end if;
  delete from public.quran_daily_roster_statuses where tenant_id=p_tenant_id and branch_id=p_branch_id and group_id=p_group_id and student_person_id=p_student_person_id and session_date=p_session_date;

  if v_active_target_id is not null and v_action='pass' then
    update public.quran_student_targets set status='completed',source_attempt_id=v_attempt_id,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_active_target_id and status='active';
  end if;

  if p_next_target is not null then
    begin
      v_next_work:=lower(btrim(coalesce(p_next_target->>'work_category',v_work)));
      v_next_mode:=lower(btrim(coalesce(p_next_target->>'mode','')));
      v_next_juz:=nullif(p_next_target->>'juz_number','')::smallint;
      v_next_ss:=nullif(p_next_target->>'start_surah_number','')::smallint;v_next_sa:=nullif(p_next_target->>'start_ayah_number','')::integer;
      v_next_es:=nullif(p_next_target->>'end_surah_number','')::smallint;v_next_ea:=nullif(p_next_target->>'end_ayah_number','')::integer;
      v_next_ps:=nullif(p_next_target->>'page_start','')::integer;v_next_pe:=nullif(p_next_target->>'page_end','')::integer;
    exception when others then raise exception 'next Quran target is invalid'; end;
    if v_next_work not in ('sabaq','sabqi','manzil','nazra','qaida','tajweed') then raise exception 'next target work category is invalid'; end if;
    if not (
      (v_next_mode='juz' and v_next_juz between 1 and 30 and v_next_ss is null and v_next_ps is null)
      or (v_next_mode='ayah' and v_next_juz is null and v_next_ss between 1 and 114 and v_next_es between 1 and 114 and v_next_sa>0 and v_next_ea>0 and (v_next_es>v_next_ss or (v_next_es=v_next_ss and v_next_ea>=v_next_sa)) and v_next_ps is null)
      or (v_next_mode='page' and v_next_juz is null and v_next_ss is null and v_next_ps between 1 and 604 and v_next_pe between v_next_ps and 604)
    ) then raise exception 'next Quran target is invalid'; end if;

    update public.quran_student_targets set status='superseded',updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and student_person_id=p_student_person_id and work_category=v_next_work and status='active';
    insert into public.quran_student_targets(
      tenant_id,branch_id,student_person_id,work_category,target_mode,juz_number,start_surah_number,start_ayah_number,end_surah_number,end_ayah_number,page_start,page_end,assigned_on,due_on,status,source_attempt_id,teacher_person_id,created_by_membership_id
    ) values(
      p_tenant_id,p_branch_id,p_student_person_id,v_next_work,v_next_mode,v_next_juz,v_next_ss,v_next_sa,v_next_es,v_next_ea,v_next_ps,v_next_pe,p_session_date,p_revision_due_on,'active',v_attempt_id,p_teacher_person_id,v_membership_id
    ) returning id into v_next_id;
  elsif v_action in ('repeat','needs_support') and v_active_target_id is null then
    insert into public.quran_student_targets(
      tenant_id,branch_id,student_person_id,work_category,target_mode,juz_number,start_surah_number,start_ayah_number,end_surah_number,end_ayah_number,page_start,page_end,assigned_on,due_on,status,source_attempt_id,teacher_person_id,created_by_membership_id
    ) values(
      p_tenant_id,p_branch_id,p_student_person_id,v_work,v_mode,v_juz,v_ss,v_sa,v_es,v_ea,v_ps,v_pe,p_session_date,coalesce(p_revision_due_on,p_session_date+case when v_action='repeat' then 1 else 3 end),'active',v_attempt_id,p_teacher_person_id,v_membership_id
    ) returning id into v_next_id;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.recitation.daily_quick','succeeded','recitation_attempt',v_attempt_id::text,gen_random_uuid(),jsonb_build_object('student_person_id',p_student_person_id,'group_id',p_group_id,'session_date',p_session_date,'action',v_action,'next_target_id',v_next_id,'future_revisions_preserved',v_restored_revisions));

  return v_result||jsonb_build_object('action',v_action,'session_date',p_session_date,'next_target_id',v_next_id);
end;
$$;

revoke all on function public.record_quran_hifz_daily_quick_v1(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,bigint,text,jsonb,date) from public,anon,authenticated;
grant execute on function public.record_quran_hifz_daily_quick_v1(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,bigint,text,jsonb,date) to service_role;

commit;
