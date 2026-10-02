begin;

-- P0 forward-fix: revision_obligations is branchless in the original schema.
-- New obligations carry immutable source-attempt + source-branch provenance.
-- Existing rows are intentionally NOT guessed/backfilled; null provenance fails closed.
alter table public.revision_obligations
  add column if not exists source_branch_id bigint,
  add column if not exists source_recitation_attempt_id bigint;

do $block$
begin
  if not exists(select 1 from pg_constraint where conname='revision_obligations_source_branch_fk' and conrelid='public.revision_obligations'::regclass) then
    alter table public.revision_obligations add constraint revision_obligations_source_branch_fk
      foreign key (tenant_id,source_branch_id) references public.branches(tenant_id,id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='revision_obligations_source_attempt_fk' and conrelid='public.revision_obligations'::regclass) then
    alter table public.revision_obligations add constraint revision_obligations_source_attempt_fk
      foreign key (tenant_id,source_recitation_attempt_id) references public.recitation_attempts(tenant_id,id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='revision_obligations_source_pair_check' and conrelid='public.revision_obligations'::regclass) then
    alter table public.revision_obligations add constraint revision_obligations_source_pair_check check (
      (source_branch_id is null and source_recitation_attempt_id is null)
      or (source_branch_id is not null and source_recitation_attempt_id is not null)
    );
  end if;
end;
$block$;

create index if not exists revision_obligations_source_attempt_idx
  on public.revision_obligations(tenant_id,source_recitation_attempt_id)
  where source_recitation_attempt_id is not null;
create index if not exists revision_obligations_source_branch_due_idx
  on public.revision_obligations(tenant_id,source_branch_id,state,due_on)
  where source_branch_id is not null;

create or replace function public.enforce_quran_revision_source_provenance_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_student bigint;
  v_branch bigint;
begin
  if tg_op='UPDATE' and old.source_recitation_attempt_id is not null and (
    new.source_recitation_attempt_id is distinct from old.source_recitation_attempt_id
    or new.source_branch_id is distinct from old.source_branch_id
  ) then
    raise exception 'Quran revision source provenance is immutable';
  end if;
  if new.source_recitation_attempt_id is null then return new; end if;
  select a.student_person_id,s.branch_id into v_student,v_branch
  from public.recitation_attempts a
  join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id
  where a.tenant_id=new.tenant_id and a.id=new.source_recitation_attempt_id
  limit 1;
  if v_student is null or v_student<>new.student_person_id or v_branch is distinct from new.source_branch_id then
    raise exception 'Quran revision source provenance does not match tenant, branch, and student';
  end if;
  return new;
end;
$$;

drop trigger if exists revision_obligations_source_provenance_guard on public.revision_obligations;
create trigger revision_obligations_source_provenance_guard
before insert or update of source_branch_id,source_recitation_attempt_id,student_person_id on public.revision_obligations
for each row execute function public.enforce_quran_revision_source_provenance_v1();

create or replace function public.quran_revision_obligation_in_branch_v1(
  p_revision_id bigint,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint default null
) returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.revision_obligations r
    join public.recitation_attempts a
      on a.tenant_id=r.tenant_id and a.id=r.source_recitation_attempt_id and a.student_person_id=r.student_person_id
    join public.recitation_sessions s
      on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id
    where r.tenant_id=p_tenant_id and r.id=p_revision_id
      and r.source_recitation_attempt_id is not null and r.source_branch_id is not null
      and r.source_branch_id=p_branch_id and s.branch_id=p_branch_id
      and (p_student_person_id is null or r.student_person_id=p_student_person_id)
  );
$$;

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
    insert into public.revision_obligations(tenant_id,student_person_id,source_branch_id,source_recitation_attempt_id,learning_plan_id,source_type,source_key,start_reference_id,end_reference_id,reading_unit_id,due_on,state)
    values(p_tenant_id,p_student_person_id,p_branch_id,v_attempt_id,null,case when v_outcome='repeat' then 'missed_work' else 'weak_score' end,v_range_key,v_start_reference_id,v_end_reference_id,null,v_revision_due,'due')
    returning id into v_revision_id;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.recitation.record','succeeded','recitation_attempt',v_attempt_id::text,gen_random_uuid(),
    jsonb_build_object('student_person_id',p_student_person_id,'work_category',v_work,'outcome',v_outcome,'overall_score',p_overall_score,'revision_obligation_id',v_revision_id));

  return jsonb_build_object('attempt_id',v_attempt_id,'session_id',v_session_id,'revision_obligation_id',v_revision_id,'outcome',v_outcome);
