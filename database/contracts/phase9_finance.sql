-- Phase 9 executable database contract: fees, collections, and double-entry accounting.

insert into public.permissions (code, description) values
  ('finance.fees.read', 'Read scoped fee accounts'),
  ('finance.fees.manage', 'Manage fee structures and assignments'),
  ('finance.payment.collect', 'Collect and allocate payments'),
  ('finance.payment.reverse', 'Reverse posted financial records'),
  ('finance.journal.prepare', 'Prepare accounting journals'),
  ('finance.journal.approve', 'Approve accounting journals'),
  ('finance.journal.post', 'Post balanced accounting journals'),
  ('finance.period.manage', 'Close or reopen fiscal periods')
on conflict (code) do nothing;

create table public.chart_accounts (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  code text not null check (length(btrim(code)) between 1 and 40),
  labels jsonb not null,
  account_type text not null check (account_type in ('asset','liability','equity','income','expense')),
  parent_account_id bigint,
  normal_balance text not null check (normal_balance in ('debit','credit')),
  allow_posting boolean not null default true,
  state text not null default 'active' check (state in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, parent_account_id) references public.chart_accounts(tenant_id, id) on delete restrict
);

create table public.fiscal_periods (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null,
  starts_on date not null,
  ends_on date not null,
  state text not null default 'open' check (state in ('open','soft_closed','closed','reopened')),
  closed_by_membership_id bigint,
  closed_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key),
  foreign key (tenant_id, closed_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint fiscal_period_dates_check check (ends_on >= starts_on),
  constraint fiscal_period_close_check check (state not in ('soft_closed','closed') or closed_at is not null),
  constraint fiscal_period_reopen_check check (state <> 'reopened' or length(btrim(reopen_reason)) >= 4)
);

create table public.journals (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  fiscal_period_id bigint not null,
  journal_number text not null,
  journal_date date not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  source_domain text not null check (length(btrim(source_domain)) between 2 and 40),
  source_id text not null check (length(btrim(source_id)) between 1 and 128),
  correlation_id uuid not null,
  description text not null,
  state text not null default 'draft' check (state in ('draft','submitted','approved','posted','reversed')),
  reversal_of_journal_id bigint,
  prepared_by_membership_id bigint not null,
  approved_by_membership_id bigint,
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, journal_number),
  unique (tenant_id, source_domain, source_id, correlation_id),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fiscal_period_id) references public.fiscal_periods(tenant_id, id) on delete restrict,
  foreign key (tenant_id, reversal_of_journal_id) references public.journals(tenant_id, id) on delete restrict,
  foreign key (tenant_id, prepared_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint journal_approval_check check (state not in ('approved','posted','reversed') or (approved_by_membership_id is not null and approved_at is not null)),
  constraint journal_post_check check (state not in ('posted','reversed') or posted_at is not null),
  constraint journal_maker_checker_check check (approved_by_membership_id is null or approved_by_membership_id <> prepared_by_membership_id)
);

create table public.journal_lines (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  journal_id bigint not null,
  line_number integer not null check (line_number > 0),
  account_id bigint not null,
  branch_id bigint,
  party_type text,
  party_id text,
  fund_id bigint,
  debit numeric(18,4) not null default 0 check (debit >= 0),
  credit numeric(18,4) not null default 0 check (credit >= 0),
  description text,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, journal_id, line_number),
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete cascade,
  foreign key (tenant_id, account_id) references public.chart_accounts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  constraint journal_line_sided_check check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create table public.cash_bank_accounts (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  ledger_account_id bigint not null,
  key text not null,
  labels jsonb not null,
  account_type text not null check (account_type in ('cash','bank','upi','gateway','cheque_clearing')),
  masked_identifier text,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  state text not null default 'active' check (state in ('active','inactive','archived')),
  unique (tenant_id, id),
  unique (tenant_id, key),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, ledger_account_id) references public.chart_accounts(tenant_id, id) on delete restrict
);

create table public.fee_items (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  labels jsonb not null,
  category text not null check (category in ('admission','tuition','hostel','mess','transport','exam','library','certificate','deposit','custom')),
  receivable_account_id bigint not null,
  income_account_id bigint not null,
  refundable boolean not null default false,
  state text not null default 'active' check (state in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key),
  foreign key (tenant_id, receivable_account_id) references public.chart_accounts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, income_account_id) references public.chart_accounts(tenant_id, id) on delete restrict
);

