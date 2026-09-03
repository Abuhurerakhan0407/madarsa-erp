begin;

create or replace function public.get_portal_attendance_v2_v1(p_identity_id uuid,p_tenant_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $function$
declare v_children jsonb;
begin
  if not exists(
    select 1 from public.identity_person_links l
    where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified'
  ) then
    raise exception 'verified guardian portal link required';
  end if;

  with children as (
    select distinct sp.person_id,sp.student_number,p.display_name
    from public.identity_person_links l
    join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
    join public.student_profiles sp on sp.tenant_id=pr.tenant_id and sp.person_id=pr.target_person_id and sp.status in('active','admitted')
    join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
    where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'person_id',c.person_id,
    'student_number',c.student_number,
    'display_name',c.display_name,
    'daily_percent',coalesce((select round(avg(ar.presence_ratio)*100,1) from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and ar.person_id=c.person_id and s.attendance_date=current_date),0),
    'weekly_percent',coalesce((select round(avg(ar.presence_ratio)*100,1) from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and ar.person_id=c.person_id and s.attendance_date between current_date-6 and current_date),0),
    'monthly_percent',coalesce((select round(avg(ar.presence_ratio)*100,1) from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and ar.person_id=c.person_id and s.attendance_date between current_date-29 and current_date),0),
    'trend',coalesce((select jsonb_agg(jsonb_build_object('date',x.attendance_date,'attendance_percent',x.attendance_percent,'recorded',x.recorded) order by x.attendance_date) from (select s.attendance_date,round(avg(ar.presence_ratio)*100,1) attendance_percent,count(*)::int recorded from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and ar.person_id=c.person_id and s.attendance_date between current_date-29 and current_date group by s.attendance_date)x),'[]'::jsonb),
    'recent',coalesce((select jsonb_agg(row_to_json(r) order by r.attendance_date desc) from (select s.attendance_date,ar.status_category,ar.source,ar.source_ref,ar.marked_at from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and ar.person_id=c.person_id order by s.attendance_date desc,ar.id desc limit 10)r),'[]'::jsonb)
  ) order by c.display_name),'[]'::jsonb)
  into v_children
  from children c;

  return jsonb_build_object('tenant_id',p_tenant_id,'children',v_children);
end;
$function$;

revoke all on function public.get_portal_attendance_v2_v1(uuid,bigint) from public,anon,authenticated;
grant execute on function public.get_portal_attendance_v2_v1(uuid,bigint) to service_role;

commit;