end;
$function$;

create or replace function public.record_quran_hifz_attempt_idempotent(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_request_key text,p_student_person_id bigint,p_work_category text,
  p_juz_number smallint default null,p_start_surah_number smallint default null,p_start_ayah_number integer default null,
  p_end_surah_number smallint default null,p_end_ayah_number integer default null,p_page_start integer default null,p_page_end integer default null,
  p_accuracy_score numeric default null,p_fluency_score numeric default null,p_tajweed_score numeric default null,p_overall_score numeric default null,
  p_prompts integer default null,p_outcome text default 'passed',p_teacher_person_id bigint default null,p_teacher_remark text default null,
  p_parent_visible_remark text default null,p_private_note text default null,p_mistakes jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_key text := nullif(btrim(coalesce(p_request_key,'')),'');
  v_stable_key text;v_existing_session_id bigint;v_existing_attempt_id bigint;v_result jsonb;v_session_id bigint;v_attempt_id bigint;v_revision_id bigint;
  v_local_date date;v_outcome text := lower(btrim(coalesce(p_outcome,'')));v_range_key text;v_completed integer:=0;
begin
  if v_key is null or length(v_key)<16 or length(v_key)>96 then raise exception 'request key must be between 16 and 96 characters'; end if;
  v_stable_key := 'quran-client:'||v_key;v_local_date:=public.institution_local_date(p_tenant_id);
  perform pg_advisory_xact_lock(hashtextextended(format('quran-attempt:%s:%s:%s',p_tenant_id,p_branch_id,v_stable_key),0));
  select rs.id into v_existing_session_id from public.recitation_sessions rs where rs.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.idempotency_key=v_stable_key limit 1;
  if v_existing_session_id is not null then
    select a.id into v_existing_attempt_id
    from public.recitation_attempts a
    where a.tenant_id=p_tenant_id and a.recitation_session_id=v_existing_session_id
      and a.student_person_id=p_student_person_id
      and a.work_category=lower(btrim(coalesce(p_work_category,'')))
      and a.juz_number is not distinct from p_juz_number
      and a.start_surah_number is not distinct from p_start_surah_number
      and a.start_ayah_number is not distinct from p_start_ayah_number
      and a.end_surah_number is not distinct from p_end_surah_number
      and a.end_ayah_number is not distinct from p_end_ayah_number
      and a.page_start is not distinct from p_page_start
      and a.page_end is not distinct from p_page_end
    order by a.id asc limit 1;
    if v_existing_attempt_id is null then raise exception 'request key is already bound to another Quran target'; end if;
    return jsonb_build_object('attempt_id',v_existing_attempt_id,'session_id',v_existing_session_id,'replayed',true);
  end if;
  v_result:=public.record_quran_hifz_attempt(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id,p_work_category,p_juz_number,p_start_surah_number,p_start_ayah_number,p_end_surah_number,p_end_ayah_number,p_page_start,p_page_end,p_accuracy_score,p_fluency_score,p_tajweed_score,p_overall_score,p_prompts,p_outcome,p_teacher_person_id,p_teacher_remark,p_parent_visible_remark,p_private_note,p_mistakes);
  v_session_id:=nullif(v_result->>'session_id','')::bigint;v_attempt_id:=nullif(v_result->>'attempt_id','')::bigint;v_revision_id:=nullif(v_result->>'revision_obligation_id','')::bigint;
  update public.recitation_sessions set idempotency_key=v_stable_key,session_date=v_local_date,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_session_id;
  if v_revision_id is not null then update public.revision_obligations set due_on=v_local_date+case when v_outcome='repeat' then 1 else 3 end,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_revision_id;end if;
  v_range_key:=case when p_juz_number is not null then 'juz:'||p_juz_number when p_start_surah_number is not null then format('surah:%s:%s-%s:%s',p_start_surah_number,p_start_ayah_number,p_end_surah_number,p_end_ayah_number) else format('pages:%s-%s',p_page_start,p_page_end) end;
  if v_outcome='passed' then
    update public.revision_obligations set state='completed',completed_by_attempt_id=v_attempt_id,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and student_person_id=p_student_person_id and source_key=v_range_key and state in ('due','assigned','attempted')
      and public.quran_revision_obligation_in_branch_v1(id,p_tenant_id,p_branch_id,p_student_person_id);
    get diagnostics v_completed=row_count;
  end if;
  return v_result||jsonb_build_object('replayed',false,'local_date',v_local_date,'revisions_completed',v_completed);
end;
$function$;

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
      and public.quran_revision_obligation_in_branch_v1(o.id,p_tenant_id,p_branch_id,p_student_person_id)
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
        and public.quran_revision_obligation_in_branch_v1(id,p_tenant_id,p_branch_id,p_student_person_id)
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

create or replace function public.get_quran_revision_queue_v2(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_state text default 'open',p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_page integer:=greatest(coalesce(p_page,1),1);v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);v_local_date date:=public.institution_local_date(p_tenant_id);v_total integer;v_rows jsonb;begin
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'learning.recitation.read') then raise exception 'Quran recitation read permission denied';end if;
  select count(*)::integer into v_total from public.revision_obligations r where r.tenant_id=p_tenant_id and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,r.student_person_id) and public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,r.student_person_id) and ((p_state='open' and r.state in('due','assigned','attempted')) or (p_state='completed' and r.state='completed') or p_state='all');
  select coalesce(jsonb_agg(row_to_json(x) order by x.due_on,x.name),'[]'::jsonb) into v_rows from(select r.id,r.student_person_id,p.display_name name,sp.student_number,r.source_type,r.source_key,r.due_on,r.state,(r.due_on<v_local_date and r.state in('due','assigned','attempted')) overdue,r.created_at from public.revision_obligations r join public.persons p on p.tenant_id=r.tenant_id and p.id=r.student_person_id join public.student_profiles sp on sp.tenant_id=r.tenant_id and sp.person_id=r.student_person_id where r.tenant_id=p_tenant_id and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,r.student_person_id) and public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,r.student_person_id) and ((p_state='open' and r.state in('due','assigned','attempted')) or (p_state='completed' and r.state='completed') or p_state='all') order by r.due_on,p.display_name limit v_size offset((v_page-1)*v_size))x;
  return jsonb_build_object('local_date',v_local_date,'total',v_total,'page',v_page,'page_size',v_size,'rows',v_rows);
