create or replace function public.institution_local_date(p_tenant_id bigint)
returns date
language sql
stable
set search_path to ''
as $function$
  select (clock_timestamp() at time zone coalesce(
    (select nullif(btrim(ip.timezone),'') from public.institution_profiles ip where ip.tenant_id=p_tenant_id limit 1),
    'UTC'
  ))::date;
$function$;

create or replace function public.record_quran_hifz_attempt_idempotent(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_request_key text,
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
  v_key text := nullif(btrim(coalesce(p_request_key,'')),'');
  v_stable_key text;
  v_existing_session_id bigint;
  v_existing_attempt_id bigint;
  v_result jsonb;
  v_session_id bigint;
  v_revision_id bigint;
  v_local_date date;
  v_outcome text := lower(btrim(coalesce(p_outcome,'')));
begin
  if v_key is null or length(v_key)<16 or length(v_key)>96 then
    raise exception 'request key must be between 16 and 96 characters';
  end if;
  v_stable_key := 'quran-client:' || v_key;
  v_local_date := public.institution_local_date(p_tenant_id);

  perform pg_advisory_xact_lock(hashtextextended(format('quran-attempt:%s:%s:%s',p_tenant_id,p_branch_id,v_stable_key),0));

  select rs.id into v_existing_session_id
  from public.recitation_sessions rs
  where rs.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.idempotency_key=v_stable_key
  limit 1;

  if v_existing_session_id is not null then
    select a.id into v_existing_attempt_id
    from public.recitation_attempts a
    where a.tenant_id=p_tenant_id and a.recitation_session_id=v_existing_session_id
    order by a.id asc limit 1;
    return jsonb_build_object('attempt_id',v_existing_attempt_id,'session_id',v_existing_session_id,'replayed',true);
  end if;

  v_result := public.record_quran_hifz_attempt(
    p_identity_id,p_tenant_id,p_branch_id,p_student_person_id,p_work_category,
    p_juz_number,p_start_surah_number,p_start_ayah_number,p_end_surah_number,p_end_ayah_number,p_page_start,p_page_end,
    p_accuracy_score,p_fluency_score,p_tajweed_score,p_overall_score,p_prompts,p_outcome,p_teacher_person_id,
    p_teacher_remark,p_parent_visible_remark,p_private_note,p_mistakes
  );

  v_session_id := nullif(v_result->>'session_id','')::bigint;
  v_revision_id := nullif(v_result->>'revision_obligation_id','')::bigint;

  update public.recitation_sessions
  set idempotency_key=v_stable_key,session_date=v_local_date,updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=v_session_id;

  if v_revision_id is not null then
    update public.revision_obligations
    set due_on=v_local_date + case when v_outcome='repeat' then 1 else 3 end,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=v_revision_id;
  end if;

  return v_result || jsonb_build_object('replayed',false,'local_date',v_local_date);
end;
$function$;

create or replace function public.get_quran_hifz_workspace_v2(
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
  v_local_date date := public.institution_local_date(p_tenant_id);
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
      la.juz_number last_juz_number,
      coalesce(rv.due_count,0) revision_due,
      coalesce(mj.passed_juz,0) memorized_juz,
      sb.sabaq_label,sq.sabqi_label,mn.manzil_label
    from page_students s
    left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=s.group_id
    left join lateral (
      select a.* from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
      where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id
      order by a.occurred_at desc,a.id desc limit 1
    ) la on true
    left join lateral (
      select count(*)::integer due_count from public.revision_obligations r
      where r.tenant_id=p_tenant_id and r.student_person_id=s.student_person_id and r.state in ('due','assigned','attempted') and r.due_on<=v_local_date
    ) rv on true
    left join lateral (
      select count(distinct a.juz_number)::integer passed_juz from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
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
    'students',(select count(distinct e.student_person_id) from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in ('active','admitted') where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'),
    'recorded_today',(select count(distinct a.student_person_id) from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date),
    'attempts_today',(select count(*) from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date),
    'revision_due',(select count(*) from public.revision_obligations r where r.tenant_id=p_tenant_id and r.state in ('due','assigned','attempted') and r.due_on<=v_local_date and exists(select 1 from public.enrollments e where e.tenant_id=r.tenant_id and e.student_person_id=r.student_person_id and e.branch_id=p_branch_id and e.status='active')),
    'average_today',(select round(avg(a.overall_score),1) from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and a.overall_score is not null),
    'repeat_today',(select count(*) from public.recitation_attempts a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id where a.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.session_date=v_local_date and a.outcome='repeat')
  ) into v_summary;

  return jsonb_build_object('local_date',v_local_date,'summary',v_summary,'total',v_total,'page',v_page,'page_size',v_page_size,'rows',v_rows,'can_record',v_can_record);
end;
$function$;

revoke execute on function public.institution_local_date(bigint) from public,anon,authenticated;
grant execute on function public.institution_local_date(bigint) to service_role;
revoke execute on function public.record_quran_hifz_attempt_idempotent(uuid,bigint,bigint,text,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,bigint,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_quran_hifz_attempt_idempotent(uuid,bigint,bigint,text,bigint,text,smallint,smallint,integer,smallint,integer,integer,integer,numeric,numeric,numeric,numeric,integer,text,bigint,text,text,text,jsonb) to service_role;
revoke execute on function public.get_quran_hifz_workspace_v2(uuid,bigint,bigint,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_quran_hifz_workspace_v2(uuid,bigint,bigint,text,integer,integer) to service_role;
