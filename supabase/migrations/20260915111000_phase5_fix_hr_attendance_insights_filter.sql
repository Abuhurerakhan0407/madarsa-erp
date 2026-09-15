-- Phase 5 — keep teacher attendance insights executable.
-- PostgreSQL attaches FILTER to the immediately preceding function call. The
-- original expression applied FILTER to round(...), which is a scalar function,
-- and therefore failed at runtime with SQLSTATE 42809. Apply FILTER to avg(...)
-- first, then round the resulting percentage.

create or replace function public.get_hr_attendance_v2_insights_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_attendance_date date
) returns jsonb
language plpgsql stable
set search_path to 'pg_catalog','extensions'
as $function$
declare
  v_membership bigint;
  v_timezone text := 'UTC';
  v_daily numeric := 0;
  v_weekly numeric := 0;
  v_monthly numeric := 0;
  v_trend jsonb;
  v_scans jsonb;
begin
  select m.id
  into v_membership
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.identity_id = p_identity_id
    and m.status = 'active'
    and (
      m.all_branches
      or exists (
        select 1
        from public.membership_branch_scopes s
        where s.tenant_id = m.tenant_id
          and s.membership_id = m.id
          and s.branch_id = p_branch_id
      )
    )
    and exists (
      select 1
      from public.membership_roles mr
      join public.role_permissions rp
        on rp.tenant_id = mr.tenant_id
       and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id
        and mr.membership_id = m.id
        and rp.permission_code = 'hr.employee.read'
    )
  order by m.created_at
  limit 1;

  if v_membership is null then
    raise exception 'staff attendance read permission denied';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC')
  into v_timezone
  from public.institution_profiles
  where tenant_id = p_tenant_id
  limit 1;

  with a as (
    select
      h.attendance_date,
      case
        when h.status in ('present', 'late') then 1.0
        when h.status = 'absent' then 0.0
        else null
      end as ratio
    from public.hr_effective_attendance_v1 h
    join public.hr_employments e
      on e.tenant_id = h.tenant_id
     and e.id = h.employment_id
    where h.tenant_id = p_tenant_id
      and e.branch_id = p_branch_id
      and h.attendance_date between p_attendance_date - 29 and p_attendance_date
  )
  select
    coalesce(
      round((avg(ratio) filter (where attendance_date = p_attendance_date)) * 100, 1),
      0
    ),
    coalesce(
      round((avg(ratio) filter (where attendance_date between p_attendance_date - 6 and p_attendance_date)) * 100, 1),
      0
    ),
    coalesce(round(avg(ratio) * 100, 1), 0)
  into v_daily, v_weekly, v_monthly
  from a;

  select coalesce(
    jsonb_agg(row_to_json(x) order by x.attendance_date),
    '[]'::jsonb
  )
  into v_trend
  from (
    select
      h.attendance_date,
      count(*) filter (
        where h.status not in ('leave', 'holiday', 'weekend', 'unmarked')
      )::int as recorded,
      coalesce(
        round(
          avg(
            case
              when h.status in ('present', 'late') then 1.0
              when h.status = 'absent' then 0.0
              else null
            end
          ) * 100,
          1
        ),
        0
      ) as attendance_percent
    from public.hr_effective_attendance_v1 h
    join public.hr_employments e
      on e.tenant_id = h.tenant_id
     and e.id = h.employment_id
    where h.tenant_id = p_tenant_id
      and e.branch_id = p_branch_id
      and h.attendance_date between p_attendance_date - 29 and p_attendance_date
    group by h.attendance_date
  ) x;

  select coalesce(
    jsonb_agg(row_to_json(x) order by x.employment_id),
    '[]'::jsonb
  )
  into v_scans
  from (
    select
      e.employment_id,
      min(e.occurred_at) as first_scan,
      max(e.occurred_at) as last_scan,
      string_agg(distinct d.label, ', ' order by d.label) as device_label,
      string_agg(distinct e.modality, ', ' order by e.modality) as modality
    from public.attendance_device_events e
    join public.attendance_devices d
      on d.tenant_id = e.tenant_id
     and d.id = e.device_id
    where e.tenant_id = p_tenant_id
      and e.branch_id = p_branch_id
      and e.employment_id is not null
      and (e.occurred_at at time zone v_timezone)::date = p_attendance_date
      and e.state in ('received', 'mapped', 'applied')
    group by e.employment_id
  ) x;

  return jsonb_build_object(
    'daily_percent', v_daily,
    'weekly_percent', v_weekly,
    'monthly_percent', v_monthly,
    'trend', v_trend,
    'scans', v_scans
  );
end;
$function$;

revoke all on function public.get_hr_attendance_v2_insights_v1(uuid,bigint,bigint,date)
  from public, anon, authenticated;
grant execute on function public.get_hr_attendance_v2_insights_v1(uuid,bigint,bigint,date)
  to service_role;
