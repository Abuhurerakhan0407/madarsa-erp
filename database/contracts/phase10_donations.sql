-- Phase 10 executable database contract: funds, donors, donations, and sponsorships.

insert into public.permissions (code, description) values
  ('donation.crm.read', 'Read donor CRM records'),
  ('donation.crm.manage', 'Manage donor CRM records'),
  ('donation.payment.record', 'Record and reconcile donations'),
  ('donation.receipt.issue', 'Issue and reverse donation receipts'),
  ('donation.fund.manage', 'Manage restricted and unrestricted funds'),
  ('donation.sponsor.manage', 'Manage sponsorship agreements'),
  ('donation.impact.publish', 'Publish privacy-safe sponsor impact updates')
on conflict (code) do nothing;

create table public.funds (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  code text not null check (length(btrim(code)) between 1 and 40),
  labels jsonb not null,
  fund_type text not null check (fund_type in ('restricted','unrestricted','endowment_placeholder')),
  purpose text not null,
  starts_on date not null,
  ends_on date,
  income_account_id bigint not null,
  expense_account_ids bigint[] not null default array[]::bigint[],
  available_balance_policy text not null default 'block' check (available_balance_policy in ('block','warn','allow_approved')),
  reporting_rules jsonb not null default '{}'::jsonb,
  state text not null default 'active' check (state in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, income_account_id) references public.chart_accounts(tenant_id, id) on delete restrict,
  constraint funds_dates_check check (ends_on is null or ends_on >= starts_on)
);

alter table public.journal_lines add constraint journal_lines_fund_fk
  foreign key (tenant_id, fund_id) references public.funds(tenant_id, id) on delete restrict;

create table public.fund_transfers (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  from_fund_id bigint not null,
  to_fund_id bigint not null,
  amount numeric(18,4) not null check (amount > 0),
  reason text not null check (length(btrim(reason)) >= 4),
  state text not null default 'pending' check (state in ('pending','approved','posted','rejected','reversed')),
  approved_by_membership_id bigint,
  journal_id bigint,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, from_fund_id) references public.funds(tenant_id, id) on delete restrict,
  foreign key (tenant_id, to_fund_id) references public.funds(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict,
  constraint fund_transfer_distinct_check check (from_fund_id <> to_fund_id)
);

create table public.donors (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  person_id bigint,
  donor_type text not null check (donor_type in ('person','organization','anonymous')),
  display_name text not null,
  organization_name text,
  preferred_locale text,
  preferred_channel text,
  anonymity_preference text not null default 'private' check (anonymity_preference in ('private','receipt_only','public_name','fully_anonymous')),
  portal_identity_id uuid,
  notes text,
  state text not null default 'active' check (state in ('active','do_not_contact','merged','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, person_id) references public.persons(tenant_id, id) on delete restrict
);

create table public.donor_consents (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  donor_id bigint not null,
  purpose text not null,
  channel text not null,
  state text not null check (state in ('granted','denied','withdrawn','expired')),
  captured_at timestamptz not null,
  expires_at timestamptz,
  source text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, donor_id) references public.donors(tenant_id, id) on delete cascade
);

create table public.donation_categories (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  labels jsonb not null,
  default_fund_type text not null check (default_fund_type in ('restricted','unrestricted','configurable')),
  state text not null default 'active' check (state in ('active','inactive','archived')),
  unique (tenant_id, id),
  unique (tenant_id, key)
);

create table public.donation_campaigns (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null,
  labels jsonb not null,
  fund_id bigint,
  starts_on date,
  ends_on date,
  goal_amount numeric(18,4),
  state text not null default 'draft' check (state in ('draft','active','paused','completed','archived')),
  unique (tenant_id, id),
  unique (tenant_id, key),
  foreign key (tenant_id, fund_id) references public.funds(tenant_id, id) on delete restrict,
  constraint donation_campaign_dates_check check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.donations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  donor_id bigint,
  category_id bigint not null,
  campaign_id bigint,
  fund_id bigint,
  donation_date date not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  amount numeric(18,4) not null check (amount > 0),
  mode text not null check (mode in ('cash','bank_transfer','cheque','upi','razorpay','in_kind','custom')),
  provider_reference text,
  designation text,
  state text not null default 'pending' check (state in ('pending','verified','posted','failed','reversed','refunded')),
  signature_verified boolean not null default false,
  verified_at timestamptz,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  journal_id bigint,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, donor_id) references public.donors(tenant_id, id) on delete restrict,
  foreign key (tenant_id, category_id) references public.donation_categories(tenant_id, id) on delete restrict,
  foreign key (tenant_id, campaign_id) references public.donation_campaigns(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fund_id) references public.funds(tenant_id, id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict,
  constraint donations_online_verification_check check (mode <> 'razorpay' or state in ('pending','failed') or (signature_verified and verified_at is not null)),
  constraint donations_in_kind_check check (mode <> 'in_kind' or state <> 'posted')
);

create table public.donation_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  donation_id bigint not null,
  provider_event_id text,
  event_type text not null,
  payload_digest text not null check (length(payload_digest) between 32 and 128),
  signature_verified boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  foreign key (tenant_id, donation_id) references public.donations(tenant_id, id) on delete restrict
);
create unique index donation_events_provider_idx on public.donation_events (tenant_id, provider_event_id) where provider_event_id is not null;

