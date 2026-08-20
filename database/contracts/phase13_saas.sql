-- Phase 13 executable database contract: SaaS billing, entitlements, and platform controls.

insert into public.permissions (code, description) values
  ('billing.subscription.read', 'Read tenant subscription state'),
  ('billing.usage.read', 'Read tenant usage evidence'),
  ('billing.recovery.manage', 'Manage tenant payment recovery')
on conflict (code) do nothing;

create table public.saas_plans (
  id bigint generated always as identity primary key,
  key text not null unique, labels jsonb not null,
  allowance_rules jsonb not null, entitlement_rules jsonb not null,
  support_tier text not null, state text not null default 'draft' check (state in ('draft','active','retired','archived')),
  created_at timestamptz not null default now()
);

create table public.saas_price_versions (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.saas_plans(id) on delete restrict,
  market text not null, currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  billing_interval text not null check (billing_interval in ('quarterly','yearly')),
  version integer not null check (version > 0), amount numeric(18,4) not null check (amount >= 0),
  tax_treatment text not null default 'exclusive_unconfigured', effective_from date not null, effective_to date,
  grandfathering_policy jsonb not null default '{}'::jsonb,
  state text not null default 'draft' check (state in ('draft','active','retired','archived')),
  unique (plan_id, market, currency_code, billing_interval, version),
  constraint saas_price_dates_check check (effective_to is null or effective_to >= effective_from)
);

create table public.tenant_subscriptions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  plan_id bigint not null references public.saas_plans(id) on delete restrict,
  price_version_id bigint not null references public.saas_price_versions(id) on delete restrict,
  provider text not null default 'razorpay', provider_subscription_id text,
  normalized_state text not null check (normalized_state in ('trial','active','grace','cancel_at_period_end','restricted','suspended','expired','closed')),
  trial_ends_at timestamptz, current_period_starts_at timestamptz, current_period_ends_at timestamptz,
  grace_ends_at timestamptz, cancel_at_period_end boolean not null default false,
  state_version bigint not null default 1 check (state_version > 0), last_provider_event_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id), unique (provider, provider_subscription_id)
);

create table public.subscription_checkout_intents (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  plan_id bigint not null references public.saas_plans(id) on delete restrict,
  price_version_id bigint not null references public.saas_price_versions(id) on delete restrict,
  expected_amount numeric(18,4) not null, currency_code text not null,
  provider_intent_id text, state text not null default 'created' check (state in ('created','redirected','verified','completed','expired','failed','cancelled')),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128), expires_at timestamptz not null,
  created_at timestamptz not null default now(), unique (tenant_id, id), unique (tenant_id, idempotency_key)
);

create table public.subscription_provider_events (
  id bigint generated always as identity primary key,
  provider text not null, provider_event_id text not null,
  tenant_id bigint references public.tenants(id) on delete restrict,
  subscription_id bigint, event_type text not null, provider_occurred_at timestamptz not null,
  payload_digest text not null check (length(payload_digest) between 32 and 128), signature_verified boolean not null,
  processing_state text not null default 'received' check (processing_state in ('received','processed','ignored_stale','failed','quarantined')),
  processing_result jsonb, received_at timestamptz not null default now(), processed_at timestamptz,
  unique (provider, provider_event_id),
  foreign key (tenant_id, subscription_id) references public.tenant_subscriptions(tenant_id, id) on delete restrict
);

create table public.saas_billing_invoices (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  subscription_id bigint not null, provider_invoice_id text,
  invoice_number text not null, period_starts_at timestamptz not null, period_ends_at timestamptz not null,
  currency_code text not null, amount numeric(18,4) not null check (amount >= 0), tax_amount numeric(18,4) not null default 0,
  state text not null check (state in ('expected','issued','paid','failed','void','refunded','part_refunded')),
  provider_state_snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id, invoice_number), unique (provider_invoice_id),
  foreign key (tenant_id, subscription_id) references public.tenant_subscriptions(tenant_id, id) on delete restrict,
  constraint saas_invoice_period_check check (period_ends_at > period_starts_at)
);

create table public.saas_billing_payments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  invoice_id bigint not null, provider_payment_id text,
  currency_code text not null, amount numeric(18,4) not null check (amount > 0),
  state text not null check (state in ('pending','verified','captured','failed','refunded','reversed')),
  signature_verified boolean not null default false, paid_at timestamptz,
  created_at timestamptz not null default now(), unique (tenant_id, id), unique (provider_payment_id),
  foreign key (tenant_id, invoice_id) references public.saas_billing_invoices(tenant_id, id) on delete restrict,
  constraint saas_payment_verification_check check (state not in ('verified','captured','refunded','reversed') or signature_verified)
);

create table public.saas_usage_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  meter_key text not null, subject_key text, quantity numeric(18,4) not null,
  occurred_at timestamptz not null, source_domain text not null, source_id text not null,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(), unique (tenant_id, id), unique (tenant_id, idempotency_key)
);

create table public.saas_usage_snapshots (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  meter_key text not null, period_type text not null check (period_type in ('daily','monthly')),
  period_start date not null, quantity numeric(18,4) not null, source_event_count bigint not null,
  source_digest text not null check (length(source_digest) between 32 and 128), calculated_at timestamptz not null default now(),
  unique (tenant_id, meter_key, period_type, period_start)
);

