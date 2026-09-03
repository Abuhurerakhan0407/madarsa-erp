begin;

create table public.quran_student_targets (
  id bigint generated always as identity primary key,
  tenant_id bigint not null,
  branch_id bigint not null,
  student_person_id bigint not null,
  work_category text not null,
  target_mode text not null,
  juz_number smallint,
  start_surah_number smallint,
  start_ayah_number integer,
  end_surah_number smallint,
  end_ayah_number integer,
  page_start integer,
  page_end integer,
  assigned_on date not null,
  due_on date,
  status text not null default 'active',
  source_attempt_id bigint,
  repeated_from_target_id bigint,
  teacher_person_id bigint,
  created_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quran_student_targets_branch_fk foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete cascade,
  constraint quran_student_targets_student_fk foreign key (tenant_id,student_person_id) references public.persons(tenant_id,id) on delete cascade,
  constraint quran_student_targets_attempt_fk foreign key (tenant_id,source_attempt_id) references public.recitation_attempts(tenant_id,id) on delete set null,
  constraint quran_student_targets_teacher_fk foreign key (tenant_id,teacher_person_id) references public.employee_profiles(tenant_id,person_id) on delete set null,
  constraint quran_student_targets_membership_fk foreign key (tenant_id,created_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  constraint quran_student_targets_repeat_fk foreign key (repeated_from_target_id) references public.quran_student_targets(id) on delete set null,
  constraint quran_student_targets_work_check check (work_category in ('sabaq','sabqi','manzil','nazra','qaida','tajweed')),
  constraint quran_student_targets_mode_check check (target_mode in ('juz','ayah','page')),
  constraint quran_student_targets_status_check check (status in ('active','completed','superseded','cancelled')),
  constraint quran_student_targets_due_check check (due_on is null or due_on>=assigned_on),
  constraint quran_student_targets_target_check check (
    (target_mode='juz' and juz_number between 1 and 30 and start_surah_number is null and start_ayah_number is null and end_surah_number is null and end_ayah_number is null and page_start is null and page_end is null)
    or
    (target_mode='ayah' and juz_number is null and start_surah_number between 1 and 114 and end_surah_number between 1 and 114 and start_ayah_number>0 and end_ayah_number>0 and (end_surah_number>start_surah_number or (end_surah_number=start_surah_number and end_ayah_number>=start_ayah_number)) and page_start is null and page_end is null)
    or
    (target_mode='page' and juz_number is null and start_surah_number is null and start_ayah_number is null and end_surah_number is null and end_ayah_number is null and page_start between 1 and 604 and page_end between page_start and 604)
  )
);

create unique index quran_student_targets_one_active
  on public.quran_student_targets(tenant_id,branch_id,student_person_id,work_category)
  where status='active';
create index quran_student_targets_student_history
  on public.quran_student_targets(tenant_id,student_person_id,assigned_on desc,id desc);

create table public.quran_daily_roster_statuses (
  id bigint generated always as identity primary key,
  tenant_id bigint not null,
  branch_id bigint not null,
  group_id bigint not null,
  student_person_id bigint not null,
  session_date date not null,
  status text not null,
  note text,
  recorded_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quran_daily_roster_statuses_branch_fk foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete cascade,
  constraint quran_daily_roster_statuses_student_fk foreign key (tenant_id,student_person_id) references public.persons(tenant_id,id) on delete cascade,
  constraint quran_daily_roster_statuses_membership_fk foreign key (tenant_id,recorded_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  constraint quran_daily_roster_statuses_status_check check (status in ('absent','no_lesson')),
  constraint quran_daily_roster_statuses_note_check check (note is null or length(note)<=500),
  unique (tenant_id,branch_id,group_id,student_person_id,session_date)
);
create index quran_daily_roster_statuses_group_date
  on public.quran_daily_roster_statuses(tenant_id,branch_id,group_id,session_date);

alter table public.quran_student_targets enable row level security;
alter table public.quran_daily_roster_statuses enable row level security;
revoke all on public.quran_student_targets from public,anon,authenticated;
revoke all on public.quran_daily_roster_statuses from public,anon,authenticated;
grant select,insert,update,delete on public.quran_student_targets to service_role;
grant select,insert,update,delete on public.quran_daily_roster_statuses to service_role;
grant usage,select on sequence public.quran_student_targets_id_seq to service_role;
grant usage,select on sequence public.quran_daily_roster_statuses_id_seq to service_role;

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

  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'label',coalesce(g.labels->>'en',g.key),'key',g.key) order by coalesce(g.labels->>'en',g.key),g.id),'[]'::jsonb)
  into v_groups
  from public.academic_groups g
  where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.status='active'
    and exists(select 1 from public.enrollments e where e.tenant_id=g.tenant_id and e.branch_id=g.branch_id and e.group_id=g.id and e.status='active');

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
    select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.person_id),'[]'::jsonb) into v_rows
    from (
      select
        r.student_person_id person_id,r.display_name name,r.name_native,r.student_number,
        sb.label sabaq_label,sq.label sabqi_label,mn.label manzil_label,
        coalesce(day_attempt.overall_score,last_attempt.overall_score) quality_score,
        coalesce(day_attempt.outcome,day_status.status) day_status,
        coalesce(day_attempt.mistake_count,0) mistake_count,
        coalesce(rv.due_count,0) revision_due,
        rv.next_due_on revision_due_on,
        coalesce(mj.passed_juz,0) memorized_juz,
        current_target.id current_target_id,
        current_target.work_category current_target_work_category,
        current_target.target_mode current_target_mode,
        current_target.juz_number current_target_juz_number,
        current_target.start_surah_number current_target_start_surah_number,
        current_target.start_ayah_number current_target_start_ayah_number,
        current_target.end_surah_number current_target_end_surah_number,
        current_target.end_ayah_number current_target_end_ayah_number,
        current_target.page_start current_target_page_start,
        current_target.page_end current_target_page_end,
        current_target.target_label next_target_label,
        fallback_target.work_category fallback_work_category,
        fallback_target.target_mode fallback_target_mode,
        fallback_target.juz_number fallback_juz_number,
        fallback_target.start_surah_number fallback_start_surah_number,
        fallback_target.start_ayah_number fallback_start_ayah_number,
        fallback_target.end_surah_number fallback_end_surah_number,
        fallback_target.end_ayah_number fallback_end_ayah_number,
        fallback_target.page_start fallback_page_start,
        fallback_target.page_end fallback_page_end,
        fallback_target.target_label fallback_target_label
      from roster r
      left join lateral (
        select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end label
        from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabaq'
        order by a.occurred_at desc,a.id desc limit 1
      ) sb on true
      left join lateral (
        select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end label
        from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabqi'
        order by a.occurred_at desc,a.id desc limit 1
      ) sq on true
      left join lateral (
        select case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end label
        from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and a.work_category='manzil'
        order by a.occurred_at desc,a.id desc limit 1
      ) mn on true
      left join lateral (
        select a.id,a.overall_score,a.outcome,coalesce((select sum(m.count)::integer from public.recitation_mistakes m where m.tenant_id=a.tenant_id and m.recitation_attempt_id=a.id),0) mistake_count
        from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date=v_date
        order by a.occurred_at desc,a.id desc limit 1
      ) day_attempt on true
      left join lateral (
        select a.overall_score
        from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id
        order by a.occurred_at desc,a.id desc limit 1
      ) last_attempt on true
      left join lateral (
        select s.status from public.quran_daily_roster_statuses s
        where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.group_id=p_group_id and s.student_person_id=r.student_person_id and s.session_date=v_date limit 1
      ) day_status on true
      left join lateral (
        select count(*)::integer due_count,min(o.due_on) next_due_on
        from public.revision_obligations o
        where o.tenant_id=p_tenant_id and o.student_person_id=r.student_person_id and o.state in ('due','assigned','attempted') and o.due_on<=v_date
      ) rv on true
      left join lateral (
        select count(distinct a.juz_number)::integer passed_juz
        from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id and a.work_category='sabaq' and a.outcome='passed' and a.juz_number is not null
      ) mj on true
      left join lateral (
        select t.id,t.work_category,t.target_mode,t.juz_number,t.start_surah_number,t.start_ayah_number,t.end_surah_number,t.end_ayah_number,t.page_start,t.page_end,
          case when t.juz_number is not null then 'Juz '||t.juz_number when t.start_surah_number is not null then format('%s:%s–%s:%s',t.start_surah_number,t.start_ayah_number,t.end_surah_number,t.end_ayah_number) else format('Pages %s–%s',t.page_start,t.page_end) end target_label
        from public.quran_student_targets t
        where t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.student_person_id=r.student_person_id and t.status='active'
        order by case t.work_category when 'sabaq' then 1 when 'sabqi' then 2 when 'manzil' then 3 else 4 end,t.assigned_on desc,t.id desc limit 1
      ) current_target on true
      left join lateral (
        select a.work_category,
          case when a.juz_number is not null then 'juz' when a.start_surah_number is not null then 'ayah' else 'page' end target_mode,
          a.juz_number,a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number,a.page_start,a.page_end,
          case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end target_label
        from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=r.student_person_id and rs.branch_id=p_branch_id
        order by a.occurred_at desc,a.id desc limit 1
      ) fallback_target on true
    ) x;
  end if;

  select jsonb_build_object(
    'students',case when p_group_id is null then 0 else jsonb_array_length(v_rows) end,
    'recorded',case when p_group_id is null then 0 else (select count(distinct a.student_person_id) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date=v_date) end,
    'needs_support',case when p_group_id is null then 0 else (select count(distinct a.student_person_id) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date=v_date and a.outcome='partial') end,
    'revision_due',case when p_group_id is null then 0 else (select count(*) from public.revision_obligations o where o.tenant_id=p_tenant_id and o.state in ('due','assigned','attempted') and o.due_on<=v_date and exists(select 1 from public.enrollments e where e.tenant_id=o.tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id and e.student_person_id=o.student_person_id and e.status='active')) end,
    'monthly_attempts',case when p_group_id is null then 0 else (select count(*) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date>=date_trunc('month',v_date)::date and rs.session_date<(date_trunc('month',v_date)+interval '1 month')::date) end,
    'monthly_average',case when p_group_id is null then null else (select round(avg(a.overall_score),1) from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.group_id=p_group_id and rs.session_date>=date_trunc('month',v_date)::date and rs.session_date<(date_trunc('month',v_date)+interval '1 month')::date and a.overall_score is not null) end
  ) into v_summary;

  return jsonb_build_object('local_date',v_local_date,'selected_date',v_date,'selected_group_id',p_group_id,'groups',v_groups,'rows',v_rows,'summary',v_summary,'can_record',v_can_record);
