-- Phase 2 executable database contract.
-- Promote this file into a CLI-generated Supabase migration before deployment.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema public from anon;
grant usage on schema public, private to authenticated;

create table public.profiles (
  identity_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 2 and 160),
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'ur', 'ar')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id bigint generated always as identity primary key,
  name text not null check (length(btrim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  state text not null default 'onboarding'
    check (state in (
      'onboarding', 'trial', 'active', 'grace', 'restricted',
      'suspended', 'closed', 'deletion_pending', 'deleted'
    )),
  primary_branch_id bigint,
  legal_hold boolean not null default false,
  deletion_scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_deletion_schedule_check check (
    (state = 'deletion_pending' and deletion_scheduled_at is not null)
    or (state <> 'deletion_pending' and deletion_scheduled_at is null)
  ),
  unique (id, primary_branch_id)
);

create table public.branches (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  name text not null check (length(btrim(name)) between 2 and 160),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, id)
);

alter table public.tenants
  add constraint tenants_primary_branch_fk
  foreign key (id, primary_branch_id)
  references public.branches(tenant_id, id)
  on delete restrict;

create table public.memberships (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  identity_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'invited'
    check (status in ('active', 'invited', 'suspended', 'expired', 'revoked')),
  all_branches boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_access_window_check check (
    ends_at is null or starts_at is null or ends_at > starts_at
  ),
  unique (tenant_id, identity_id),
  unique (tenant_id, id)
);

create table public.tenant_lifecycle_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  from_state text not null check (from_state in (
    'onboarding', 'trial', 'active', 'grace', 'restricted',
    'suspended', 'closed', 'deletion_pending', 'deleted'
  )),
  to_state text not null check (to_state in (
    'onboarding', 'trial', 'active', 'grace', 'restricted',
    'suspended', 'closed', 'deletion_pending', 'deleted'
  )),
  reason text not null check (length(btrim(reason)) between 8 and 500),
  actor_identity_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id bigint,
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, actor_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint tenant_lifecycle_events_state_change_check check (from_state <> to_state)
);

create table public.roles (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  name text not null check (length(btrim(name)) between 2 and 120),
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id)
);

create table public.permissions (
  code text primary key check (code ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  description text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  role_id bigint not null,
  permission_code text not null references public.permissions(code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tenant_id, role_id, permission_code),
  foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id) on delete cascade
);

create table public.membership_roles (
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  membership_id bigint not null,
  role_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, membership_id, role_id),
  foreign key (tenant_id, membership_id)
    references public.memberships(tenant_id, id) on delete cascade,
  foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id) on delete cascade
);

create table public.membership_branch_scopes (
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  membership_id bigint not null,
  branch_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, membership_id, branch_id),
  foreign key (tenant_id, membership_id)
    references public.memberships(tenant_id, id) on delete cascade,
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete cascade
);

create table public.scope_bindings (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  membership_id bigint not null,
  scope_type text not null check (
    scope_type in ('program', 'cohort', 'group', 'student', 'department', 'fund', 'self', 'linked_person')
  ),
  scope_key text not null check (length(btrim(scope_key)) between 1 and 160),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, membership_id)
    references public.memberships(tenant_id, id) on delete cascade,
  unique (tenant_id, membership_id, scope_type, scope_key)
);

create table public.delegations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  issuer_membership_id bigint not null,
  recipient_membership_id bigint not null,
  permission_code text not null references public.permissions(code) on delete restrict,
  branch_id bigint,
  reason text not null check (length(btrim(reason)) between 8 and 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, issuer_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, recipient_membership_id)
    references public.memberships(tenant_id, id) on delete cascade,
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  constraint delegations_memberships_differ_check check (
    issuer_membership_id <> recipient_membership_id
  ),
  constraint delegations_access_window_check check (ends_at > starts_at),
  constraint delegations_revocation_time_check check (
    revoked_at is null or revoked_at >= created_at
  )
);

create table public.access_relationships (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  identity_id uuid not null references auth.users(id) on delete restrict,
  related_person_key text not null check (length(btrim(related_person_key)) between 1 and 160),
  relationship_type text not null check (
    relationship_type in ('self', 'guardian', 'sponsor', 'employee', 'teacher', 'other')
  ),
  permitted_actions text[] not null default array[]::text[],
  restriction_flags jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'restricted', 'revoked', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  verified_at timestamptz,
  verified_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, verified_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint access_relationships_window_check check (
    ends_at is null or starts_at is null or ends_at > starts_at
  ),
  constraint access_relationships_verification_check check (
    status <> 'verified' or (verified_at is not null and verified_by_membership_id is not null)
  ),
  unique (tenant_id, identity_id, related_person_key, relationship_type)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  actor_identity_id uuid references auth.users(id) on delete restrict,
  actor_membership_id bigint,
  impersonator_identity_id uuid references auth.users(id) on delete restrict,
  impersonation_reason text,
  action text not null check (length(btrim(action)) between 3 and 120),
  outcome text not null check (outcome in ('allowed', 'denied', 'succeeded', 'failed')),
  entity_type text,
  entity_id text,
  correlation_id uuid not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint audit_events_impersonation_reason_check check (
    impersonator_identity_id is null or length(btrim(impersonation_reason)) >= 8
  )
);