create table public.fee_structure_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null,
  version integer not null check (version > 0),
  labels jsonb not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  frequency text not null check (frequency in ('one_time','monthly','quarterly','term','annual','installment','usage','manual')),
  state text not null default 'draft' check (state in ('draft','published','superseded','archived')),
  effective_from date not null,
  effective_to date,
  applicability jsonb not null default '{}'::jsonb,
  due_rules jsonb not null default '{}'::jsonb,
  fine_rules jsonb not null default '{}'::jsonb,
  refund_rules jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key, version),
  constraint fee_structure_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint fee_structure_publish_check check (state <> 'published' or published_at is not null)
);

create table public.fee_structure_items (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  fee_structure_version_id bigint not null,
  fee_item_id bigint not null,
  amount numeric(18,4) not null check (amount >= 0),
  installment_plan jsonb not null default '[]'::jsonb,
  optional boolean not null default false,
  sequence integer not null default 0 check (sequence >= 0),
  unique (tenant_id, id),
  unique (tenant_id, fee_structure_version_id, fee_item_id),
  foreign key (tenant_id, fee_structure_version_id) references public.fee_structure_versions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, fee_item_id) references public.fee_items(tenant_id, id) on delete restrict
);

create table public.fee_assignments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  fee_structure_version_id bigint not null,
  branch_id bigint,
  session_id bigint,
  program_id bigint,
  level_id bigint,
  group_id bigint,
  enrollment_id bigint,
  student_person_id bigint,
  starts_on date not null,
  ends_on date,
  state text not null default 'active' check (state in ('active','paused','ended','cancelled')),
  exception_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, fee_structure_version_id) references public.fee_structure_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, session_id) references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id) references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, level_id) references public.academic_levels(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id) references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id) references public.student_profiles(tenant_id, person_id) on delete restrict,
  constraint fee_assignments_target_check check (enrollment_id is not null or student_person_id is not null or branch_id is not null),
  constraint fee_assignments_dates_check check (ends_on is null or ends_on >= starts_on)
);

create table public.fee_concessions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  fee_assignment_id bigint not null,
  fee_item_id bigint,
  concession_type text not null check (concession_type in ('fixed','percentage','full_waiver','scholarship')),
  value numeric(18,4) not null check (value >= 0),
  starts_on date not null,
  ends_on date,
  funding_source text,
  reason text not null,
  state text not null default 'pending' check (state in ('pending','approved','rejected','expired','revoked')),
  approved_by_membership_id bigint,
  approved_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, fee_assignment_id) references public.fee_assignments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fee_item_id) references public.fee_items(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint fee_concession_percent_check check (concession_type <> 'percentage' or value <= 100),
  constraint fee_concession_approval_check check (state <> 'approved' or (approved_by_membership_id is not null and approved_at is not null))
);

create table public.fee_charges (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  enrollment_id bigint not null,
  student_person_id bigint not null,
  fee_assignment_id bigint not null,
  fee_item_id bigint not null,
  period_key text not null,
  charge_date date not null,
  due_date date not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  gross_amount numeric(18,4) not null check (gross_amount >= 0),
  concession_amount numeric(18,4) not null default 0 check (concession_amount >= 0),
  fine_amount numeric(18,4) not null default 0 check (fine_amount >= 0),
  net_amount numeric(18,4) generated always as (gross_amount - concession_amount + fine_amount) stored,
  state text not null default 'posted' check (state in ('posted','part_paid','paid','waived','written_off','reversed')),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  journal_id bigint,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, fee_assignment_id, fee_item_id, period_key),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id) references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, fee_assignment_id) references public.fee_assignments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fee_item_id) references public.fee_items(tenant_id, id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict,
  constraint fee_charge_net_check check (concession_amount <= gross_amount)
);

create table public.fee_adjustments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  fee_charge_id bigint not null,
  adjustment_type text not null check (adjustment_type in ('fine','fine_waiver','credit','correction','reversal')),
  amount numeric(18,4) not null check (amount <> 0),
  reason text not null check (length(btrim(reason)) >= 4),
  approved_by_membership_id bigint not null,
  journal_id bigint,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, fee_charge_id) references public.fee_charges(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict
);

create table public.fee_invoices (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  student_person_id bigint not null,
  invoice_number text not null,
  issue_date date not null,
  due_date date,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  state text not null default 'issued' check (state in ('draft','issued','part_paid','paid','cancelled','reversed')),
  total_amount numeric(18,4) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, invoice_number),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id) references public.student_profiles(tenant_id, person_id) on delete restrict
);