end;
$$;
revoke all on function public.get_quran_hifz_daily_register_v1(uuid,bigint,bigint,bigint,date) from public,anon,authenticated;
grant execute on function public.get_quran_hifz_daily_register_v1(uuid,bigint,bigint,bigint,date) to service_role;

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
as $$;
-- placeholder replaced below
$$;

-- Replace placeholder function body with governed implementation.
create or replace function public.record_quran_hifz_daily_quick_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_request_key text,p_group_id bigint,p_session_date date,p_student_person_id bigint,p_work_category text,p_action text,p_target jsonb default null,p_quality_score numeric default null,p_tajweed_score numeric default null,p_fluency_score numeric default null,p_mistake_count integer default 0,p_teacher_person_id bigint default null,p_teacher_note text default null,p_next_target jsonb default null,p_revision_due_on date default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membership_id bigint;v_local_date date:=public.institution_local_date(p_tenant_id);v_action text:=lower(btrim(coalesce(p_action,'')));v_work text:=lower(btrim(coalesce(p_work_category,'sabaq')));v_outcome text;
  v_target jsonb:=p_target;v_mode text;v_juz smallint;v_ss smallint;v_sa integer;v_es smallint;v_ea integer;v_ps integer;v_pe integer;
  v_result jsonb;v_attempt_id bigint;v_session_id bigint;v_revision_id bigint;v_existing_target_id bigint;v_next_id bigint;v_mistakes jsonb:='[]'::jsonb;
  v_next_mode text;v_next_juz smallint;v_next_ss smallint;v_next_sa integer;v_next_es smallint;v_next_ea integer;v_next_ps integer;v_next_pe integer;v_next_work text;
