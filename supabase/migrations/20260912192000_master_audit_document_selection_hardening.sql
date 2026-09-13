begin;

-- Master-audit remediation: selected document printing must not page through the
-- entire filtered student population. This RPC resolves at most 250 explicitly
-- requested students inside the active tenant/branch and applies the same
-- document availability facts used by the document center.
create or replace function public.get_operational_document_students_by_ids_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_ids bigint[],
  p_session_id bigint default null,
  p_program_id bigint default null,
  p_group_id bigint default null,
  p_search text default null
) returns jsonb
language plpgsql
stable
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_search text:=nullif(btrim(coalesce(p_search,'')),'');
  v_rows jsonb:='[]'::jsonb;
begin
  if p_student_person_ids is null or cardinality(p_student_person_ids) < 1 or cardinality(p_student_person_ids) > 250 then
    raise exception 'select between 1 and 250 students';
  end if;
  if exists(select 1 from unnest(p_student_person_ids) as selected(id) where id is null or id<=0) then
    raise exception 'selected student identifiers must be positive';
  end if;

  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id
    ))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='documents.file.read'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'document read permission denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then
    raise exception 'active branch required';
  end if;

  with requested as(
    select selected.id person_id,min(selected.ordinality)::integer request_order
    from unnest(p_student_person_ids) with ordinality as selected(id,ordinality)
    group by selected.id
  ), active_students as(
    select distinct on(e.student_person_id)
      r.request_order,e.student_person_id,e.session_id,e.program_id,e.group_id,
      sp.student_number,sp.admission_number,sp.status,p.display_name,p.name_native,p.photo_storage_path
    from requested r
    join public.enrollments e on e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and e.student_person_id=r.person_id and e.status='active'
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
      and sp.status in('active','admitted')
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  ), filtered as(
    select s.* from active_students s
    where (p_session_id is null or s.session_id=p_session_id)
      and (p_program_id is null or s.program_id=p_program_id)
      and (p_group_id is null or s.group_id=p_group_id)
      and (v_search is null or s.display_name ilike '%'||v_search||'%' or s.student_number ilike '%'||v_search||'%' or coalesce(s.admission_number,'') ilike '%'||v_search||'%')
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.request_order),'[]'::jsonb) into v_rows
  from(
    select s.request_order,s.student_person_id person_id,s.student_number,s.admission_number,s.display_name name,s.name_native,
      s.session_id,s.program_id,s.group_id,
      coalesce(ag.labels->>'en',ag.key) academic_year,
      coalesce(pr.labels->>'en',pr.key) program,
      coalesce(g.labels->>'en',g.key) class_group,
      (s.photo_storage_path is not null) photo_available,
      true id_card_available,true profile_available,
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
      (select max(rci.issued_at)
       from public.report_card_issues rci
       join public.result_snapshots snap on snap.tenant_id=rci.tenant_id and snap.id=rci.result_snapshot_id
       join public.enrollments e2 on e2.tenant_id=snap.tenant_id and e2.id=snap.enrollment_id
       where rci.tenant_id=p_tenant_id and snap.student_person_id=s.student_person_id and e2.branch_id=p_branch_id) report_card_issued_at
    from filtered s
    left join public.academic_sessions ag on ag.tenant_id=p_tenant_id and ag.id=s.session_id
    left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=s.program_id
    left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=s.group_id
  ) x;

  return jsonb_build_object('rows',v_rows,'selection_limit',250);
end;
$fn$;

revoke all on function public.get_operational_document_students_by_ids_v1(uuid,bigint,bigint,bigint[],bigint,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.get_operational_document_students_by_ids_v1(uuid,bigint,bigint,bigint[],bigint,bigint,bigint,text) to service_role;

commit;