create table public.fee_invoice_lines (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  invoice_id bigint not null,
  fee_charge_id bigint not null,
  amount numeric(18,4) not null check (amount >= 0),
  unique (tenant_id, invoice_id, fee_charge_id),
  foreign key (tenant_id, invoice_id) references public.fee_invoices(tenant_id, id) on delete cascade,
  foreign key (tenant_id, fee_charge_id) references public.fee_charges(tenant_id, id) on delete restrict
);

create table public.payments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  student_person_id bigint,
  household_key text,
  payment_date date not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  amount numeric(18,4) not null check (amount > 0),
  mode text not null check (mode in ('cash','bank_transfer','cheque','upi','razorpay','credit','sponsorship','custom')),
  provider_reference text,
  state text not null default 'pending' check (state in ('pending','verified','posted','failed','reversed','refunded')),
  verification_source text,
  verified_at timestamptz,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  journal_id bigint,
  received_by_membership_id bigint,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id) references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict,
  foreign key (tenant_id, received_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint payments_online_verification_check check (
    mode <> 'razorpay' or state in ('pending','failed') or (verification_source = 'verified_webhook' and verified_at is not null)
  )
);

create table public.payment_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  payment_id bigint not null,
  provider_event_id text,
  event_type text not null,
  payload_digest text not null check (length(payload_digest) between 32 and 128),
  signature_verified boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  foreign key (tenant_id, payment_id) references public.payments(tenant_id, id) on delete restrict
);

create table public.payment_allocations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  payment_id bigint not null,
  fee_charge_id bigint not null,
  amount numeric(18,4) not null check (amount > 0),
  sequence integer not null check (sequence > 0),
  allocation_rule_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, payment_id, fee_charge_id),
  foreign key (tenant_id, payment_id) references public.payments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fee_charge_id) references public.fee_charges(tenant_id, id) on delete restrict
);

create table public.payment_receipts (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  payment_id bigint not null,
  receipt_number text not null,
  revision integer not null default 1 check (revision > 0),
  amount numeric(18,4) not null check (amount > 0),
  verification_code text not null unique,
  state text not null default 'issued' check (state in ('issued','reversed','superseded')),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, receipt_number, revision),
  foreign key (tenant_id, payment_id) references public.payments(tenant_id, id) on delete restrict
);

create table public.receipt_reversals (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  receipt_id bigint not null,
  reversal_receipt_number text not null,
  reason text not null check (length(btrim(reason)) >= 4),
  approved_by_membership_id bigint not null,
  journal_id bigint not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, receipt_id),
  unique (tenant_id, reversal_receipt_number),
  foreign key (tenant_id, receipt_id) references public.payment_receipts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict
);

create table public.payment_refunds (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  payment_id bigint not null,
  amount numeric(18,4) not null check (amount > 0),
  method text not null,
  beneficiary_snapshot jsonb not null,
  provider_reference text,
  state text not null default 'requested' check (state in ('requested','approved','processing','completed','failed','reversed')),
  reason text not null,
  journal_id bigint,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, payment_id) references public.payments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict
);

create table public.fee_write_offs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  fee_charge_id bigint not null,
  amount numeric(18,4) not null check (amount > 0),
  reason text not null check (length(btrim(reason)) >= 4),
  approved_by_membership_id bigint not null,
  journal_id bigint not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, fee_charge_id) references public.fee_charges(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict
);

create table public.bank_reconciliations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  cash_bank_account_id bigint not null,
  statement_start date not null,
  statement_end date not null,
  opening_balance numeric(18,4) not null,
  closing_balance numeric(18,4) not null,
  state text not null default 'draft' check (state in ('draft','matched','approved','locked')),
  approved_by_membership_id bigint,
  approved_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, cash_bank_account_id) references public.cash_bank_accounts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint bank_reconciliation_dates_check check (statement_end >= statement_start)
);

create table public.bank_reconciliation_items (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  reconciliation_id bigint not null,
  journal_line_id bigint,
  payment_id bigint,
  statement_reference text not null,
  statement_date date not null,
  amount numeric(18,4) not null check (amount <> 0),
  state text not null check (state in ('matched','unmatched','excluded','adjusted')),
  unique (tenant_id, reconciliation_id, statement_reference),
  foreign key (tenant_id, reconciliation_id) references public.bank_reconciliations(tenant_id, id) on delete cascade,
  foreign key (tenant_id, journal_line_id) references public.journal_lines(tenant_id, id) on delete restrict,
  foreign key (tenant_id, payment_id) references public.payments(tenant_id, id) on delete restrict
);