end;$$;

create or replace function public.get_quran_student_detail_v2(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_limit integer default 60)
returns jsonb language plpgsql set search_path to '' as $function$
declare
  v_membership_id bigint;v_can_correct boolean:=false;v_limit integer:=least(greatest(coalesce(p_limit,60),1),200);v_student jsonb;v_summary jsonb;v_attempts jsonb;v_mistakes jsonb;v_revisions jsonb;
begin
  select m.id into v_membership_id from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.read') order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation read permission denied';end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code='learning.recitation.correct') into v_can_correct;
  select jsonb_build_object('person_id',p.id,'name',p.display_name,'name_native',p.name_native,'student_number',sp.student_number,'group_id',e.group_id,'group_name',coalesce(g.labels->>'en',g.key)) into v_student
  from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active' and sp.status in('active','admitted') order by e.starts_on desc nulls last,e.id desc limit 1;
  if v_student is null then raise exception 'student is not actively enrolled in this branch';end if;
  select jsonb_build_object('attempts',count(*),'average_score',round(avg(a.overall_score),1),'passed',count(*) filter(where a.outcome='passed'),'repeat',count(*) filter(where a.outcome='repeat'),'last_recorded_at',max(a.occurred_at),'open_revision',(select count(*) from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=p_student_person_id and public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,p_student_person_id) and r.state in('due','assigned','attempted'))) into v_summary
  from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id;
  select coalesce(jsonb_agg(row_to_json(x) order by x.occurred_at desc,x.id desc),'[]'::jsonb) into v_attempts from(
    select a.id,a.work_category,a.outcome,a.accuracy_score,a.fluency_score,a.tajweed_score,a.overall_score,a.prompts,a.teacher_remark,a.parent_visible_remark,a.private_note,a.occurred_at,a.correction_id,a.correction_reason,a.corrected_at,
      case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end target_label,
      (select coalesce(jsonb_agg(jsonb_build_object('category',m.category_key,'severity',m.severity,'count',m.count,'note',m.note) order by m.id),'[]'::jsonb) from public.recitation_mistakes m where m.tenant_id=a.tenant_id and m.recitation_attempt_id=a.id) mistakes
    from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id order by a.occurred_at desc,a.id desc limit v_limit
  )x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.total_count desc,x.category),'[]'::jsonb) into v_mistakes from(select m.category_key category,sum(m.count)::integer total_count,max(m.severity) max_severity,count(distinct m.recitation_attempt_id)::integer sessions from public.recitation_mistakes m join public.quran_effective_recitation_attempts_v1 a on a.tenant_id=m.tenant_id and a.id=m.recitation_attempt_id join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where m.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id group by m.category_key)x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.due_on,x.id),'[]'::jsonb) into v_revisions from(select r.id,r.source_type,r.source_key,r.due_on,r.state,r.created_at,r.completed_by_attempt_id from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=p_student_person_id and public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,p_student_person_id) and r.state<>'cancelled' order by r.due_on desc limit 100)x;
  return jsonb_build_object('student',v_student,'summary',v_summary,'attempts',v_attempts,'mistake_summary',v_mistakes,'revisions',v_revisions,'can_correct',v_can_correct);
