-- Phase 14 executable database contract: retention, recovery, incidents, and security operations.

insert into public.permissions (code, description) values
  ('security.retention.manage', 'Manage approved retention schedules'),
  ('security.audit.export', 'Export scoped audit evidence'),
  ('security.incident.manage', 'Manage operational incidents'),
  ('security.recovery.manage', 'Manage backup and restore evidence')
on conflict (code) do nothing;

create table public.data_retention_policies (
  id bigint generated always as identity primary key,
  tenant_id bigint references public.tenants(id) on delete restrict,
  category_key text not null, version integer not null check (version > 0),
  retention_days integer check (retention_days is null or retention_days > 0),
  disposition text not null check (disposition in ('delete','anonymize','restrict','review','indefinite_approved')),
  backup_expiry_days integer check (backup_expiry_days is null or backup_expiry_days > 0),
  policy_basis text not null, approved_by text not null, approved_at timestamptz not null,
  effective_from date not null, effective_to date,
  state text not null default 'active' check (state in ('active','superseded','archived')),
  unique nulls not distinct (tenant_id, category_key, version),
  constraint retention_policy_dates_check check (effective_to is null or effective_to >= effective_from)
);

create table public.legal_holds (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  scope_type text not null, scope_reference text not null, reason text not null,
  issued_by text not null, starts_at timestamptz not null, ends_at timestamptz,
  state text not null default 'active' check (state in ('active','released','expired')),
  released_by text, release_reason text,
  unique (tenant_id, scope_type, scope_reference, starts_at),
  constraint legal_hold_release_check check (state <> 'released' or (released_by is not null and length(btrim(release_reason)) >= 4))
);

create table public.data_deletion_jobs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  request_type text not null check (request_type in ('user_deletion','tenant_closure','retention_expiry','admin_correction')),
  scope jsonb not null, policy_snapshot jsonb not null, cooling_period_ends_at timestamptz,
  legal_hold_checked_at timestamptz, state text not null default 'requested' check (state in ('requested','cooling','blocked_hold','approved','running','partial','completed','failed','cancelled')),
  requested_by text not null, approved_by text, idempotency_key text not null,
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, idempotency_key),
  constraint deletion_job_approval_check check (state not in ('approved','running','partial','completed') or approved_by is not null)
);

create table public.data_deletion_job_items (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  deletion_job_id bigint not null, system_key text not null check (system_key in ('database','storage','cache','search','queue','provider')),
  target_reference text not null, action text not null check (action in ('delete','anonymize','restrict','expire','verify_absent')),
  state text not null default 'pending' check (state in ('pending','running','completed','failed','blocked','skipped')),
  evidence jsonb not null default '{}'::jsonb, attempted_at timestamptz, completed_at timestamptz,
  unique (tenant_id, deletion_job_id, system_key, target_reference, action),
  foreign key (tenant_id, deletion_job_id) references public.data_deletion_jobs(tenant_id, id) on delete cascade
);

create table public.backup_evidence (
  id bigint generated always as identity primary key,
  environment text not null check (environment in ('production','staging','restore_drill')),
  backup_type text not null check (backup_type in ('database','pitr','storage','configuration')),
  provider_reference text not null, started_at timestamptz not null, completed_at timestamptz,
  encrypted boolean not null, retention_until timestamptz,
  state text not null check (state in ('running','completed','failed','expired','verified')),
  verification_digest text, metadata jsonb not null default '{}'::jsonb,
  unique (environment, backup_type, provider_reference)
);

create table public.restore_drills (
  id bigint generated always as identity primary key,
  backup_evidence_id bigint not null references public.backup_evidence(id) on delete restrict,
  drill_environment text not null, started_at timestamptz not null, completed_at timestamptz,
  target_rpo_hours numeric(8,2) not null default 24, target_rto_hours numeric(8,2) not null default 8,
  measured_rpo_hours numeric(8,2), measured_rto_hours numeric(8,2),
  database_verified boolean not null default false, storage_verified boolean not null default false,
  application_verified boolean not null default false, findings jsonb not null default '[]'::jsonb,
  state text not null default 'planned' check (state in ('planned','running','passed','failed','remediation')),
  runbook_reference text not null, incident_lead text not null
);

create table public.operational_incidents (
  id bigint generated always as identity primary key,
  tenant_id bigint references public.tenants(id) on delete restrict,
  incident_number text not null unique, category text not null,
  severity text not null check (severity in ('sev1','sev2','sev3','sev4')),
  state text not null check (state in ('declared','investigating','mitigated','monitoring','resolved','closed')),
  safe_summary text not null, incident_lead text not null,
  started_at timestamptz not null, detected_at timestamptz not null, mitigated_at timestamptz, resolved_at timestamptz,
  customer_impact jsonb not null default '{}'::jsonb, communication_log jsonb not null default '[]'::jsonb,
  postmortem_reference text, created_at timestamptz not null default now()
);

create table public.security_rate_limit_events (
  id bigint generated always as identity primary key,
  tenant_id bigint references public.tenants(id) on delete restrict,
  action_key text not null, actor_hash text, source_hash text not null,
  decision text not null check (decision in ('allowed','throttled','blocked')),
  limit_snapshot jsonb not null, correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);

create table public.audit_export_jobs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  requested_by_membership_id bigint not null, purpose text not null check (length(btrim(purpose)) >= 8),
  filters jsonb not null, masked_fields text[] not null default array[]::text[],
  state text not null default 'queued' check (state in ('queued','running','completed','failed','expired','cancelled')),
  output_document_id bigint, expires_at timestamptz, idempotency_key text not null,
  created_at timestamptz not null default now(), unique (tenant_id, id), unique (tenant_id, idempotency_key),
  foreign key (tenant_id, requested_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, output_document_id) references public.documents(tenant_id, id) on delete restrict
);

create index deletion_jobs_state_idx on public.data_deletion_jobs (tenant_id, state, created_at);
create index operational_incidents_state_idx on public.operational_incidents (state, severity, started_at desc);
create index rate_limit_events_action_idx on public.security_rate_limit_events (action_key, occurred_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'data_retention_policies','legal_holds','data_deletion_jobs','data_deletion_job_items',
    'backup_evidence','restore_drills','operational_incidents','security_rate_limit_events','audit_export_jobs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger legal_holds_delete_protect before delete on public.legal_holds for each row execute function private.reject_append_only_mutation();
create trigger backup_evidence_delete_protect before delete on public.backup_evidence for each row execute function private.reject_append_only_mutation();
create trigger restore_drills_delete_protect before delete on public.restore_drills for each row execute function private.reject_append_only_mutation();
create trigger rate_limit_events_append_only before update or delete on public.security_rate_limit_events for each row execute function private.reject_append_only_mutation();

grant select on table public.data_retention_policies, public.legal_holds, public.data_deletion_jobs,
  public.data_deletion_job_items, public.audit_export_jobs to authenticated;

create policy retention_policies_tenant_read on public.data_retention_policies for select to authenticated using (tenant_id is not null and private.has_permission(tenant_id, 'security.retention.manage', null));
create policy legal_holds_tenant_read on public.legal_holds for select to authenticated using (private.has_permission(tenant_id, 'security.retention.manage', null));
create policy deletion_jobs_tenant_read on public.data_deletion_jobs for select to authenticated using (private.has_permission(tenant_id, 'security.retention.manage', null));
create policy deletion_items_tenant_read on public.data_deletion_job_items for select to authenticated using (private.has_permission(tenant_id, 'security.retention.manage', null));
create policy audit_exports_tenant_read on public.audit_export_jobs for select to authenticated using (private.has_permission(tenant_id, 'security.audit.export', null));