create or replace function private.assert_balanced_journal()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare debit_total numeric(18,4); credit_total numeric(18,4); period_state text;
begin
  if new.state in ('posted','reversed') and old.state is distinct from new.state then
    select coalesce(sum(debit),0), coalesce(sum(credit),0)
      into debit_total, credit_total
      from public.journal_lines where tenant_id = new.tenant_id and journal_id = new.id;
    select state into period_state from public.fiscal_periods
      where tenant_id = new.tenant_id and id = new.fiscal_period_id;
    if debit_total = 0 or debit_total <> credit_total then raise exception 'journal_not_balanced'; end if;
    if period_state not in ('open','reopened') then raise exception 'fiscal_period_closed'; end if;
  end if;
  return new;
end;
$$;

create or replace function private.protect_posted_journal_line()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare journal_state text;
begin
  select state into journal_state from public.journals
    where tenant_id = old.tenant_id and id = old.journal_id;
  if journal_state in ('posted','reversed') then raise exception 'posted_journal_is_immutable'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger journals_balance_before_post before update of state on public.journals
  for each row execute function private.assert_balanced_journal();

create index journals_period_idx on public.journals (tenant_id, fiscal_period_id, journal_date, state);
create index journal_lines_account_idx on public.journal_lines (tenant_id, account_id, journal_id);
create index fee_assignments_student_idx on public.fee_assignments (tenant_id, student_person_id, state);
create index fee_charges_student_due_idx on public.fee_charges (tenant_id, student_person_id, state, due_date);
create index fee_invoices_student_idx on public.fee_invoices (tenant_id, student_person_id, state, issue_date desc);
create index payments_student_idx on public.payments (tenant_id, student_person_id, payment_date desc);
create unique index payments_provider_reference_idx on public.payments (tenant_id, mode, provider_reference)
  where provider_reference is not null;
create unique index payment_events_provider_event_idx on public.payment_events (tenant_id, provider_event_id)
  where provider_event_id is not null;
