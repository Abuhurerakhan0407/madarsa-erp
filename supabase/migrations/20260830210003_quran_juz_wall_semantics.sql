create or replace function public.get_quran_juz_wall_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint)
returns jsonb language plpgsql set search_path to '' as $function$
declare v_membership_id bigint;v_wall jsonb;
begin
  select m.id into v_membership_id from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.read')
    order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation read permission denied';end if;
  if not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active') then raise exception 'student is not actively enrolled in this branch';end if;
  select coalesce(jsonb_agg(jsonb_build_object('juz',j,'status',coalesce(x.outcome,'not_started'),'work_category',x.work_category,'score',x.overall_score,'recorded_at',x.occurred_at) order by j),'[]'::jsonb) into v_wall
  from generate_series(1,30) j left join lateral(
    select a.outcome,a.work_category,a.overall_score,a.occurred_at
    from public.recitation_attempts a join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id
    where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id and a.juz_number=j and a.work_category in('sabaq','sabqi','manzil')
    order by a.occurred_at desc,a.id desc limit 1
  )x on true;
  return v_wall;
end;$function$;
revoke execute on function public.get_quran_juz_wall_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_quran_juz_wall_v1(uuid,bigint,bigint,bigint) to service_role;
