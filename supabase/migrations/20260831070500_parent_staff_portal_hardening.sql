create or replace function public.get_portal_home_v1(
  p_identity_id uuid,p_tenant_id bigint
) returns jsonb
language plpgsql stable set search_path to pg_catalog,extensions
as $fn$
declare v_links jsonb;v_children jsonb;v_employee jsonb;v_notices jsonb;v_has_guardian boolean;v_has_employee boolean;begin
  if not exists(select 1 from public.identity_person_links l where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.status='verified') then raise exception 'verified portal link required';end if;
  select exists(select 1 from public.identity_person_links l where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified') into v_has_guardian;
  select exists(select 1 from public.identity_person_links l where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='employee' and l.status='verified') into v_has_employee;

  select coalesce(jsonb_agg(row_to_json(x) order by x.link_type,x.display_name),'[]'::jsonb) into v_links from(
    select l.person_id,l.link_type,p.display_name,p.name_native,p.preferred_locale
    from public.identity_person_links l join public.persons p on p.tenant_id=l.tenant_id and p.id=l.person_id
    where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.status='verified'
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.display_name),'[]'::jsonb) into v_children from(
    select sp.person_id,sp.student_number,p.display_name,p.name_native,e.branch_id,e.session_id,e.group_id,e.status enrollment_status,
      (select count(*)::int from public.attendance_records ar join public.attendance_sessions ats on ats.tenant_id=ar.tenant_id and ats.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and ar.person_id=sp.person_id and ats.attendance_date>=current_date-30) attendance_total_30d,
      (select count(*)::int from public.attendance_records ar join public.attendance_sessions ats on ats.tenant_id=ar.tenant_id and ats.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and ar.person_id=sp.person_id and ats.attendance_date>=current_date-30 and ar.status_category='present') attendance_present_30d,
      (select row_to_json(q) from(select ra.occurred_at,ra.work_category,ra.overall_score,ra.outcome,ra.parent_visible_remark from public.recitation_attempts ra where ra.tenant_id=p_tenant_id and ra.student_person_id=sp.person_id order by ra.occurred_at desc,ra.id desc limit 1)q) latest_quran
    from public.identity_person_links l
    join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
    join public.student_profiles sp on sp.tenant_id=pr.tenant_id and sp.person_id=pr.target_person_id and sp.status in('active','admitted')
    join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
    join lateral(select ee.* from public.enrollments ee where ee.tenant_id=sp.tenant_id and ee.student_person_id=sp.person_id and ee.status in('active','paused') order by ee.starts_on desc,ee.id desc limit 1)e on true
    where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified'
  )x;

  select row_to_json(x) into v_employee from(
    select ep.person_id,ep.employee_number,p.display_name,ep.designation,ep.department_key,ep.employment_type,ep.joined_on,ep.status,
      (select coalesce(jsonb_agg(row_to_json(a) order by a.attendance_date desc),'[]'::jsonb) from(select har.attendance_date,har.status,har.check_in_at,har.check_out_at from public.hr_employments he join public.hr_attendance_records har on har.tenant_id=he.tenant_id and har.employment_id=he.id where he.tenant_id=p_tenant_id and he.employee_person_id=ep.person_id order by har.attendance_date desc limit 14)a) recent_attendance,
      (select coalesce(jsonb_agg(row_to_json(lr) order by lr.created_at desc),'[]'::jsonb) from(select r.starts_on,r.ends_on,r.requested_units,r.reason,r.state,r.created_at from public.hr_employments he join public.hr_leave_requests r on r.tenant_id=he.tenant_id and r.employment_id=he.id where he.tenant_id=p_tenant_id and he.employee_person_id=ep.person_id order by r.created_at desc limit 10)lr) recent_leave
    from public.identity_person_links l join public.employee_profiles ep on ep.tenant_id=l.tenant_id and ep.person_id=l.person_id join public.persons p on p.tenant_id=ep.tenant_id and p.id=ep.person_id
    where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='employee' and l.status='verified' and ep.status='active' order by l.created_at limit 1
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.published_at desc,x.id desc),'[]'::jsonb) into v_notices from(
    select n.id,n.audience_type,n.labels,n.body,n.published_at,n.expires_at,(r.notice_id is not null) is_read,r.read_at
    from public.portal_notices n
    left join public.portal_notice_receipts r on r.tenant_id=n.tenant_id and r.notice_id=n.id and r.identity_id=p_identity_id
    where n.tenant_id=p_tenant_id and n.state='published' and n.published_at<=now() and (n.expires_at is null or n.expires_at>now())
      and (n.audience_type='tenant' or (v_has_guardian and n.audience_type='parents') or (v_has_employee and n.audience_type='employees'))
      and (
        n.branch_id is null
        or exists(
          select 1 from public.identity_person_links l
          join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
          join public.enrollments e on e.tenant_id=pr.tenant_id and e.student_person_id=pr.target_person_id and e.status in('active','paused')
          where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified' and e.branch_id=n.branch_id
        )
        or exists(
          select 1 from public.identity_person_links l join public.hr_employments he on he.tenant_id=l.tenant_id and he.employee_person_id=l.person_id and he.state in('active','on_leave')
          where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='employee' and l.status='verified' and he.branch_id=n.branch_id
        )
      )
    order by n.published_at desc,n.id desc limit 30
  )x;

  return jsonb_build_object('tenant_id',p_tenant_id,'links',v_links,'children',v_children,'employee',v_employee,'notices',v_notices);
end;$fn$;

create or replace function public.mark_portal_notice_read_v1(
  p_identity_id uuid,p_tenant_id bigint,p_notice_id bigint
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_has_guardian boolean;v_has_employee boolean;begin
  if not exists(select 1 from public.identity_person_links l where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.status='verified') then raise exception 'verified portal link required';end if;
  select exists(select 1 from public.identity_person_links l where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified') into v_has_guardian;
  select exists(select 1 from public.identity_person_links l where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='employee' and l.status='verified') into v_has_employee;
  if not exists(
    select 1 from public.portal_notices n
    where n.tenant_id=p_tenant_id and n.id=p_notice_id and n.state='published' and n.published_at<=now() and (n.expires_at is null or n.expires_at>now())
      and (n.audience_type='tenant' or (v_has_guardian and n.audience_type='parents') or (v_has_employee and n.audience_type='employees'))
      and (
        n.branch_id is null
        or exists(select 1 from public.identity_person_links l join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard') join public.enrollments e on e.tenant_id=pr.tenant_id and e.student_person_id=pr.target_person_id and e.status in('active','paused') where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified' and e.branch_id=n.branch_id)
        or exists(select 1 from public.identity_person_links l join public.hr_employments he on he.tenant_id=l.tenant_id and he.employee_person_id=l.person_id and he.state in('active','on_leave') where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='employee' and l.status='verified' and he.branch_id=n.branch_id)
      )
  ) then raise exception 'portal notice is unavailable';end if;
  insert into public.portal_notice_receipts(tenant_id,notice_id,identity_id,read_at) values(p_tenant_id,p_notice_id,p_identity_id,now()) on conflict(tenant_id,notice_id,identity_id) do update set read_at=excluded.read_at;
  return jsonb_build_object('notice_id',p_notice_id,'read',true);
end;$fn$;

revoke all on function public.get_portal_home_v1(uuid,bigint) from public,anon,authenticated;
revoke all on function public.mark_portal_notice_read_v1(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_portal_home_v1(uuid,bigint) to service_role;
grant execute on function public.mark_portal_notice_read_v1(uuid,bigint,bigint) to service_role;
