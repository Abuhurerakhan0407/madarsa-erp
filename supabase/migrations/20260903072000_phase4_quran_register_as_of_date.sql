begin;

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
      where o.tenant_id=p_tenant_id and o.student_person_id=r.student_person_id and o.state in ('due','assigned','attempted') and o.due_on<=v_date
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

revoke all on function public.get_quran_hifz_daily_register_v1(uuid,bigint,bigint,bigint,date) from public,anon,authenticated;
grant execute on function public.get_quran_hifz_daily_register_v1(uuid,bigint,bigint,bigint,date) to service_role;

commit;
