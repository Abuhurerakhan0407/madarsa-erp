alter table public.recitation_sessions alter column teacher_person_id drop not null;
alter table public.recitation_sessions add column if not exists recorded_by_membership_id bigint;

do $block$
begin
  if not exists (
    select 1 from pg_constraint where conname='recitation_sessions_recorded_by_membership_fk' and conrelid='public.recitation_sessions'::regclass
  ) then
    alter table public.recitation_sessions add constraint recitation_sessions_recorded_by_membership_fk
      foreign key (tenant_id, recorded_by_membership_id) references public.memberships(tenant_id,id) on delete restrict;
  end if;
end;
$block$;

alter table public.recitation_attempts add column if not exists juz_number smallint;
alter table public.recitation_attempts add column if not exists start_surah_number smallint;
alter table public.recitation_attempts add column if not exists start_ayah_number integer;
alter table public.recitation_attempts add column if not exists end_surah_number smallint;
alter table public.recitation_attempts add column if not exists end_ayah_number integer;
alter table public.recitation_attempts add column if not exists page_start integer;
alter table public.recitation_attempts add column if not exists page_end integer;

alter table public.recitation_attempts drop constraint if exists recitation_attempts_target_check;

do $block$
begin
  if not exists (
    select 1 from pg_constraint where conname='recitation_attempts_target_v2_check' and conrelid='public.recitation_attempts'::regclass
  ) then
    alter table public.recitation_attempts add constraint recitation_attempts_target_v2_check check (
      ((start_reference_id is not null) and (end_reference_id is not null) and reading_unit_id is null)
      or ((start_reference_id is null) and (end_reference_id is null) and reading_unit_id is not null)
      or (
        start_reference_id is null and end_reference_id is null and reading_unit_id is null
        and (
          (juz_number between 1 and 30)
          or (
            start_surah_number between 1 and 114 and end_surah_number between 1 and 114
            and start_ayah_number > 0 and end_ayah_number > 0
            and (end_surah_number > start_surah_number or (end_surah_number=start_surah_number and end_ayah_number>=start_ayah_number))
          )
          or (page_start between 1 and 604 and page_end between page_start and 604)
        )
      )
    );
  end if;
end;
$block$;

do $block$
begin
  if not exists (
    select 1 from pg_constraint where conname='recitation_attempts_juz_check' and conrelid='public.recitation_attempts'::regclass
  ) then
    alter table public.recitation_attempts add constraint recitation_attempts_juz_check check (juz_number is null or juz_number between 1 and 30);
  end if;
  if not exists (
    select 1 from pg_constraint where conname='recitation_attempts_surah_check' and conrelid='public.recitation_attempts'::regclass
  ) then
    alter table public.recitation_attempts add constraint recitation_attempts_surah_check check (
      (start_surah_number is null and end_surah_number is null and start_ayah_number is null and end_ayah_number is null)
      or (start_surah_number between 1 and 114 and end_surah_number between 1 and 114 and start_ayah_number > 0 and end_ayah_number > 0)
    );
  end if;
end;
$block$;

create index if not exists recitation_attempts_student_date_idx
  on public.recitation_attempts(tenant_id,student_person_id,occurred_at desc);
create index if not exists recitation_attempts_student_work_idx
  on public.recitation_attempts(tenant_id,student_person_id,work_category,occurred_at desc);
create index if not exists recitation_attempts_juz_idx
  on public.recitation_attempts(tenant_id,student_person_id,juz_number) where juz_number is not null;
create index if not exists recitation_sessions_branch_date_idx
  on public.recitation_sessions(tenant_id,branch_id,session_date,state);
create index if not exists revision_obligations_student_due_idx
  on public.revision_obligations(tenant_id,student_person_id,state,due_on);