create table public.donation_receipts (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  donation_id bigint not null,
  receipt_number text not null,
  revision integer not null default 1 check (revision > 0),
  verification_code text not null unique,
  state text not null default 'issued' check (state in ('issued','reversed','superseded')),
  tax_claim_status text not null default 'not_implemented' check (tax_claim_status = 'not_implemented'),
  issued_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, receipt_number, revision),
  foreign key (tenant_id, donation_id) references public.donations(tenant_id, id) on delete restrict
);

create table public.donation_receipt_reversals (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  receipt_id bigint not null,
  reversal_number text not null,
  reason text not null check (length(btrim(reason)) >= 4),
  journal_id bigint not null,
  approved_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, receipt_id),
  unique (tenant_id, reversal_number),
  foreign key (tenant_id, receipt_id) references public.donation_receipts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create table public.in_kind_donations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  donation_id bigint not null,
  description text not null,
  quantity numeric(18,4) not null check (quantity > 0),
  unit text not null,
  estimated_value numeric(18,4),
  valuation_basis text,
  designated_use text,
  storage_or_recipient text,
  accounting_policy_approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, donation_id),
  foreign key (tenant_id, donation_id) references public.donations(tenant_id, id) on delete restrict,
  constraint in_kind_valuation_check check (estimated_value is null or length(btrim(valuation_basis)) >= 4)
);

create table public.sponsorship_agreements (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  donor_id bigint not null,
  fund_id bigint not null,
  key text not null,
  sponsorship_type text not null check (sponsorship_type in ('student','multiple_students','anonymous_pool','program')),
  amount numeric(18,4) not null check (amount > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  frequency text not null check (frequency in ('one_time','monthly','quarterly','annual','custom')),
  starts_on date not null,
  ends_on date,
  allowed_use text not null,
  privacy_level text not null default 'summary' check (privacy_level in ('none','summary','approved_detail')),
  communication_permission boolean not null default false,
  state text not null default 'prospect' check (state in ('prospect','pledged','active','paused','completed','ended','defaulted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key),
  foreign key (tenant_id, donor_id) references public.donors(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fund_id) references public.funds(tenant_id, id) on delete restrict,
  constraint sponsorship_dates_check check (ends_on is null or ends_on >= starts_on)
);

create table public.sponsorship_beneficiaries (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  sponsorship_id bigint not null,
  student_person_id bigint,
  program_id bigint,
  pool_key text,
  effective_from date not null,
  effective_to date,
  approved_by_membership_id bigint not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, sponsorship_id) references public.sponsorship_agreements(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id) references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, program_id) references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint sponsorship_beneficiary_target_check check (num_nonnulls(student_person_id, program_id, pool_key) = 1),
  constraint sponsorship_beneficiary_dates_check check (effective_to is null or effective_to >= effective_from)
);

create table public.sponsorship_schedules (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  sponsorship_id bigint not null,
  due_on date not null,
  amount numeric(18,4) not null check (amount > 0),
  state text not null default 'due' check (state in ('scheduled','due','part_received','received','waived','missed','cancelled')),
  followup_state text not null default 'none' check (followup_state in ('none','queued','contacted','resolved','suppressed')),
  unique (tenant_id, id),
  unique (tenant_id, sponsorship_id, due_on),
  foreign key (tenant_id, sponsorship_id) references public.sponsorship_agreements(tenant_id, id) on delete cascade
);

create table public.sponsorship_allocations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  sponsorship_id bigint not null,
  donation_id bigint not null,
  schedule_id bigint,
  beneficiary_id bigint,
  amount numeric(18,4) not null check (amount > 0),
  allocated_at timestamptz not null default now(),
  unique (tenant_id, sponsorship_id, donation_id, schedule_id, beneficiary_id),
  foreign key (tenant_id, sponsorship_id) references public.sponsorship_agreements(tenant_id, id) on delete restrict,
  foreign key (tenant_id, donation_id) references public.donations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, schedule_id) references public.sponsorship_schedules(tenant_id, id) on delete restrict,
  foreign key (tenant_id, beneficiary_id) references public.sponsorship_beneficiaries(tenant_id, id) on delete restrict
);