end;$function$;

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
    left join lateral(select count(*)::integer due_count from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=s.student_person_id and public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,s.student_person_id) and r.state in('due','assigned','attempted') and r.due_on<=v_local_date)rv on true
    left join lateral(select count(distinct a.juz_number)::integer passed_juz from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabaq' and a.outcome='passed' and a.juz_number is not null)mj on true
    left join lateral(select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%sâ€“%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %sâ€“%s',a.page_start,a.page_end) end sabaq_label from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabaq' order by a.occurred_at desc,a.id desc limit 1)sb on true
    left join lateral(select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%sâ€“%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %sâ€“%s',a.page_start,a.page_end) end sabqi_label from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabqi' order by a.occurred_at desc,a.id desc limit 1)sq on true
    left join lateral(select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%sâ€“%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %sâ€“%s',a.page_start,a.page_end) end manzil_label from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id and a.work_category='manzil' order by a.occurred_at desc,a.id desc limit 1)mn on true
  )x;

  select jsonb_build_object(
    'students',(select count(distinct e.student_person_id) from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted') where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active' and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,e.student_person_id)),
    'recorded_today',(select count(distinct a.student_person_id) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)),
    'attempts_today',(select count(*) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)),
    'revision_due',(select count(*) from public.revision_obligations r where r.tenant_id=p_tenant_id and r.state in('due','assigned','attempted') and r.due_on<=v_local_date and public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,r.student_person_id) and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,r.student_person_id)),
    'average_today',(select round(avg(a.overall_score),1) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and a.overall_score is not null and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)),
    'repeat_today',(select count(*) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and a.outcome='repeat' and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id))
  ) into v_summary;
  return jsonb_build_object('local_date',v_local_date,'summary',v_summary,'total',v_total,'page',v_page,'page_size',v_page_size,'rows',v_rows,'can_record',v_can_record);
end;
$$;

