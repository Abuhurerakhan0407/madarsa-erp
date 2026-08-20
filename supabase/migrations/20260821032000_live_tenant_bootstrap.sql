-- Transactional self-service tenant bootstrap.
-- Browser clients remain read-only. This RPC is callable only by the service role
-- from an authenticated, server-side route after identity verification.

create or replace function public.bootstrap_tenant(
  p_identity_id uuid,
  p_display_name text,
  p_institution_name text,
  p_slug text,
  p_branch_name text,
  p_branch_code text default 'MAIN'
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_tenant_id bigint;
  v_branch_id bigint;
  v_membership_id bigint;
  v_owner_role_id bigint;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null then
    raise exception 'identity is required';
  end if;

  if length(btrim(p_display_name)) not between 2 and 160 then
    raise exception 'display name must be between 2 and 160 characters';
  end if;

  if length(btrim(p_institution_name)) not between 2 and 160 then
    raise exception 'institution name must be between 2 and 160 characters';
  end if;

  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid tenant slug';
  end if;

  if length(btrim(p_branch_name)) not between 2 and 160 then
    raise exception 'branch name must be between 2 and 160 characters';
  end if;

  if p_branch_code !~ '^[A-Z0-9][A-Z0-9_-]{0,31}$' then
    raise exception 'invalid branch code';
  end if;

  insert into public.profiles (identity_id, display_name)
  values (p_identity_id, btrim(p_display_name))
  on conflict (identity_id) do nothing;

  insert into public.tenants (name, slug)
  values (btrim(p_institution_name), p_slug)
  returning id into v_tenant_id;

  insert into public.branches (tenant_id, code, name)
  values (v_tenant_id, p_branch_code, btrim(p_branch_name))
  returning id into v_branch_id;

  update public.tenants
  set primary_branch_id = v_branch_id,
      updated_at = now()
  where id = v_tenant_id;

  insert into public.memberships (
    tenant_id,
    identity_id,
    status,
    all_branches,
    starts_at
  )
  values (
    v_tenant_id,
    p_identity_id,
    'active',
    true,
    now()
  )
  returning id into v_membership_id;

  insert into public.roles (
    tenant_id,
    key,
    name,
    status,
    is_system
  )
  values (
    v_tenant_id,
    'institution_owner',
    'Institution Owner',
    'active',
    true
  )
  returning id into v_owner_role_id;

  insert into public.role_permissions (tenant_id, role_id, permission_code)
  select v_tenant_id, v_owner_role_id, p.code
  from public.permissions p;

  insert into public.membership_roles (tenant_id, membership_id, role_id)
  values (v_tenant_id, v_membership_id, v_owner_role_id);

  insert into public.audit_events (
    tenant_id,
    branch_id,
    actor_identity_id,
    actor_membership_id,
    action,
    outcome,
    entity_type,
    entity_id,
    correlation_id,
    metadata
  )
  values (
    v_tenant_id,
    v_branch_id,
    p_identity_id,
    v_membership_id,
    'tenant.bootstrap',
    'succeeded',
    'tenant',
    v_tenant_id::text,
    v_correlation_id,
    jsonb_build_object('source', 'self_service_onboarding')
  );

  return jsonb_build_object(
    'tenant_id', v_tenant_id,
    'branch_id', v_branch_id,
    'membership_id', v_membership_id,
    'role_id', v_owner_role_id
  );
end;
$$;

revoke all on function public.bootstrap_tenant(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.bootstrap_tenant(uuid, text, text, text, text, text)
  to service_role;