create table public.tenant_entitlement_overrides (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  entitlement_key text not null, override_type text not null check (override_type in ('enable','disable','limit','allowance','grace')),
  value jsonb not null, starts_at timestamptz not null, ends_at timestamptz not null,
  reason text not null check (length(btrim(reason)) >= 4), issued_by_platform_operator text not null,
  revoked_at timestamptz, revocation_reason text, created_at timestamptz not null default now(),
  unique (tenant_id, id), constraint entitlement_override_dates_check check (ends_at > starts_at),
  constraint entitlement_override_revoke_check check (revoked_at is null or length(btrim(revocation_reason)) >= 4)
);

create table public.platform_tenant_actions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  event_type text not null check (event_type in ('created','trial_extended','activated','restricted','suspended','restored','closure_scheduled','closed')),
  previous_state text, next_state text not null, reason text not null,
  platform_operator text not null, evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.platform_feature_flags (
  id bigint generated always as identity primary key,
  key text not null unique, description text not null,
  default_value jsonb not null, rollout_policy jsonb not null default '{}'::jsonb,
  state text not null default 'active' check (state in ('active','paused','retired')),
  created_at timestamptz not null default now()
);

create table public.tenant_feature_assignments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  feature_flag_id bigint not null references public.platform_feature_flags(id) on delete restrict,
  value jsonb not null, reason text not null, starts_at timestamptz not null, ends_at timestamptz,
  issued_by_platform_operator text not null, created_at timestamptz not null default now(),
  unique (tenant_id, feature_flag_id, starts_at)
);

create table public.support_impersonation_sessions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  platform_operator text not null, target_membership_id bigint not null,
  purpose text not null check (length(btrim(purpose)) >= 8), approved_by text not null,
  starts_at timestamptz not null, expires_at timestamptz not null, ended_at timestamptz,
  state text not null default 'approved' check (state in ('approved','active','ended','expired','revoked')),
  visible_audit_reference uuid not null, created_at timestamptz not null default now(),
  foreign key (tenant_id, target_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint support_impersonation_times_check check (expires_at > starts_at and expires_at <= starts_at + interval '4 hours')
);

create table public.platform_support_cases (
  id bigint generated always as identity primary key,
  tenant_id bigint references public.tenants(id) on delete restrict,
  case_number text not null unique, category text not null, priority text not null check (priority in ('low','normal','high','urgent')),
  state text not null check (state in ('open','triaged','in_progress','waiting_customer','resolved','closed')),
  title text not null, safe_summary text not null, assigned_operator text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.platform_job_controls (
  id bigint generated always as identity primary key,
  tenant_id bigint references public.tenants(id) on delete restrict,
  job_type text not null, job_reference text not null, action text not null check (action in ('trigger','retry','cancel','quarantine','release')),
  reason text not null, requested_by_operator text not null, runbook_reference text not null,
  idempotency_key text not null, state text not null default 'requested' check (state in ('requested','approved','running','completed','failed','rejected')),
  created_at timestamptz not null default now(), unique (idempotency_key)
);

create index subscriptions_state_idx on public.tenant_subscriptions (normalized_state, current_period_ends_at);
create index provider_events_processing_idx on public.subscription_provider_events (processing_state, provider_occurred_at);
create index usage_events_meter_idx on public.saas_usage_events (tenant_id, meter_key, occurred_at);
create index support_cases_state_idx on public.platform_support_cases (state, priority, created_at);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'saas_plans','saas_price_versions','tenant_subscriptions','subscription_checkout_intents',
    'subscription_provider_events','saas_billing_invoices','saas_billing_payments','saas_usage_events',
    'saas_usage_snapshots','tenant_entitlement_overrides','platform_tenant_actions','platform_feature_flags',
    'tenant_feature_assignments','support_impersonation_sessions','platform_support_cases','platform_job_controls'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger usage_events_append_only before update or delete on public.saas_usage_events for each row execute function private.reject_append_only_mutation();
create trigger usage_snapshots_append_only before update or delete on public.saas_usage_snapshots for each row execute function private.reject_append_only_mutation();
create trigger platform_tenant_actions_append_only before update or delete on public.platform_tenant_actions for each row execute function private.reject_append_only_mutation();
create trigger support_impersonation_audit_append_only before delete on public.support_impersonation_sessions for each row execute function private.reject_append_only_mutation();

grant select on table public.saas_plans, public.saas_price_versions to authenticated;
grant select on table public.tenant_subscriptions, public.saas_billing_invoices, public.saas_billing_payments,
  public.saas_usage_snapshots, public.tenant_entitlement_overrides to authenticated;

create policy saas_plans_authenticated_read on public.saas_plans for select to authenticated using (state = 'active');
create policy saas_prices_authenticated_read on public.saas_price_versions for select to authenticated using (state = 'active');
create policy subscriptions_tenant_read on public.tenant_subscriptions for select to authenticated using (private.has_permission(tenant_id, 'billing.subscription.read', null));
create policy saas_invoices_tenant_read on public.saas_billing_invoices for select to authenticated using (private.has_permission(tenant_id, 'billing.subscription.read', null));
create policy saas_payments_tenant_read on public.saas_billing_payments for select to authenticated using (private.has_permission(tenant_id, 'billing.subscription.read', null));
create policy usage_snapshots_tenant_read on public.saas_usage_snapshots for select to authenticated using (private.has_permission(tenant_id, 'billing.usage.read', null));
create policy entitlement_overrides_tenant_read on public.tenant_entitlement_overrides for select to authenticated using (private.has_permission(tenant_id, 'billing.subscription.read', null));