create or replace function public.get_quran_hifz_daily_register_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_group_id bigint default null,
  p_session_date date default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_local_date date:=public.institution_local_date(p_tenant_id);
  v_date date:=coalesce(p_session_date,public.institution_local_date(p_tenant_id));
  v_can_record boolean:=false;
  v_groups jsonb:='[]'::jsonb;
  v_rows jsonb:='[]'::jsonb;
  v_summary jsonb:='{}'::jsonb;
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
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.read'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation read permission denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch is required'; end if;
  if v_date>v_local_date or v_date<v_local_date-90 then raise exception 'daily register date must be within the last 90 days'; end if;

  select exists(
    select 1 from public.membership_roles mr
    join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
    join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
    where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code='learning.recitation.record'
  ) into v_can_record;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'key',g.key,'label',coalesce(g.labels->>'en',g.key),'students',coalesce(ec.students,0)
  ) order by coalesce(g.labels->>'en',g.key),g.id),'[]'::jsonb)
  into v_groups
  from public.academic_groups g
  left join lateral (
    select count(distinct e.student_person_id)::integer students
    from public.enrollments e
    where e.tenant_id=g.tenant_id and e.branch_id=g.branch_id and e.group_id=g.id and e.status='active'
  ) ec on true
  where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.status='active' and coalesce(ec.students,0)>0;

  if p_group_id is not null then
    if not exists(select 1 from public.academic_groups g where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.id=p_group_id and g.status='active') then raise exception 'active Halaqah or group is required'; end if;

    with roster as (
      select distinct on(e.student_person_id)
        e.student_person_id,sp.student_number,p.display_name,p.name_native
      from public.enrollments e
      join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in ('active','admitted')
      join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id and e.status='active'
      order by e.student_person_id,e.starts_on desc nulls last,e.id desc
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'person_id',r.student_person_id,
      'name',r.display_name,
      'name_native',r.name_native,
      'student_number',r.student_number,
      'sabaq',sb.label,
      'sabqi',sq.label,
      'manzil',mn.label,
      'quality_score',coalesce(today.overall_score,last_attempt.overall_score),
      'day_status',coalesce(today.outcome,day_status.status),
      'mistake_count',coalesce(today.mistakes,0),
      'revision_due',coalesce(rev.due_count,0),
      'revision_due_on',rev.next_due_on,
      'memorized_juz',coalesce(juz.passed_juz,0),
      'next_target',case when target.id is null then null else jsonb_build_object(
        'id',target.id,'work_category',target.work_category,'mode',target.target_mode,'label',target.label,
        'juz_number',target.juz_number,'start_surah_number',target.start_surah_number,'start_ayah_number',target.start_ayah_number,
        'end_surah_number',target.end_surah_number,'end_ayah_number',target.end_ayah_number,'page_start',target.page_start,'page_end',target.page_end
      ) end,
      'repeat_target',case when fallback.id is null then null else jsonb_build_object(
        'work_category',fallback.work_category,'mode',fallback.target_mode,'label',fallback.label,
        'juz_number',fallback.juz_number,'start_surah_number',fallback.start_surah_number,'start_ayah_number',fallback.start_ayah_number,
        'end_surah_number',fallback.end_surah_number,'end_ayah_number',fallback.end_ayah_number,'page_start',fallback.page_start,'page_end',fallback.page_end
      ) end
    ) order by r.display_name,r.student_person_id),'[]'::jsonb)
    into v_rows
    from roster r
    left join lateral (
      select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end label
      from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and rs.session_date<=v_date and a.work_category='sabaq'
      order by rs.session_date desc,a.occurred_at desc,a.id desc limit 1
    ) sb on true
    left join lateral (
      select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end label
      from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and rs.session_date<=v_date and a.work_category='sabqi'
      order by rs.session_date desc,a.occurred_at desc,a.id desc limit 1
    ) sq on true
    left join lateral (
      select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end label
      from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and rs.session_date<=v_date and a.work_category='manzil'
      order by rs.session_date desc,a.occurred_at desc,a.id desc limit 1
    ) mn on true
    left join lateral (
      select a.id,a.overall_score,a.outcome,coalesce((select sum(m.count)::integer from public.recitation_mistakes m where m.tenant_id=a.tenant_id and m.recitation_attempt_id=a.id),0) mistakes
      from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date=v_date
      order by a.occurred_at desc,a.id desc limit 1
    ) today on true
    left join lateral (
      select a.overall_score
      from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and rs.session_date<=v_date
      order by rs.session_date desc,a.occurred_at desc,a.id desc limit 1
    ) last_attempt on true
    left join lateral (
      select s.status from public.quran_daily_roster_statuses s
      where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.group_id=p_group_id and s.student_person_id=r.student_person_id and s.session_date=v_date limit 1
    ) day_status on true
    left join lateral (
      select count(*)::integer due_count,min(o.due_on) next_due_on from public.revision_obligations o
      where o.tenant_id=p_tenant_id and o.student_person_id=r.student_person_id and public.quran_revision_obligation_in_branch_v1(o.id,p_tenant_id,p_branch_id,r.student_person_id) and o.state in ('due','assigned','attempted') and o.due_on<=v_date
    ) rev on true
    left join lateral (
      select count(distinct a.juz_number)::integer passed_juz
      from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and rs.session_date<=v_date and a.work_category='sabaq' and a.outcome='passed' and a.juz_number is not null
    ) juz on true
    left join lateral (
      select t.*,case when t.juz_number is not null then 'Juz '||t.juz_number when t.start_surah_number is not null then format('%s:%s–%s:%s',t.start_surah_number,t.start_ayah_number,t.end_surah_number,t.end_ayah_number) else format('Pages %s–%s',t.page_start,t.page_end) end label
      from public.quran_student_targets t
      where t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.student_person_id=r.student_person_id and t.status='active' and t.assigned_on<=v_date
      order by case t.work_category when 'sabaq' then 1 when 'sabqi' then 2 when 'manzil' then 3 else 4 end,t.assigned_on desc,t.id desc limit 1
    ) target on true
    left join lateral (
      select a.id,a.work_category,case when a.juz_number is not null then 'juz' when a.start_surah_number is not null then 'ayah' else 'page' end target_mode,
        a.juz_number,a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number,a.page_start,a.page_end,
        case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end label
      from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and rs.session_date<=v_date
      order by rs.session_date desc,a.occurred_at desc,a.id desc limit 1
    ) fallback on true;
  end if;

  select jsonb_build_object(
    'students',case when p_group_id is null then 0 else jsonb_array_length(v_rows) end,
    'recorded',case when p_group_id is null then 0 else (
      select count(distinct a.student_person_id) from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date=v_date
    ) end,
    'needs_support',case when p_group_id is null then 0 else (
      select count(distinct a.student_person_id) from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date=v_date and a.outcome='partial'
    ) end,
    'revision_due',case when p_group_id is null then 0 else (
      select count(*) from public.revision_obligations o
      where o.tenant_id=p_tenant_id and o.state in ('due','assigned','attempted') and o.due_on<=v_date
        and public.quran_revision_obligation_in_branch_v1(o.id,p_tenant_id,p_branch_id,o.student_person_id)
        and exists(select 1 from public.enrollments e where e.tenant_id=o.tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id and e.student_person_id=o.student_person_id and e.status='active')
    ) end,
    'monthly_attempts',case when p_group_id is null then 0 else (
      select count(*) from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id
        and rs.session_date>=date_trunc('month',v_date)::date and rs.session_date<=v_date
    ) end,
    'monthly_average',case when p_group_id is null then null else (
      select round(avg(a.overall_score),1) from public.quran_effective_recitation_attempts_v1 a
      join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id
        and rs.session_date>=date_trunc('month',v_date)::date and rs.session_date<=v_date and a.overall_score is not null
    ) end
  ) into v_summary;

  return jsonb_build_object('local_date',v_local_date,'selected_date',v_date,'selected_group_id',p_group_id,'groups',v_groups,'rows',v_rows,'summary',v_summary,'can_record',v_can_record);