create or replace function public.record_quran_hifz_attempt(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint,
  p_work_category text,
  p_juz_number smallint default null,
  p_start_surah_number smallint default null,
  p_start_ayah_number integer default null,
  p_end_surah_number smallint default null,
  p_end_ayah_number integer default null,
  p_page_start integer default null,
  p_page_end integer default null,
  p_accuracy_score numeric default null,
  p_fluency_score numeric default null,
  p_tajweed_score numeric default null,
  p_overall_score numeric default null,
  p_prompts integer default null,
  p_outcome text default 'passed',
  p_teacher_person_id bigint default null,
  p_teacher_remark text default null,
  p_parent_visible_remark text default null,
  p_private_note text default null,
  p_mistakes jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_enrollment_id bigint;
  v_session_id bigint;
  v_attempt_id bigint;
  v_start_reference_id bigint;
  v_end_reference_id bigint;
  v_work text := lower(btrim(coalesce(p_work_category,'')));
  v_outcome text := lower(btrim(coalesce(p_outcome,'')));
  v_mistake jsonb;
  v_revision_id bigint;
  v_revision_due date;
  v_range_key text;
  v_today date := current_date;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_student_person_id is null then
    raise exception 'identity, tenant, branch, and student are required';
  end if;
  if v_work not in ('sabaq','sabqi','manzil','nazra','qaida','tajweed') then raise exception 'Quran work category is invalid'; end if;
  if v_outcome not in ('passed','partial','repeat','excused','not_attempted') then raise exception 'recitation outcome is invalid'; end if;
  if p_accuracy_score is not null and (p_accuracy_score<0 or p_accuracy_score>100) then raise exception 'accuracy score is invalid'; end if;
  if p_fluency_score is not null and (p_fluency_score<0 or p_fluency_score>100) then raise exception 'fluency score is invalid'; end if;
  if p_tajweed_score is not null and (p_tajweed_score<0 or p_tajweed_score>100) then raise exception 'tajweed score is invalid'; end if;
  if p_overall_score is not null and (p_overall_score<0 or p_overall_score>100) then raise exception 'overall score is invalid'; end if;
  if p_prompts is not null and p_prompts<0 then raise exception 'prompts cannot be negative'; end if;
  if p_teacher_remark is not null and length(p_teacher_remark)>1000 then raise exception 'teacher remark is too long'; end if;
  if p_parent_visible_remark is not null and length(p_parent_visible_remark)>1000 then raise exception 'parent remark is too long'; end if;
  if p_private_note is not null and length(p_private_note)>1000 then raise exception 'private note is too long'; end if;
  if jsonb_typeof(coalesce(p_mistakes,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_mistakes,'[]'::jsonb))>25 then raise exception 'mistakes must be an array with at most 25 entries'; end if;

  if not (
    (p_juz_number between 1 and 30)
    or (p_start_surah_number between 1 and 114 and p_end_surah_number between 1 and 114 and p_start_ayah_number>0 and p_end_ayah_number>0 and (p_end_surah_number>p_start_surah_number or (p_end_surah_number=p_start_surah_number and p_end_ayah_number>=p_start_ayah_number)))
    or (p_page_start between 1 and 604 and p_page_end between p_page_start and 604)
  ) then raise exception 'a valid Juz, Surah/Ayah range, or Mushaf page range is required'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.record'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation recording permission denied'; end if;

  select e.id into v_enrollment_id
  from public.enrollments e
  join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in ('active','admitted')
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active'
  order by e.starts_on desc nulls last,e.id desc limit 1;
  if v_enrollment_id is null then raise exception 'student is not actively enrolled in this branch'; end if;

  if p_teacher_person_id is not null and not exists(
    select 1 from public.employee_profiles ep where ep.tenant_id=p_tenant_id and ep.person_id=p_teacher_person_id and ep.status='active'
  ) then raise exception 'teacher is not an active employee'; end if;

  if p_start_surah_number is not null then
    select qr.id into v_start_reference_id from public.quran_references qr where qr.surah_number=p_start_surah_number and qr.ayah_number=p_start_ayah_number limit 1;
    select qr.id into v_end_reference_id from public.quran_references qr where qr.surah_number=p_end_surah_number and qr.ayah_number=p_end_ayah_number limit 1;
  end if;

  insert into public.recitation_sessions(tenant_id,branch_id,group_id,teacher_person_id,recorded_by_membership_id,session_date,state,idempotency_key,submitted_at)
  select p_tenant_id,p_branch_id,e.group_id,p_teacher_person_id,v_membership_id,v_today,'submitted',
         'quran-'||p_tenant_id||'-'||p_branch_id||'-'||v_membership_id||'-'||gen_random_uuid()::text,clock_timestamp()
  from public.enrollments e where e.tenant_id=p_tenant_id and e.id=v_enrollment_id
  returning id into v_session_id;

  insert into public.recitation_attempts(
    tenant_id,recitation_session_id,learning_plan_id,learning_plan_item_id,student_person_id,attendance_record_id,edition_id,
    work_category,start_reference_id,end_reference_id,reading_unit_id,attempt_number,accuracy_score,fluency_score,tajweed_score,overall_score,prompts,outcome,
    private_note,teacher_remark,parent_visible_remark,evaluation_snapshot,occurred_at,juz_number,start_surah_number,start_ayah_number,end_surah_number,end_ayah_number,page_start,page_end
  ) values(
    p_tenant_id,v_session_id,null,null,p_student_person_id,null,null,
    v_work,v_start_reference_id,v_end_reference_id,null,1,p_accuracy_score,p_fluency_score,p_tajweed_score,p_overall_score,p_prompts,v_outcome,
    nullif(btrim(coalesce(p_private_note,'')),''),nullif(btrim(coalesce(p_teacher_remark,'')),''),nullif(btrim(coalesce(p_parent_visible_remark,'')),''),
    jsonb_build_object('work_category',v_work,'juz_number',p_juz_number,'start_surah',p_start_surah_number,'start_ayah',p_start_ayah_number,'end_surah',p_end_surah_number,'end_ayah',p_end_ayah_number,'page_start',p_page_start,'page_end',p_page_end),
    clock_timestamp(),p_juz_number,p_start_surah_number,p_start_ayah_number,p_end_surah_number,p_end_ayah_number,p_page_start,p_page_end
  ) returning id into v_attempt_id;

  for v_mistake in select value from jsonb_array_elements(coalesce(p_mistakes,'[]'::jsonb)) loop
    if jsonb_typeof(v_mistake)<>'object' then raise exception 'each mistake must be an object'; end if;
    if length(btrim(coalesce(v_mistake->>'category','')))<2 or length(btrim(coalesce(v_mistake->>'category','')))>80 then raise exception 'mistake category is invalid'; end if;
    if coalesce((v_mistake->>'severity')::integer,1) not between 1 and 5 then raise exception 'mistake severity is invalid'; end if;
    if coalesce((v_mistake->>'count')::integer,1)<1 then raise exception 'mistake count is invalid'; end if;
    insert into public.recitation_mistakes(tenant_id,recitation_attempt_id,category_key,quran_reference_id,reading_unit_id,severity,count,repeated_derived,repeated_teacher_override,note)
    values(p_tenant_id,v_attempt_id,btrim(v_mistake->>'category'),null,null,coalesce((v_mistake->>'severity')::integer,1),coalesce((v_mistake->>'count')::integer,1),false,null,nullif(btrim(coalesce(v_mistake->>'note','')),''));
  end loop;

  if v_outcome='repeat' or (p_overall_score is not null and p_overall_score<70) then
    v_revision_due := v_today + case when v_outcome='repeat' then 1 else 3 end;
    v_range_key := case
      when p_juz_number is not null then 'juz:'||p_juz_number
      when p_start_surah_number is not null then format('surah:%s:%s-%s:%s',p_start_surah_number,p_start_ayah_number,p_end_surah_number,p_end_ayah_number)
      else format('pages:%s-%s',p_page_start,p_page_end)
    end;
    insert into public.revision_obligations(tenant_id,student_person_id,learning_plan_id,source_type,source_key,start_reference_id,end_reference_id,reading_unit_id,due_on,state)
    values(p_tenant_id,p_student_person_id,null,case when v_outcome='repeat' then 'missed_work' else 'weak_score' end,v_range_key,v_start_reference_id,v_end_reference_id,null,v_revision_due,'due')
    returning id into v_revision_id;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.recitation.record','succeeded','recitation_attempt',v_attempt_id::text,gen_random_uuid(),
    jsonb_build_object('student_person_id',p_student_person_id,'work_category',v_work,'outcome',v_outcome,'overall_score',p_overall_score,'revision_obligation_id',v_revision_id));

  return jsonb_build_object('attempt_id',v_attempt_id,'session_id',v_session_id,'revision_obligation_id',v_revision_id,'outcome',v_outcome);
