create or replace function public.get_operational_document_center_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 40
) returns jsonb
language plpgsql
stable
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_search text:=nullif(btrim(coalesce(p_search,'')),'');
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_page_size integer:=least(greatest(coalesce(p_page_size,40),1),100);
  v_total integer:=0;
  v_rows jsonb:='[]'::jsonb;
  v_recent jsonb:='[]'::jsonb;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='documents.file.read'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'document read permission denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required'; end if;

  with active_students as(
    select distinct on(e.student_person_id) e.student_person_id,e.id enrollment_id,e.group_id,sp.student_number,p.display_name,p.name_native
    from public.enrollments e
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted')
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
    order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  ) select count(*)::integer into v_total
  from active_students s
  where v_search is null or s.display_name ilike '%'||v_search||'%' or s.student_number ilike '%'||v_search||'%';

  with active_students as(
    select distinct on(e.student_person_id) e.student_person_id,e.id enrollment_id,e.group_id,sp.student_number,p.display_name,p.name_native
    from public.enrollments e
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted')
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
    order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  ), page_students as(
    select s.* from active_students s
    where v_search is null or s.display_name ilike '%'||v_search||'%' or s.student_number ilike '%'||v_search||'%'
    order by s.display_name,s.student_person_id
    limit v_page_size offset((v_page-1)*v_page_size)
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.person_id),'[]'::jsonb) into v_rows
  from(
    select s.student_person_id person_id,s.student_number,s.display_name name,s.name_native,
      coalesce(g.labels->>'en',g.key) class_group,
      true id_card_available,
      true profile_available,
      exists(
        select 1 from public.quran_effective_recitation_attempts_v1 a
        join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=s.student_person_id and rs.branch_id=p_branch_id
      ) quran_progress_available,
      exists(
        select 1 from public.report_card_issues rci
        join public.result_snapshots snap on snap.tenant_id=rci.tenant_id and snap.id=rci.result_snapshot_id
        join public.enrollments e2 on e2.tenant_id=snap.tenant_id and e2.id=snap.enrollment_id
        where rci.tenant_id=p_tenant_id and snap.student_person_id=s.student_person_id and e2.branch_id=p_branch_id
      ) report_card_issued,
      (select max(rci.issued_at) from public.report_card_issues rci join public.result_snapshots snap on snap.tenant_id=rci.tenant_id and snap.id=rci.result_snapshot_id join public.enrollments e2 on e2.tenant_id=snap.tenant_id and e2.id=snap.enrollment_id where rci.tenant_id=p_tenant_id and snap.student_person_id=s.student_person_id and e2.branch_id=p_branch_id) report_card_issued_at
    from page_students s
    left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=s.group_id
  ) x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.issued_at desc),'[]'::jsonb) into v_recent
  from(
    select rci.id issue_id,'report_card'::text document_type,snap.student_person_id person_id,p.display_name student_name,rci.template_key,rci.revision,rci.issued_at
    from public.report_card_issues rci
    join public.result_snapshots snap on snap.tenant_id=rci.tenant_id and snap.id=rci.result_snapshot_id
    join public.enrollments e on e.tenant_id=snap.tenant_id and e.id=snap.enrollment_id and e.branch_id=p_branch_id
    join public.persons p on p.tenant_id=snap.tenant_id and p.id=snap.student_person_id
    where rci.tenant_id=p_tenant_id
    order by rci.issued_at desc,rci.id desc limit 20
  ) x;

  return jsonb_build_object('total',v_total,'page',v_page,'page_size',v_page_size,'rows',v_rows,'recent_issued',v_recent);
end;
$fn$;

revoke all on function public.get_operational_document_center_v1(uuid,bigint,bigint,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_operational_document_center_v1(uuid,bigint,bigint,text,integer,integer) to service_role;