begin
  select m.id into v_membership_id from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.record')
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation recording permission denied'; end if;
  if p_session_date is null or p_session_date>v_local_date or p_session_date<v_local_date-90 then raise exception 'daily register date must be within the last 90 days'; end if;
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
    on conflict (tenant_id,branch_id,group_id,student_person_id,session_date) do update set status=excluded.status,note=excluded.note,recorded_by_membership_id=excluded.recorded_by_membership_id,updated_at=clock_timestamp();
    insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
    values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.recitation.daily_status','succeeded','student',p_student_person_id::text,gen_random_uuid(),jsonb_build_object('group_id',p_group_id,'session_date',p_session_date,'status',v_action));
    return jsonb_build_object('status',v_action,'student_person_id',p_student_person_id,'session_date',p_session_date,'recorded',false);
  end if;

  if v_target is null then
    select jsonb_build_object('mode',t.target_mode,'juz_number',t.juz_number,'start_surah_number',t.start_surah_number,'start_ayah_number',t.start_ayah_number,'end_surah_number',t.end_surah_number,'end_ayah_number',t.end_ayah_number,'page_start',t.page_start,'page_end',t.page_end),t.id
    into v_target,v_existing_target_id
    from public.quran_student_targets t
    where t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.student_person_id=p_student_person_id and t.work_category=v_work and t.status='active'
    order by t.assigned_on desc,t.id desc limit 1;
  end if;
  if v_target is null then
    select jsonb_build_object('mode',case when a.juz_number is not null then 'juz' when a.start_surah_number is not null then 'ayah' else 'page' end,'juz_number',a.juz_number,'start_surah_number',a.start_surah_number,'start_ayah_number',a.start_ayah_number,'end_surah_number',a.end_surah_number,'end_ayah_number',a.end_ayah_number,'page_start',a.page_start,'page_end',a.page_end)
    into v_target
    from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
    where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and rs.branch_id=p_branch_id and a.work_category=v_work
    order by a.occurred_at desc,a.id desc limit 1;
  end if;
  if v_target is null then raise exception 'set a Quran target before using quick entry'; end if;

  v_mode:=lower(btrim(coalesce(v_target->>'mode','')));
  v_juz:=nullif(v_target->>'juz_number','')::smallint;v_ss:=nullif(v_target->>'start_surah_number','')::smallint;v_sa:=nullif(v_target->>'start_ayah_number','')::integer;v_es:=nullif(v_target->>'end_surah_number','')::smallint;v_ea:=nullif(v_target->>'end_ayah_number','')::integer;v_ps:=nullif(v_target->>'page_start','')::integer;v_pe:=nullif(v_target->>'page_end','')::integer;
  if not ((v_mode='juz' and v_juz between 1 and 30) or (v_mode='ayah' and v_ss between 1 and 114 and v_es between 1 and 114 and v_sa>0 and v_ea>0 and (v_es>v_ss or (v_es=v_ss and v_ea>=v_sa))) or (v_mode='page' and v_ps between 1 and 604 and v_pe between v_ps and 604)) then raise exception 'quick entry target is invalid'; end if;

  v_outcome:=case v_action when 'pass' then 'passed' when 'repeat' then 'repeat' else 'partial' end;
  if p_mistake_count>0 then v_mistakes:=jsonb_build_array(jsonb_build_object('category','quick_count','severity',case when p_mistake_count>=4 then 3 else 2 end,'count',p_mistake_count)); end if;

  v_result:=public.record_quran_hifz_attempt_idempotent(p_identity_id,p_tenant_id,p_branch_id,p_request_key,p_student_person_id,v_work,v_juz,v_ss,v_sa,v_es,v_ea,v_ps,v_pe,null,p_fluency_score,p_tajweed_score,p_quality_score,0,v_outcome,p_teacher_person_id,p_teacher_note,null,null,v_mistakes);
  if coalesce((v_result->>'replayed')::boolean,false) then return v_result||jsonb_build_object('action',v_action,'session_date',p_session_date); end if;
  v_attempt_id:=nullif(v_result->>'attempt_id','')::bigint;v_session_id:=nullif(v_result->>'session_id','')::bigint;v_revision_id:=nullif(v_result->>'revision_obligation_id','')::bigint;
  update public.recitation_sessions set group_id=p_group_id,session_date=p_session_date,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_session_id;
  if v_revision_id is not null then update public.revision_obligations set due_on=coalesce(p_revision_due_on,p_session_date+case when v_action='repeat' then 1 else 3 end),updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_revision_id; end if;
  delete from public.quran_daily_roster_statuses where tenant_id=p_tenant_id and branch_id=p_branch_id and group_id=p_group_id and student_person_id=p_student_person_id and session_date=p_session_date;

  if v_existing_target_id is not null and v_action='pass' then update public.quran_student_targets set status='completed',source_attempt_id=v_attempt_id,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_existing_target_id and status='active'; end if;

  if p_next_target is not null then
    v_next_work:=lower(btrim(coalesce(p_next_target->>'work_category',v_work)));v_next_mode:=lower(btrim(coalesce(p_next_target->>'mode','')));
    v_next_juz:=nullif(p_next_target->>'juz_number','')::smallint;v_next_ss:=nullif(p_next_target->>'start_surah_number','')::smallint;v_next_sa:=nullif(p_next_target->>'start_ayah_number','')::integer;v_next_es:=nullif(p_next_target->>'end_surah_number','')::smallint;v_next_ea:=nullif(p_next_target->>'end_ayah_number','')::integer;v_next_ps:=nullif(p_next_target->>'page_start','')::integer;v_next_pe:=nullif(p_next_target->>'page_end','')::integer;
    if v_next_work not in ('sabaq','sabqi','manzil','nazra','qaida','tajweed') then raise exception 'next target work category is invalid'; end if;
    if not ((v_next_mode='juz' and v_next_juz between 1 and 30) or (v_next_mode='ayah' and v_next_ss between 1 and 114 and v_next_es between 1 and 114 and v_next_sa>0 and v_next_ea>0 and (v_next_es>v_next_ss or (v_next_es=v_next_ss and v_next_ea>=v_next_sa))) or (v_next_mode='page' and v_next_ps between 1 and 604 and v_next_pe between v_next_ps and 604)) then raise exception 'next Quran target is invalid'; end if;
    update public.quran_student_targets set status='superseded',updated_at=clock_timestamp() where tenant_id=p_tenant_id and branch_id=p_branch_id and student_person_id=p_student_person_id and work_category=v_next_work and status='active';
    insert into public.quran_student_targets(tenant_id,branch_id,student_person_id,work_category,target_mode,juz_number,start_surah_number,start_ayah_number,end_surah_number,end_ayah_number,page_start,page_end,assigned_on,due_on,status,source_attempt_id,repeated_from_target_id,teacher_person_id,created_by_membership_id)
    values(p_tenant_id,p_branch_id,p_student_person_id,v_next_work,v_next_mode,v_next_juz,v_next_ss,v_next_sa,v_next_es,v_next_ea,v_next_ps,v_next_pe,p_session_date,case when p_revision_due_on is not null and p_revision_due_on>=p_session_date then p_revision_due_on else null end,'active',v_attempt_id,case when v_action='repeat' then v_existing_target_id else null end,p_teacher_person_id,v_membership_id)
    returning id into v_next_id;
  elsif v_action in ('repeat','needs_support') and v_existing_target_id is null then
    insert into public.quran_student_targets(tenant_id,branch_id,student_person_id,work_category,target_mode,juz_number,start_surah_number,start_ayah_number,end_surah_number,end_ayah_number,page_start,page_end,assigned_on,due_on,status,source_attempt_id,teacher_person_id,created_by_membership_id)
    values(p_tenant_id,p_branch_id,p_student_person_id,v_work,v_mode,v_juz,v_ss,v_sa,v_es,v_ea,v_ps,v_pe,p_session_date,coalesce(p_revision_due_on,p_session_date+case when v_action='repeat' then 1 else 3 end),'active',v_attempt_id,p_teacher_person_id,v_membership_id)
    returning id into v_next_id;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.recitation.daily_quick','succeeded','recitation_attempt',v_attempt_id::text,gen_random_uuid(),jsonb_build_object('student_person_id',p_student_person_id,'group_id',p_group_id,'session_date',p_session_date,'action',v_action,'next_target_id',v_next_id));
  return v_result||jsonb_build_object('action',v_action,'session_date',p_session_date,'next_target_id',v_next_id);
end;
$$;
revoke all on function public.record_quran_hifz_daily_quick_v1(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,bigint,text,jsonb,date) from public,anon,authenticated;
grant execute on function public.record_quran_hifz_daily_quick_v1(uuid,bigint,bigint,text,bigint,date,bigint,text,text,jsonb,numeric,numeric,numeric,integer,bigint,text,jsonb,date) to service_role;

commit;