create table public.sponsor_impact_updates (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  sponsorship_id bigint not null,
  beneficiary_id bigint,
  period_key text not null,
  approved_summary jsonb not null,
  source_digest text not null check (length(source_digest) between 32 and 128),
  state text not null default 'draft' check (state in ('draft','approved','published','superseded','revoked')),
  approved_by_membership_id bigint,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, sponsorship_id, beneficiary_id, period_key),
  foreign key (tenant_id, sponsorship_id) references public.sponsorship_agreements(tenant_id, id) on delete restrict,
  foreign key (tenant_id, beneficiary_id) references public.sponsorship_beneficiaries(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint sponsor_impact_approval_check check (state not in ('approved','published') or (approved_by_membership_id is not null and approved_at is not null)),
  constraint sponsor_impact_publish_check check (state <> 'published' or published_at is not null)
);

create index funds_type_idx on public.funds (tenant_id, fund_type, state);
create index donors_name_idx on public.donors (tenant_id, display_name);
create index donations_donor_idx on public.donations (tenant_id, donor_id, donation_date desc);
create index donations_fund_idx on public.donations (tenant_id, fund_id, state, donation_date);
create index sponsorships_donor_idx on public.sponsorship_agreements (tenant_id, donor_id, state);
create index sponsorship_schedules_due_idx on public.sponsorship_schedules (tenant_id, state, due_on);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'funds','fund_transfers','donors','donor_consents','donation_categories','donation_campaigns',
    'donations','donation_events','donation_receipts','donation_receipt_reversals','in_kind_donations',
    'sponsorship_agreements','sponsorship_beneficiaries','sponsorship_schedules',
    'sponsorship_allocations','sponsor_impact_updates'
  ] loop
    execute format('create trigger %I before update of tenant_id on public.%I for each row execute function private.enforce_immutable_tenant_id()', table_name || '_immutable_tenant', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger donor_consents_append_only before update or delete on public.donor_consents for each row execute function private.reject_append_only_mutation();
create trigger donation_receipts_append_only before update or delete on public.donation_receipts for each row execute function private.reject_append_only_mutation();
create trigger donation_receipt_reversals_append_only before update or delete on public.donation_receipt_reversals for each row execute function private.reject_append_only_mutation();
create trigger sponsorship_allocations_append_only before update or delete on public.sponsorship_allocations for each row execute function private.reject_append_only_mutation();

grant select on table
  public.funds, public.fund_transfers, public.donors, public.donor_consents,
  public.donation_categories, public.donation_campaigns, public.donations, public.donation_events,
  public.donation_receipts, public.donation_receipt_reversals, public.in_kind_donations,
  public.sponsorship_agreements, public.sponsorship_beneficiaries, public.sponsorship_schedules,
  public.sponsorship_allocations, public.sponsor_impact_updates
to authenticated;

create policy funds_finance_read on public.funds for select to authenticated using (private.has_permission(tenant_id, 'donation.fund.manage', null));
create policy fund_transfers_finance_read on public.fund_transfers for select to authenticated using (private.has_permission(tenant_id, 'donation.fund.manage', null));
create policy donors_crm_read on public.donors for select to authenticated using (private.has_permission(tenant_id, 'donation.crm.read', null));
create policy donor_consents_crm_read on public.donor_consents for select to authenticated using (private.has_permission(tenant_id, 'donation.crm.read', null));
create policy donation_categories_crm_read on public.donation_categories for select to authenticated using (private.has_permission(tenant_id, 'donation.crm.read', null));
create policy donation_campaigns_crm_read on public.donation_campaigns for select to authenticated using (private.has_permission(tenant_id, 'donation.crm.read', null));
create policy donations_crm_read on public.donations for select to authenticated using (private.has_permission(tenant_id, 'donation.crm.read', branch_id));
create policy donation_events_finance_read on public.donation_events for select to authenticated using (private.has_permission(tenant_id, 'donation.payment.record', null));
create policy donation_receipts_crm_read on public.donation_receipts for select to authenticated using (private.has_permission(tenant_id, 'donation.crm.read', null));
create policy donation_receipt_reversals_finance_read on public.donation_receipt_reversals for select to authenticated using (private.has_permission(tenant_id, 'donation.receipt.issue', null));
create policy in_kind_donations_crm_read on public.in_kind_donations for select to authenticated using (private.has_permission(tenant_id, 'donation.crm.read', null));
create policy sponsorships_crm_read on public.sponsorship_agreements for select to authenticated using (private.has_permission(tenant_id, 'donation.sponsor.manage', null));
create policy sponsorship_beneficiaries_staff_read on public.sponsorship_beneficiaries for select to authenticated using (private.has_permission(tenant_id, 'donation.sponsor.manage', null));
create policy sponsorship_schedules_staff_read on public.sponsorship_schedules for select to authenticated using (private.has_permission(tenant_id, 'donation.sponsor.manage', null));
create policy sponsorship_allocations_staff_read on public.sponsorship_allocations for select to authenticated using (private.has_permission(tenant_id, 'donation.sponsor.manage', null));
create policy sponsor_impact_staff_read on public.sponsor_impact_updates for select to authenticated using (private.has_permission(tenant_id, 'donation.sponsor.manage', null));