end;
$function$;

create or replace function public.get_quran_hifz_workspace(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 40
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := least(greatest(coalesce(p_page_size,40),1),100);
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_can_record boolean := false;
begin
  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.read'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation read permission denied'; end if;

  select exists(
    select 1 from public.membership_roles mr
    join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
    join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
    where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code='learning.recitation.record'
  ) into v_can_record;

  with active_students as (
    select distinct on (e.student_person_id) e.student_person_id,e.id enrollment_id,e.group_id,sp.student_number,p.display_name,p.name_native
    from public.enrollments e
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in ('active','admitted')
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
    order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  )
  select count(*)::integer into v_total from active_students s
  where v_search is null or s.display_name ilike '%'||v_search||'%' or s.student_number ilike '%'||v_search||'%';

  with active_students as (
    select distinct on (e.student_person_id) e.student_person_id,e.id enrollment_id,e.group_id,sp.student_number,p.display_name,p.name_native
    from public.enrollments e
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in ('active','admitted')
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
    order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  ), page_students as (
    select s.* from active_students s
    where v_search is null or s.display_name ilike '%'||v_search||'%' or s.student_number ilike '%'||v_search||'%'
    order by s.display_name,s.student_person_id limit v_page_size offset ((v_page-1)*v_page_size)
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.person_id),'[]'::jsonb) into v_rows
  from (
    select s.student_person_id person_id,s.display_name name,s.name_native,s.student_number,s.group_id,coalesce(g.labels->>'en',g.key) group_name,
      la.occurred_at last_recorded_at,la.work_category last_work_category,la.outcome last_outcome,la.overall_score last_overall_score,
      la.juz_number last_juz_number,la.start_surah_number,la.start_ayah_number,la.end_surah_number,la.end_ayah_number,la.page_start,la.page_end,
      coalesce(rv.due_count,0) revision_due,
      coalesce(mj.memorized_juz,0) memorized_juz,
      sb.sabaq_label,sq.sabqi_label,mn.manzil_label
    from page_students s
    left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=s.group_id
    left join lateral (
      select a.* from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id
      order by a.occurred_at desc,a.id desc limit 1
    ) la on true
    left join lateral (
      select count(*)::integer due_count from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=s.student_person_id and r.state in ('due','assigned','attempted') and r.due_on<=current_date
    ) rv on true
    left join lateral (
      select count(distinct a.juz_number)::integer memorized_juz from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabaq' and a.outcome='passed' and a.juz_number is not null
    ) mj on true
    left join lateral (
      select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end sabaq_label
      from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabaq' order by a.occurred_at desc,a.id desc limit 1
    ) sb on true
    left join lateral (
      select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end sabqi_label
      from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabqi' order by a.occurred_at desc,a.id desc limit 1
    ) sq on true
    left join lateral (
      select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end manzil_label
      from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='manzil' order by a.occurred_at desc,a.id desc limit 1
    ) mn on true
  ) x;

  select jsonb_build_object(
    'students',(select count(*) from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in ('active','admitted') where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'),
    'recorded_today',(select count(distinct a.student_person_id) from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and a.occurred_at::date=current_date),
    'attempts_today',(select count(*) from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and a.occurred_at::date=current_date),
    'revision_due',(select count(*) from public.revision_obligations r join public.enrollments e on e.tenant_id=r.tenant_id and e.student_person_id=r.student_person_id and e.branch_id=p_branch_id and e.status='active' where r.tenant_id=p_tenant_id and r.state in ('due','assigned','attempted') and r.due_on<=current_date),
    'average_today',(select round(avg(a.overall_score),1) from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and a.occurred_at::date=current_date and a.overall_score is not null),
    'repeat_today',(select count(*) from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and a.occurred_at::date=current_date and a.outcome='repeat')
  ) into v_summary;

  return jsonb_build_object('summary',v_summary,'total',v_total,'page',v_page,'page_size',v_page_size,'rows',v_rows,'can_record',v_can_record);
end;
$function$;

revoke execute on function public.record_quran_hifz_attempt(uuid,bigint,bigint,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,bigint,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_quran_hifz_attempt(uuid,bigint,bigint,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,bigint,text,text,text,jsonb) to service_role;
revoke execute on function public.get_quran_hifz_workspace(uuid,bigint,bigint,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_quran_hifz_workspace(uuid,bigint,bigint,text,integer,integer) to service_role;
