create or replace function public.get_operational_dashboard_aggregate_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_local_date date default null
) returns jsonb
language plpgsql
stable
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_local_date date;
  v_timezone text := 'UTC';
  v_admissions jsonb := '{}'::jsonb;
  v_attendance_trend jsonb := '[]'::jsonb;
  v_admissions_trend jsonb := '[]'::jsonb;
  v_quran_trend jsonb := '[]'::jsonb;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id
    ))
    and exists(
      select 1
      from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='report.run.execute'
    )
  order by m.created_at limit 1;

  if v_membership is null then raise exception 'dashboard analytics permission denied'; end if;
  if not exists(
    select 1 from public.branches b
    where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active'
  ) then raise exception 'active branch required'; end if;

  v_local_date := coalesce(p_local_date, public.institution_local_date(p_tenant_id));
  select coalesce(nullif(ip.timezone,''),'UTC') into v_timezone
  from public.institution_profiles ip
  where ip.tenant_id=p_tenant_id;
  v_timezone := coalesce(v_timezone,'UTC');

  select jsonb_build_object(
    'total',count(*),
    'open',count(*) filter(where a.state not in ('converted','rejected','withdrawn','expired')),
    'accepted',count(*) filter(where a.state='accepted'),
    'converted',count(*) filter(where a.state='converted')
  ) into v_admissions
  from public.applications a
  where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id;

  with days as (
    select generate_series(v_local_date-6,v_local_date,interval '1 day')::date as day
  ), latest_sessions as (
    select distinct on(s.attendance_date) s.attendance_date,s.id
    from public.attendance_sessions s
    where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id
      and s.context_type='student_daily' and s.context_key='branch_daily' and s.slot_id is null
      and s.attendance_date between v_local_date-6 and v_local_date
    order by s.attendance_date,s.id desc
  ), effective as (
    select ls.attendance_date,
      coalesce(ac.requested_presence_ratio,ar.presence_ratio) as presence_ratio
    from latest_sessions ls
    join public.attendance_records ar
      on ar.tenant_id=p_tenant_id and ar.attendance_session_id=ls.id
    left join lateral (
      select c.requested_presence_ratio
      from public.attendance_corrections c
      where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved'
      order by c.reviewed_at desc,c.id desc limit 1
    ) ac on true
  ), daily as (
    select e.attendance_date,round(avg(e.presence_ratio)*100,1) as value
    from effective e
    where e.presence_ratio is not null
    group by e.attendance_date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d.day::text,'value',coalesce(x.value,0)
  ) order by d.day),'[]'::jsonb)
  into v_attendance_trend
  from days d left join daily x on x.attendance_date=d.day;

  with days as (
    select generate_series(v_local_date-6,v_local_date,interval '1 day')::date as day
  ), daily as (
    select (a.submitted_at at time zone v_timezone)::date as day,count(*) as value
    from public.applications a
    where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.submitted_at is not null
      and (a.submitted_at at time zone v_timezone)::date between v_local_date-6 and v_local_date
    group by (a.submitted_at at time zone v_timezone)::date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d.day::text,'value',coalesce(x.value,0)
  ) order by d.day),'[]'::jsonb)
  into v_admissions_trend
  from days d left join daily x on x.day=d.day;

  with days as (
    select generate_series(v_local_date-6,v_local_date,interval '1 day')::date as day
  ), daily as (
    select rs.session_date as day,count(ra.id) as value,
      round(avg(ra.overall_score) filter(where ra.overall_score is not null),1) as average_score
    from public.recitation_sessions rs
    left join public.recitation_attempts ra
      on ra.tenant_id=rs.tenant_id and ra.recitation_session_id=rs.id
    where rs.tenant_id=p_tenant_id and rs.branch_id=p_branch_id
      and rs.session_date between v_local_date-6 and v_local_date
    group by rs.session_date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d.day::text,'value',coalesce(x.value,0),'secondary',x.average_score
  ) order by d.day),'[]'::jsonb)
  into v_quran_trend
  from days d left join daily x on x.day=d.day;

  return jsonb_build_object(
    'local_date',v_local_date,
    'admissions',coalesce(v_admissions,'{}'::jsonb),
    'trends',jsonb_build_object(
      'attendance',v_attendance_trend,
      'admissions',v_admissions_trend,
      'quran',v_quran_trend
    )
  );
end;
$fn$;

revoke all on function public.get_operational_dashboard_aggregate_v1(uuid,bigint,bigint,date) from public,anon,authenticated;
grant execute on function public.get_operational_dashboard_aggregate_v1(uuid,bigint,bigint,date) to service_role;