end;
$$;

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
      'revision_due',(select count(*) from public.revision_obligations o where o.tenant_id=p_tenant_id and o.state in('due','assigned','attempted') and o.due_on<=v_date and public.quran_revision_obligation_in_branch_v1(o.id,p_tenant_id,p_branch_id,o.student_person_id) and exists(select 1 from public.enrollments e where e.tenant_id=o.tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id and e.student_person_id=o.student_person_id and e.status='active') and public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,o.student_person_id)),
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

create or replace function public.correct_quran_recitation_attempt_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_request_key text,
  p_recitation_attempt_id bigint,
  p_reason text,
  p_accuracy_score numeric,
  p_fluency_score numeric,
  p_tajweed_score numeric,
  p_overall_score numeric,
  p_prompts integer,
  p_outcome text,
  p_teacher_remark text default null,
  p_parent_visible_remark text default null,
  p_private_note text default null
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_stable_key text;
  v_existing_id bigint;
  v_existing_attempt_id bigint;
  v_student_person_id bigint;
  v_juz_number smallint;
  v_start_surah smallint;
  v_start_ayah integer;
  v_end_surah smallint;
  v_end_ayah integer;
  v_page_start integer;
  v_page_end integer;
  v_start_reference_id bigint;
  v_end_reference_id bigint;
  v_range_key text;
  v_outcome text := lower(btrim(coalesce(p_outcome,'')));
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_correction_id bigint;
  v_completed integer := 0;
  v_created_revision_id bigint;
  v_local_date date := public.institution_local_date(p_tenant_id);
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_recitation_attempt_id is null then
    raise exception 'identity, tenant, branch, and attempt are required';
  end if;
  if p_request_key is null or length(btrim(p_request_key)) < 16 or length(btrim(p_request_key)) > 96 then
    raise exception 'request key must be between 16 and 96 characters';
  end if;
  if v_reason is null or length(v_reason) < 5 or length(v_reason) > 500 then raise exception 'correction reason must be between 5 and 500 characters'; end if;
  if v_outcome not in ('passed','partial','repeat','excused','not_attempted') then raise exception 'recitation outcome is invalid'; end if;
  if p_accuracy_score is not null and (p_accuracy_score < 0 or p_accuracy_score > 100) then raise exception 'accuracy score is invalid'; end if;
  if p_fluency_score is not null and (p_fluency_score < 0 or p_fluency_score > 100) then raise exception 'fluency score is invalid'; end if;
  if p_tajweed_score is not null and (p_tajweed_score < 0 or p_tajweed_score > 100) then raise exception 'tajweed score is invalid'; end if;
  if p_overall_score is not null and (p_overall_score < 0 or p_overall_score > 100) then raise exception 'overall score is invalid'; end if;
  if p_prompts is not null and p_prompts < 0 then raise exception 'prompts cannot be negative'; end if;
  if p_teacher_remark is not null and length(p_teacher_remark) > 1000 then raise exception 'teacher remark is too long'; end if;
  if p_parent_visible_remark is not null and length(p_parent_visible_remark) > 1000 then raise exception 'parent remark is too long'; end if;
  if p_private_note is not null and length(p_private_note) > 1000 then raise exception 'private note is too long'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.correct'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation correction permission denied'; end if;

  v_stable_key := 'quran-correction:' || btrim(p_request_key);
  perform pg_advisory_xact_lock(hashtextextended(format('quran-correction:%s:%s:%s',p_tenant_id,p_branch_id,v_stable_key),0));

  select c.id,c.recitation_attempt_id into v_existing_id,v_existing_attempt_id
  from public.recitation_attempt_corrections c
  where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id and c.request_key=v_stable_key
  order by c.id desc limit 1;
  if v_existing_id is not null then
    if v_existing_attempt_id<>p_recitation_attempt_id then raise exception 'request key is already bound to another recitation attempt'; end if;
    return jsonb_build_object('correction_id',v_existing_id,'attempt_id',v_existing_attempt_id,'replayed',true);
  end if;

  select a.student_person_id,a.juz_number,a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number,a.page_start,a.page_end,a.start_reference_id,a.end_reference_id
  into v_student_person_id,v_juz_number,v_start_surah,v_start_ayah,v_end_surah,v_end_ayah,v_page_start,v_page_end,v_start_reference_id,v_end_reference_id
  from public.recitation_attempts a
  join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id
  where a.tenant_id=p_tenant_id and a.id=p_recitation_attempt_id and s.branch_id=p_branch_id
  limit 1;
  if v_student_person_id is null then raise exception 'recitation attempt was not found in this branch'; end if;

  insert into public.recitation_attempt_corrections(
    tenant_id,branch_id,recitation_attempt_id,request_key,corrected_by_identity_id,corrected_by_membership_id,reason,
    accuracy_score,fluency_score,tajweed_score,overall_score,prompts,outcome,teacher_remark,parent_visible_remark,private_note
  ) values(
    p_tenant_id,p_branch_id,p_recitation_attempt_id,v_stable_key,p_identity_id,v_membership_id,v_reason,
    p_accuracy_score,p_fluency_score,p_tajweed_score,p_overall_score,p_prompts,v_outcome,
    nullif(btrim(coalesce(p_teacher_remark,'')),''),nullif(btrim(coalesce(p_parent_visible_remark,'')),''),nullif(btrim(coalesce(p_private_note,'')),'')
  ) returning id into v_correction_id;

  v_range_key := case
    when v_juz_number is not null then 'juz:'||v_juz_number
    when v_start_surah is not null then format('surah:%s:%s-%s:%s',v_start_surah,v_start_ayah,v_end_surah,v_end_ayah)
    else format('pages:%s-%s',v_page_start,v_page_end)
  end;

  if v_outcome='passed' then
    update public.revision_obligations
    set state='completed',completed_by_attempt_id=p_recitation_attempt_id,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and student_person_id=v_student_person_id and source_key=v_range_key and state in ('due','assigned','attempted')
      and public.quran_revision_obligation_in_branch_v1(id,p_tenant_id,p_branch_id,v_student_person_id);
    get diagnostics v_completed=row_count;
  elsif v_outcome='repeat' or (p_overall_score is not null and p_overall_score<70) then
    if not exists(
      select 1 from public.revision_obligations r
      where r.tenant_id=p_tenant_id and r.student_person_id=v_student_person_id and r.source_key=v_range_key and r.state in ('due','assigned','attempted')
        and public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,v_student_person_id)
    ) then
      insert into public.revision_obligations(tenant_id,student_person_id,source_branch_id,source_recitation_attempt_id,learning_plan_id,source_type,source_key,start_reference_id,end_reference_id,reading_unit_id,due_on,state)
      values(p_tenant_id,v_student_person_id,p_branch_id,p_recitation_attempt_id,null,case when v_outcome='repeat' then 'missed_work' else 'weak_score' end,v_range_key,v_start_reference_id,v_end_reference_id,null,v_local_date+case when v_outcome='repeat' then 1 else 3 end,'due')
      returning id into v_created_revision_id;
    end if;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state)
  select p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.recitation.correct','succeeded','recitation_attempt',p_recitation_attempt_id::text,gen_random_uuid(),
    jsonb_build_object('accuracy_score',a.accuracy_score,'fluency_score',a.fluency_score,'tajweed_score',a.tajweed_score,'overall_score',a.overall_score,'prompts',a.prompts,'outcome',a.outcome,'teacher_remark',a.teacher_remark,'parent_visible_remark',a.parent_visible_remark),
    jsonb_build_object('correction_id',v_correction_id,'reason',v_reason,'accuracy_score',p_accuracy_score,'fluency_score',p_fluency_score,'tajweed_score',p_tajweed_score,'overall_score',p_overall_score,'prompts',p_prompts,'outcome',v_outcome,'teacher_remark',p_teacher_remark,'parent_visible_remark',p_parent_visible_remark,'revision_completed',v_completed,'revision_created',v_created_revision_id)
  from public.recitation_attempts a
  join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id
  where a.tenant_id=p_tenant_id and a.id=p_recitation_attempt_id and s.branch_id=p_branch_id;

  return jsonb_build_object('correction_id',v_correction_id,'attempt_id',p_recitation_attempt_id,'outcome',v_outcome,'replayed',false,'revisions_completed',v_completed,'revision_created',v_created_revision_id);
