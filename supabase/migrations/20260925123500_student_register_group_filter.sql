-- Client handover: add an efficient class/group scoped student register without
-- changing the existing register RPC used by other product surfaces.

create or replace function public.get_student_register_page_v2(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_group_id bigint default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := least(greatest(coalesce(p_page_size,25),1),100);
  v_total bigint;
  v_active bigint;
  v_rows jsonb;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then
    raise exception 'identity, tenant, and branch are required';
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id
    and m.identity_id=p_identity_id
    and m.status='active'
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
    and (
      m.all_branches
      or exists(
        select 1
        from public.membership_branch_scopes mbs
        where mbs.tenant_id=m.tenant_id
          and mbs.membership_id=m.id
          and mbs.branch_id=p_branch_id
      )
    )
    and exists(
      select 1
      from public.membership_roles mr
      join public.role_permissions rp
        on rp.tenant_id=mr.tenant_id
       and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id
        and mr.membership_id=m.id
        and rp.permission_code='students.profile.read'
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'student register permission denied';
  end if;

  if not exists(
    select 1
    from public.branches b
    where b.tenant_id=p_tenant_id
      and b.id=p_branch_id
      and b.status='active'
  ) then
    raise exception 'active branch is required';
  end if;

  if p_group_id is not null and not exists(
    select 1
    from public.academic_groups ag
    where ag.tenant_id=p_tenant_id
      and ag.branch_id=p_branch_id
      and ag.id=p_group_id
      and ag.status='active'
  ) then
    raise exception 'class/group is invalid';
  end if;

  with candidates as (
    select
      sp.person_id,
      sp.student_number,
      sp.admission_number,
      sp.status,
      sp.joined_on,
      sp.created_at,
      p.display_name,
      p.name_native
    from public.student_profiles sp
    join public.persons p
      on p.tenant_id=sp.tenant_id
     and p.id=sp.person_id
    where sp.tenant_id=p_tenant_id
      and exists(
        select 1
        from public.enrollments e
        where e.tenant_id=p_tenant_id
          and e.student_person_id=sp.person_id
          and e.branch_id=p_branch_id
          and e.status<>'cancelled'
          and (p_group_id is null or e.group_id=p_group_id)
      )
  )
  select
    count(*),
    count(*) filter(where status='active')
  into v_total,v_active
  from candidates;

  with candidates as (
    select
      sp.person_id,
      sp.student_number,
      sp.admission_number,
      sp.status,
      sp.joined_on,
      sp.created_at,
      p.display_name,
      p.name_native
    from public.student_profiles sp
    join public.persons p
      on p.tenant_id=sp.tenant_id
     and p.id=sp.person_id
    where sp.tenant_id=p_tenant_id
      and exists(
        select 1
        from public.enrollments e
        where e.tenant_id=p_tenant_id
          and e.student_person_id=sp.person_id
          and e.branch_id=p_branch_id
          and e.status<>'cancelled'
          and (p_group_id is null or e.group_id=p_group_id)
      )
    order by sp.created_at desc,sp.person_id desc
    limit v_page_size
    offset ((v_page-1)*v_page_size)
  ),
  enriched as (
    select
      c.*,
      e.program_id,
      e.group_id,
      pr.labels as program_labels,
      pr.key as program_key,
      ag.labels as group_labels,
      ag.key as group_key
    from candidates c
    left join lateral (
      select e.program_id,e.group_id
      from public.enrollments e
      where e.tenant_id=p_tenant_id
        and e.branch_id=p_branch_id
        and e.student_person_id=c.person_id
        and e.status<>'cancelled'
        and (p_group_id is null or e.group_id=p_group_id)
      order by (e.status='active') desc,e.created_at desc,e.id desc
      limit 1
    ) e on true
    left join public.programs pr
      on pr.tenant_id=p_tenant_id
     and pr.id=e.program_id
    left join public.academic_groups ag
      on ag.tenant_id=p_tenant_id
     and ag.id=e.group_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'person_id',person_id,
        'student_number',student_number,
        'admission_number',admission_number,
        'name',display_name,
        'native_name',name_native,
        'status',status,
        'joined_on',joined_on,
        'program_key',program_key,
        'program_labels',program_labels,
        'group_key',group_key,
        'group_labels',group_labels
      )
      order by created_at desc,person_id desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from enriched;

  return jsonb_build_object(
    'rows',v_rows,
    'total',v_total,
    'active',v_active,
    'page',v_page,
    'page_size',v_page_size,
    'pages',greatest(ceil(v_total::numeric/v_page_size)::integer,1)
  );
end;
$function$;

revoke all on function public.get_student_register_page_v2(uuid,bigint,bigint,bigint,integer,integer)
  from public,anon,authenticated;
grant execute on function public.get_student_register_page_v2(uuid,bigint,bigint,bigint,integer,integer)
  to service_role;