create table public.security_events (
  id bigint generated always as identity primary key,
  tenant_id bigint references public.tenants(id) on delete restrict,
  branch_id bigint,
  actor_identity_id uuid references auth.users(id) on delete restrict,
  action text not null check (length(btrim(action)) between 3 and 120),
  outcome text not null check (outcome in ('allowed', 'denied', 'succeeded', 'failed')),
  correlation_id uuid not null,
  source text not null check (length(btrim(source)) between 2 and 80),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  constraint security_events_branch_tenant_check check (
    branch_id is null or tenant_id is not null
  )
);

create index branches_tenant_status_idx
  on public.branches (tenant_id, status);
create index memberships_identity_status_idx
  on public.memberships (identity_id, status, tenant_id);
create index memberships_tenant_status_idx
  on public.memberships (tenant_id, status, identity_id);
create index roles_tenant_status_idx
  on public.roles (tenant_id, status);
create index tenant_lifecycle_events_tenant_occurred_idx
  on public.tenant_lifecycle_events (tenant_id, occurred_at desc);
create index tenant_lifecycle_events_correlation_idx
  on public.tenant_lifecycle_events (tenant_id, correlation_id);
create index role_permissions_permission_idx
  on public.role_permissions (permission_code, tenant_id, role_id);
create index membership_roles_role_idx
  on public.membership_roles (tenant_id, role_id, membership_id);
create index membership_branch_scopes_branch_idx
  on public.membership_branch_scopes (tenant_id, branch_id, membership_id);
create index scope_bindings_lookup_idx
  on public.scope_bindings (tenant_id, scope_type, scope_key, membership_id);
create index delegations_recipient_active_idx
  on public.delegations (tenant_id, recipient_membership_id, permission_code, starts_at, ends_at)
  where revoked_at is null;
create index delegations_issuer_idx
  on public.delegations (tenant_id, issuer_membership_id, created_at desc);
create index delegations_branch_idx
  on public.delegations (tenant_id, branch_id, recipient_membership_id)
  where branch_id is not null and revoked_at is null;
create index access_relationships_identity_idx
  on public.access_relationships (identity_id, tenant_id, status, related_person_key);
create index access_relationships_tenant_person_idx
  on public.access_relationships (tenant_id, related_person_key, status, identity_id);
create index audit_events_tenant_occurred_idx
  on public.audit_events (tenant_id, occurred_at desc);
create index audit_events_tenant_branch_occurred_idx
  on public.audit_events (tenant_id, branch_id, occurred_at desc)
  where branch_id is not null;
create index audit_events_actor_idx
  on public.audit_events (tenant_id, actor_identity_id, occurred_at desc)
  where actor_identity_id is not null;
create index audit_events_correlation_idx
  on public.audit_events (tenant_id, correlation_id);
create index security_events_tenant_occurred_idx
  on public.security_events (tenant_id, occurred_at desc)
  where tenant_id is not null;
create index security_events_actor_occurred_idx
  on public.security_events (actor_identity_id, occurred_at desc)
  where actor_identity_id is not null;
create index security_events_correlation_idx
  on public.security_events (correlation_id);

insert into public.permissions (code, description) values
  ('settings.tenant.manage', 'Manage tenant settings and lifecycle'),
  ('settings.roles.manage', 'Manage roles, permissions, and membership assignments'),
  ('security.audit.read', 'Read tenant security audit events'),
  ('documents.file.read', 'Read tenant documents'),
  ('documents.file.manage', 'Create and manage tenant documents'),
  ('students.profile.read', 'Read student profiles'),
  ('students.profile.update', 'Update student profiles'),
  ('attendance.student.mark', 'Mark student attendance'),
  ('exams.results.publish', 'Publish examination results'),
  ('finance.receipt.reverse', 'Reverse financial receipts'),
  ('donations.fund.allocate', 'Allocate donations to funds')
on conflict (code) do nothing;

create or replace function private.has_tenant_membership(p_tenant_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.identity_id = (select auth.uid())
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
  );
$$;

create or replace function private.has_any_tenant_membership()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.identity_id = (select auth.uid())
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
  );
