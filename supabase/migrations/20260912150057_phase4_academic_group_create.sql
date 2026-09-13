begin;

create or replace function public.create_academic_group_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_session_id bigint,
  p_program_id bigint,
  p_key text,
  p_labels jsonb,
  p_capacity integer default null,
  p_level_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_group_id bigint;
  v_key text := lower(btrim(coalesce(p_key, '')));
  v_title text := btrim(coalesce(p_labels->>'en', ''));
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null
     or p_session_id is null or p_program_id is null then
    raise exception 'identity, tenant, branch, session, and program are required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'academic-group:' || p_tenant_id::text || ':' || p_branch_id::text || ':' || p_session_id::text || ':' || v_key,
      0
    )
  );

  v_membership_id := private.resolve_staff_membership(
    p_identity_id,
    p_tenant_id,
    p_branch_id,
    array['academics.structure.manage']
  );
  if v_membership_id is null then
    raise exception 'academic structure permission denied';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.tenant_id = p_tenant_id and b.id = p_branch_id and b.status = 'active'
  ) then
    raise exception 'active tenant branch required';
  end if;

  if v_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise exception 'academic group key is invalid';
  end if;

  if jsonb_typeof(p_labels) <> 'object' or length(v_title) not between 1 and 120 then
    raise exception 'academic group labels are invalid';
  end if;

  if (p_labels ? 'ur' and length(btrim(coalesce(p_labels->>'ur', ''))) not between 1 and 120)
     or (p_labels ? 'ar' and length(btrim(coalesce(p_labels->>'ar', ''))) not between 1 and 120) then
    raise exception 'academic group labels are invalid';
  end if;

  if p_capacity is not null and (p_capacity < 1 or p_capacity > 5000) then
    raise exception 'academic group capacity is invalid';
  end if;

  if not exists (
    select 1 from public.academic_sessions s
    where s.tenant_id = p_tenant_id
      and s.id = p_session_id
      and s.status in ('draft', 'active')
  ) then
    raise exception 'active academic session is required';
  end if;

  if not exists (
    select 1 from public.programs p
    where p.tenant_id = p_tenant_id
      and p.id = p_program_id
      and p.status = 'active'
      and (p.branch_id is null or p.branch_id = p_branch_id)
  ) then
    raise exception 'active program is required';
  end if;

  if p_level_id is not null and not exists (
    select 1 from public.academic_levels l
    where l.tenant_id = p_tenant_id
      and l.id = p_level_id
      and l.program_id = p_program_id
      and l.status = 'active'
  ) then
    raise exception 'academic level is outside this program';
  end if;

  if exists (
    select 1 from public.academic_groups g
    where g.tenant_id = p_tenant_id
      and g.branch_id = p_branch_id
      and g.session_id = p_session_id
      and g.key = v_key
  ) then
    raise exception 'academic group key already exists';
  end if;

  insert into public.academic_groups(
    tenant_id,
    branch_id,
    session_id,
    program_id,
    level_id,
    key,
    labels,
    capacity,
    status
  ) values (
    p_tenant_id,
    p_branch_id,
    p_session_id,
    p_program_id,
    p_level_id,
    v_key,
    p_labels,
    p_capacity,
    'active'
  ) returning id into v_group_id;

  insert into public.audit_events(
    tenant_id,
    branch_id,
    actor_identity_id,
    actor_membership_id,
    action,
    outcome,
    entity_type,
    entity_id,
    correlation_id,
    after_state,
    metadata
  ) values (
    p_tenant_id,
    p_branch_id,
    p_identity_id,
    v_membership_id,
    'academics.group.create',
    'succeeded',
    'academic_group',
    v_group_id::text,
    gen_random_uuid(),
    jsonb_build_object(
      'session_id', p_session_id,
      'program_id', p_program_id,
      'level_id', p_level_id,
      'key', v_key,
      'capacity', p_capacity
    ),
    jsonb_build_object('source', 'client_v3_phase4_setup')
  );

  return jsonb_build_object(
    'group_id', v_group_id,
    'session_id', p_session_id,
    'program_id', p_program_id,
    'level_id', p_level_id,
    'key', v_key
  );
end;
$$;

revoke all on function public.create_academic_group_v1(uuid,bigint,bigint,bigint,bigint,text,jsonb,integer,bigint)
  from public, anon, authenticated;
grant execute on function public.create_academic_group_v1(uuid,bigint,bigint,bigint,bigint,text,jsonb,integer,bigint)
  to service_role;

commit;