end;
$function$;

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

revoke all on function public.enforce_quran_revision_source_provenance_v1() from public,anon,authenticated;
grant execute on function public.enforce_quran_revision_source_provenance_v1() to service_role;
revoke all on function public.quran_revision_obligation_in_branch_v1(bigint,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.quran_revision_obligation_in_branch_v1(bigint,bigint,bigint,bigint) to service_role;

-- These are internal implementation functions only; application service_role must use scoped entry points.
revoke execute on function public.record_quran_hifz_attempt(uuid,bigint,bigint,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,bigint,text,text,text,jsonb) from service_role;
revoke execute on function public.record_quran_hifz_attempt_idempotent(uuid,bigint,bigint,text,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,bigint,text,text,text,jsonb) from service_role;
revoke execute on function public.record_quran_hifz_daily_quick_v1(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,bigint,text,jsonb,date) from service_role;
revoke execute on function public.get_quran_hifz_daily_register_v1(uuid,bigint,bigint,bigint,date) from service_role;
revoke execute on function public.get_quran_student_detail_v2(uuid,bigint,bigint,bigint,integer) from service_role;
revoke execute on function public.correct_quran_recitation_attempt_v1(uuid,bigint,bigint,text,bigint,text,numeric,numeric,numeric,numeric,integer,text,text,text,text) from service_role;

-- Reassert browser-role denial and scoped application entry-point execution after the forward replacements.
revoke all on function public.get_quran_revision_queue_v2(uuid,bigint,bigint,text,integer,integer) from public,anon,authenticated;
revoke all on function public.get_quran_hifz_workspace_v4(uuid,bigint,bigint,text,integer,integer) from public,anon,authenticated;
revoke all on function public.get_quran_hifz_daily_register_v2(uuid,bigint,bigint,bigint,date) from public,anon,authenticated;
revoke all on function public.correct_quran_recitation_attempt_scoped_v1(uuid,bigint,bigint,text,bigint,text,numeric,numeric,numeric,numeric,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.get_quran_revision_queue_v2(uuid,bigint,bigint,text,integer,integer) to service_role;
grant execute on function public.get_quran_hifz_workspace_v4(uuid,bigint,bigint,text,integer,integer) to service_role;
grant execute on function public.get_quran_hifz_daily_register_v2(uuid,bigint,bigint,bigint,date) to service_role;
grant execute on function public.correct_quran_recitation_attempt_scoped_v1(uuid,bigint,bigint,text,bigint,text,numeric,numeric,numeric,numeric,integer,text,text,text,text) to service_role;

commit;