$$;

create or replace function private.has_permission(
  p_tenant_id bigint,
  p_permission_code text,
  p_branch_id bigint default null
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
      and m.identity_id = (select auth.uid())
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
          on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.status = 'active'
        join public.role_permissions rp
          on rp.tenant_id = r.tenant_id and rp.role_id = r.id
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

create or replace function private.has_relationship(
  p_tenant_id bigint,
  p_related_person_key text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_relationships ar
    where ar.tenant_id = p_tenant_id
      and ar.identity_id = (select auth.uid())
      and ar.related_person_key = p_related_person_key
      and ar.status = 'verified'
      and (ar.starts_at is null or ar.starts_at <= now())
      and (ar.ends_at is null or ar.ends_at > now())
      and p_action = any(ar.permitted_actions)
  );
$$;

create or replace function private.tenant_transition_allowed(
  p_from text,
  p_to text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'onboarding' then p_to = any(array['trial', 'active', 'closed'])
    when 'trial' then p_to = any(array['active', 'grace', 'restricted', 'suspended', 'closed'])
    when 'active' then p_to = any(array['grace', 'restricted', 'suspended', 'closed'])
    when 'grace' then p_to = any(array['active', 'restricted', 'suspended', 'closed'])
    when 'restricted' then p_to = any(array['active', 'grace', 'suspended', 'closed'])
    when 'suspended' then p_to = any(array['active', 'restricted', 'closed'])
    when 'closed' then p_to = any(array['active', 'deletion_pending'])
    when 'deletion_pending' then p_to = any(array['closed', 'deleted'])
    else false
  end;
$$;

create or replace function private.enforce_tenant_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state is distinct from old.state then
    if not private.tenant_transition_allowed(old.state, new.state) then
      raise exception 'tenant lifecycle transition is not allowed: % -> %', old.state, new.state;
    end if;

    if new.legal_hold and new.state in ('deletion_pending', 'deleted') then
      raise exception 'tenant under legal hold cannot enter deletion state';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.enforce_immutable_tenant_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id is immutable';
  end if;

  return new;
end;
$$;

create or replace function private.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

revoke all on function private.tenant_transition_allowed(text, text) from public, anon, authenticated;
revoke all on function private.enforce_tenant_transition() from public, anon, authenticated;
revoke all on function private.enforce_immutable_tenant_id() from public, anon, authenticated;
revoke all on function private.reject_append_only_mutation() from public, anon, authenticated;

create trigger tenants_enforce_transition
  before update of state, legal_hold on public.tenants
  for each row execute function private.enforce_tenant_transition();

create trigger branches_immutable_tenant
  before update of tenant_id on public.branches
  for each row execute function private.enforce_immutable_tenant_id();
create trigger memberships_immutable_tenant
  before update of tenant_id on public.memberships
  for each row execute function private.enforce_immutable_tenant_id();
create trigger roles_immutable_tenant
  before update of tenant_id on public.roles
  for each row execute function private.enforce_immutable_tenant_id();
create trigger role_permissions_immutable_tenant
  before update of tenant_id on public.role_permissions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger membership_roles_immutable_tenant
  before update of tenant_id on public.membership_roles
  for each row execute function private.enforce_immutable_tenant_id();
create trigger membership_branch_scopes_immutable_tenant
  before update of tenant_id on public.membership_branch_scopes
  for each row execute function private.enforce_immutable_tenant_id();
create trigger scope_bindings_immutable_tenant
  before update of tenant_id on public.scope_bindings
  for each row execute function private.enforce_immutable_tenant_id();
create trigger delegations_immutable_tenant
  before update of tenant_id on public.delegations
  for each row execute function private.enforce_immutable_tenant_id();
create trigger access_relationships_immutable_tenant
  before update of tenant_id on public.access_relationships
  for each row execute function private.enforce_immutable_tenant_id();

create trigger tenant_lifecycle_events_append_only
  before update or delete on public.tenant_lifecycle_events
  for each row execute function private.reject_append_only_mutation();
create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function private.reject_append_only_mutation();
create trigger security_events_append_only
  before update or delete on public.security_events
  for each row execute function private.reject_append_only_mutation();

revoke all on function private.has_tenant_membership(bigint) from public, anon;
revoke all on function private.has_any_tenant_membership() from public, anon;
revoke all on function private.has_permission(bigint, text, bigint) from public, anon;
revoke all on function private.has_relationship(bigint, text, text) from public, anon;
grant execute on function private.has_tenant_membership(bigint) to authenticated;
grant execute on function private.has_any_tenant_membership() to authenticated;
grant execute on function private.has_permission(bigint, text, bigint) to authenticated;
grant execute on function private.has_relationship(bigint, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.branches enable row level security;
alter table public.branches force row level security;
alter table public.tenant_lifecycle_events enable row level security;
alter table public.tenant_lifecycle_events force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.roles enable row level security;
alter table public.roles force row level security;
alter table public.permissions enable row level security;
alter table public.permissions force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
alter table public.membership_roles enable row level security;
alter table public.membership_roles force row level security;
alter table public.membership_branch_scopes enable row level security;
alter table public.membership_branch_scopes force row level security;
alter table public.scope_bindings enable row level security;
alter table public.scope_bindings force row level security;
alter table public.delegations enable row level security;
alter table public.delegations force row level security;
alter table public.access_relationships enable row level security;
alter table public.access_relationships force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
alter table public.security_events enable row level security;
alter table public.security_events force row level security;

create policy profiles_select_self
  on public.profiles for select to authenticated
  using (identity_id = (select auth.uid()));

create policy tenants_select_member
  on public.tenants for select to authenticated
  using ((select private.has_tenant_membership(id)));

create policy branches_select_member
  on public.branches for select to authenticated
  using ((select private.has_tenant_membership(tenant_id)));

create policy tenant_lifecycle_events_select_manager
  on public.tenant_lifecycle_events for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.tenant.manage')));

create policy memberships_select_self_or_manager
  on public.memberships for select to authenticated
  using (
    identity_id = (select auth.uid())
    or (select private.has_permission(tenant_id, 'settings.roles.manage'))
  );

create policy roles_select_member
  on public.roles for select to authenticated
  using ((select private.has_tenant_membership(tenant_id)));

create policy permissions_select_member
  on public.permissions for select to authenticated
  using ((select private.has_any_tenant_membership()));

create policy role_permissions_select_member
  on public.role_permissions for select to authenticated
  using ((select private.has_tenant_membership(tenant_id)));

create policy membership_roles_select_self_or_manager
  on public.membership_roles for select to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.tenant_id = membership_roles.tenant_id
        and m.id = membership_roles.membership_id
        and m.identity_id = (select auth.uid())
    )
    or (select private.has_permission(tenant_id, 'settings.roles.manage'))
  );

create policy membership_branch_scopes_select_self_or_manager
  on public.membership_branch_scopes for select to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.tenant_id = membership_branch_scopes.tenant_id
        and m.id = membership_branch_scopes.membership_id
        and m.identity_id = (select auth.uid())
    )
    or (select private.has_permission(tenant_id, 'settings.roles.manage'))
  );

