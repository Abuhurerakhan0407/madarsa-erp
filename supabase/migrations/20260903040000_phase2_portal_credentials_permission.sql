begin;

insert into public.permissions (code, description)
values ('portal.credentials.create', 'Create guardian portal credentials during authorized onboarding')
on conflict (code) do update
set description = excluded.description;

insert into public.role_permissions (tenant_id, role_id, permission_code)
select rp.tenant_id, rp.role_id, 'portal.credentials.create'
from public.role_permissions rp
where rp.permission_code = 'admissions.application.convert'
on conflict do nothing;

create or replace function public.operator_has_permission_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with active_membership as (
    select m.id, m.tenant_id, m.all_branches
    from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.identity_id = p_identity_id
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
  )
  select exists (
    select 1
    from active_membership m
    where (
      p_branch_id is null
      or m.all_branches
      or exists (
        select 1
        from public.membership_branch_scopes mbs
        where mbs.tenant_id = m.tenant_id
          and mbs.membership_id = m.id
          and mbs.branch_id = p_branch_id
      )
    )
    and (
      exists (
        select 1
        from public.membership_roles mr
        join public.roles r
          on r.tenant_id = mr.tenant_id
         and r.id = mr.role_id
         and r.status = 'active'
        join public.role_permissions rp
          on rp.tenant_id = r.tenant_id
         and rp.role_id = r.id
        where mr.tenant_id = m.tenant_id
          and mr.membership_id = m.id
          and rp.permission_code = p_permission_code
      )
      or exists (
        select 1
        from public.delegations d
        where d.tenant_id = m.tenant_id
          and d.recipient_membership_id = m.id
          and d.permission_code = p_permission_code
          and d.starts_at <= now()
          and d.ends_at > now()
          and d.revoked_at is null
          and (d.branch_id is null or d.branch_id = p_branch_id)
      )
    )
  );
$$;

revoke all on function public.operator_has_permission_v1(uuid,bigint,bigint,text) from public, anon, authenticated;
grant execute on function public.operator_has_permission_v1(uuid,bigint,bigint,text) to service_role;

commit;
