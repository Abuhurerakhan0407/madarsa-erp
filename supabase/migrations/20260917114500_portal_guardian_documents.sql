create or replace function public.get_portal_guardian_documents_v1(
  p_identity_id uuid,
  p_tenant_id bigint
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_children jsonb := '[]'::jsonb;
begin
  if p_identity_id is null or p_tenant_id is null then
    raise exception 'identity and tenant are required';
  end if;

  if not exists (
    select 1
    from public.identity_person_links l
    where l.tenant_id = p_tenant_id
      and l.identity_id = p_identity_id
      and l.link_type = 'guardian'
      and l.status = 'verified'
  ) then
    return jsonb_build_object('children', '[]'::jsonb);
  end if;

  with linked as (
    select distinct on (sp.person_id)
      sp.person_id,
      sp.student_number,
      sp.status,
      child.display_name,
      child.name_native,
      child.date_of_birth,      child.photo_storage_path,
      guardian.display_name as guardian_name,
      e.branch_id,
      b.name as branch_name,
      e.session_id,
      s.labels as session_labels,
      e.program_id,
      prg.labels as program_labels,
      e.group_id,
      g.labels as group_labels,
      (
        select jsonb_build_object(
          'issue_id', idr.id,
          'document_id', idr.document_id,
          'revision', idr.revision,
          'verification_code', idr.verification_code,
          'issued_at', idr.issued_at,
          'state', idr.state,
          'snapshot', coalesce(d.metadata->'content_snapshot', '{}'::jsonb)
        )
        from public.issued_document_records idr
        join public.documents d
          on d.tenant_id = idr.tenant_id
         and d.id = idr.document_id
        where idr.tenant_id = p_tenant_id
          and idr.subject_type = 'student_status_certificate'
          and idr.subject_id = sp.person_id::text
          and idr.state = 'active'
          and d.status = 'active'
        order by idr.revision desc, idr.id desc
        limit 1
      ) as status_certificate
    from public.identity_person_links l    join public.persons guardian
      on guardian.tenant_id = l.tenant_id
     and guardian.id = l.person_id
    join public.person_relationships rel
      on rel.tenant_id = l.tenant_id
     and rel.source_person_id = l.person_id
     and rel.status = 'verified'
     and rel.portal_visibility in ('limited','standard')
    join public.student_profiles sp
      on sp.tenant_id = rel.tenant_id
     and sp.person_id = rel.target_person_id
     and sp.status in ('active','admitted')
    join public.persons child
      on child.tenant_id = sp.tenant_id
     and child.id = sp.person_id
    join lateral (
      select ee.*
      from public.enrollments ee
      where ee.tenant_id = sp.tenant_id
        and ee.student_person_id = sp.person_id
        and ee.status in ('active','paused')
      order by ee.starts_on desc, ee.id desc
      limit 1
    ) e on true
    join public.branches b
      on b.tenant_id = e.tenant_id
     and b.id = e.branch_id
     and b.status = 'active'
    left join public.academic_sessions s
      on s.tenant_id = e.tenant_id
     and s.id = e.session_id
    left join public.programs prg
      on prg.tenant_id = e.tenant_id
     and prg.id = e.program_id    left join public.academic_groups g
      on g.tenant_id = e.tenant_id
     and g.id = e.group_id
    where l.tenant_id = p_tenant_id
      and l.identity_id = p_identity_id
      and l.link_type = 'guardian'
      and l.status = 'verified'
    order by sp.person_id, e.starts_on desc, e.id desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'person_id', person_id,
    'student_number', student_number,
    'status', status,
    'display_name', display_name,
    'name_native', name_native,
    'date_of_birth', date_of_birth,
    'photo_storage_path', photo_storage_path,
    'guardian_name', guardian_name,
    'branch_id', branch_id,
    'branch_name', branch_name,
    'session_id', session_id,
    'session_labels', session_labels,
    'program_id', program_id,
    'program_labels', program_labels,
    'group_id', group_id,
    'group_labels', group_labels,
    'status_certificate', status_certificate
  ) order by display_name, person_id), '[]'::jsonb)
  into v_children
  from linked;

  return jsonb_build_object('children', v_children);
end;
$function$;
revoke all on function public.get_portal_guardian_documents_v1(uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.get_portal_guardian_documents_v1(uuid,bigint)
  to service_role;