create policy scope_bindings_select_self_or_manager
  on public.scope_bindings for select to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.tenant_id = scope_bindings.tenant_id
        and m.id = scope_bindings.membership_id
        and m.identity_id = (select auth.uid())
    )
    or (select private.has_permission(tenant_id, 'settings.roles.manage'))
  );

create policy delegations_select_participant_or_manager
  on public.delegations for select to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.tenant_id = delegations.tenant_id
        and m.identity_id = (select auth.uid())
        and m.id in (delegations.issuer_membership_id, delegations.recipient_membership_id)
    )
    or (select private.has_permission(tenant_id, 'settings.roles.manage'))
  );

create policy access_relationships_select_subject_or_manager
  on public.access_relationships for select to authenticated
  using (
    identity_id = (select auth.uid())
    or (select private.has_permission(tenant_id, 'settings.roles.manage'))
  );

create policy audit_events_select_auditor
  on public.audit_events for select to authenticated
  using ((select private.has_permission(tenant_id, 'security.audit.read', branch_id)));

create policy security_events_select_self_or_auditor
  on public.security_events for select to authenticated
  using (
    actor_identity_id = (select auth.uid())
    or (
      tenant_id is not null
      and (select private.has_permission(tenant_id, 'security.audit.read', branch_id))
    )
  );

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;
revoke insert, update, delete, truncate, references, trigger
  on public.profiles,
     public.tenants,
     public.branches,
     public.tenant_lifecycle_events,
     public.memberships,
     public.roles,
     public.permissions,
     public.role_permissions,
     public.membership_roles,
     public.membership_branch_scopes,
     public.scope_bindings,
     public.delegations,
     public.access_relationships,
     public.audit_events,
     public.security_events
  from authenticated;
grant select
  on public.profiles,
     public.tenants,
     public.branches,
     public.tenant_lifecycle_events,
     public.memberships,
     public.roles,
     public.permissions,
     public.role_permissions,
     public.membership_roles,
     public.membership_branch_scopes,
     public.scope_bindings,
     public.delegations,
     public.access_relationships,
     public.audit_events,
     public.security_events
  to authenticated;