create index allocations_charge_idx on public.payment_allocations (tenant_id, fee_charge_id);
create index receipts_payment_idx on public.payment_receipts (tenant_id, payment_id, issued_at desc);
create index reconciliation_items_payment_idx on public.bank_reconciliation_items (tenant_id, payment_id) where payment_id is not null;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'chart_accounts','fiscal_periods','journals','journal_lines','cash_bank_accounts',
    'fee_items','fee_structure_versions','fee_structure_items','fee_assignments','fee_concessions',
    'fee_charges','fee_adjustments','fee_invoices','fee_invoice_lines','payments','payment_events',
    'payment_allocations','payment_receipts','receipt_reversals','payment_refunds','fee_write_offs',
    'bank_reconciliations','bank_reconciliation_items'
  ] loop
    execute format('create trigger %I before update of tenant_id on public.%I for each row execute function private.enforce_immutable_tenant_id()', table_name || '_immutable_tenant', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger journal_lines_protect_posted before update or delete on public.journal_lines
  for each row execute function private.protect_posted_journal_line();
create trigger fee_adjustments_append_only before update or delete on public.fee_adjustments
  for each row execute function private.reject_append_only_mutation();
create trigger payment_allocations_append_only before update or delete on public.payment_allocations
  for each row execute function private.reject_append_only_mutation();
create trigger payment_receipts_append_only before update or delete on public.payment_receipts
  for each row execute function private.reject_append_only_mutation();
create trigger receipt_reversals_append_only before update or delete on public.receipt_reversals
  for each row execute function private.reject_append_only_mutation();
create trigger fee_write_offs_append_only before update or delete on public.fee_write_offs
  for each row execute function private.reject_append_only_mutation();

grant select on table
  public.chart_accounts, public.fiscal_periods, public.journals, public.journal_lines,
  public.cash_bank_accounts, public.fee_items, public.fee_structure_versions,
  public.fee_structure_items, public.fee_assignments, public.fee_concessions,
  public.fee_charges, public.fee_adjustments, public.fee_invoices, public.fee_invoice_lines,
  public.payments, public.payment_events, public.payment_allocations, public.payment_receipts,
  public.receipt_reversals, public.payment_refunds, public.fee_write_offs,
  public.bank_reconciliations, public.bank_reconciliation_items
to authenticated;

create policy chart_accounts_finance_read on public.chart_accounts for select to authenticated using (private.has_permission(tenant_id, 'finance.journal.prepare', null));
create policy fiscal_periods_finance_read on public.fiscal_periods for select to authenticated using (private.has_permission(tenant_id, 'finance.journal.prepare', null));
create policy journals_finance_read on public.journals for select to authenticated using (private.has_permission(tenant_id, 'finance.journal.prepare', branch_id));
create policy journal_lines_finance_read on public.journal_lines for select to authenticated using (private.has_permission(tenant_id, 'finance.journal.prepare', branch_id));
create policy cash_bank_accounts_finance_read on public.cash_bank_accounts for select to authenticated using (private.has_permission(tenant_id, 'finance.payment.collect', branch_id));
create policy fee_items_finance_read on public.fee_items for select to authenticated using (private.has_permission(tenant_id, 'finance.fees.manage', null));
create policy fee_structures_finance_read on public.fee_structure_versions for select to authenticated using (private.has_permission(tenant_id, 'finance.fees.manage', null));
create policy fee_structure_items_finance_read on public.fee_structure_items for select to authenticated using (private.has_permission(tenant_id, 'finance.fees.manage', null));
create policy fee_assignments_scoped_read on public.fee_assignments for select to authenticated using (private.has_permission(tenant_id, 'finance.fees.read', branch_id) or (student_person_id is not null and private.has_relationship(tenant_id, student_person_id::text, 'read')));
create policy fee_concessions_staff_read on public.fee_concessions for select to authenticated using (private.has_permission(tenant_id, 'finance.fees.read', null));
create policy fee_charges_scoped_read on public.fee_charges for select to authenticated using (private.has_permission(tenant_id, 'finance.fees.read', branch_id) or private.has_relationship(tenant_id, student_person_id::text, 'read'));
create policy fee_adjustments_staff_read on public.fee_adjustments for select to authenticated using (private.has_permission(tenant_id, 'finance.fees.read', null));
create policy fee_invoices_scoped_read on public.fee_invoices for select to authenticated using (private.has_permission(tenant_id, 'finance.fees.read', branch_id) or private.has_relationship(tenant_id, student_person_id::text, 'read'));
create policy fee_invoice_lines_scoped_read on public.fee_invoice_lines for select to authenticated using (exists (select 1 from public.fee_invoices invoice where invoice.tenant_id = fee_invoice_lines.tenant_id and invoice.id = fee_invoice_lines.invoice_id and (private.has_permission(invoice.tenant_id, 'finance.fees.read', invoice.branch_id) or private.has_relationship(invoice.tenant_id, invoice.student_person_id::text, 'read'))));
create policy payments_scoped_read on public.payments for select to authenticated using (private.has_permission(tenant_id, 'finance.payment.collect', branch_id) or (student_person_id is not null and private.has_relationship(tenant_id, student_person_id::text, 'read')));
create policy payment_events_staff_read on public.payment_events for select to authenticated using (private.has_permission(tenant_id, 'finance.payment.collect', null));
create policy allocations_scoped_read on public.payment_allocations for select to authenticated using (exists (select 1 from public.payments payment where payment.tenant_id = payment_allocations.tenant_id and payment.id = payment_allocations.payment_id and (private.has_permission(payment.tenant_id, 'finance.payment.collect', payment.branch_id) or (payment.student_person_id is not null and private.has_relationship(payment.tenant_id, payment.student_person_id::text, 'read')))));
create policy receipts_scoped_read on public.payment_receipts for select to authenticated using (exists (select 1 from public.payments payment where payment.tenant_id = payment_receipts.tenant_id and payment.id = payment_receipts.payment_id and (private.has_permission(payment.tenant_id, 'finance.payment.collect', payment.branch_id) or (payment.student_person_id is not null and private.has_relationship(payment.tenant_id, payment.student_person_id::text, 'read')))));
create policy receipt_reversals_staff_read on public.receipt_reversals for select to authenticated using (private.has_permission(tenant_id, 'finance.payment.reverse', null));
create policy refunds_staff_read on public.payment_refunds for select to authenticated using (private.has_permission(tenant_id, 'finance.payment.reverse', null));
create policy write_offs_staff_read on public.fee_write_offs for select to authenticated using (private.has_permission(tenant_id, 'finance.payment.reverse', null));
create policy reconciliations_finance_read on public.bank_reconciliations for select to authenticated using (private.has_permission(tenant_id, 'finance.journal.prepare', null));
create policy reconciliation_items_finance_read on public.bank_reconciliation_items for select to authenticated using (private.has_permission(tenant_id, 'finance.journal.prepare', null));
