-- Phase 11 executable database contract: HR, payroll, hostel, mess, library, and transport.

insert into public.permissions (code, description) values
  ('hr.employee.read', 'Read scoped employee records'),
  ('hr.employee.manage', 'Manage employee lifecycle'),
  ('hr.payroll.prepare', 'Prepare payroll runs'),
  ('hr.payroll.approve', 'Approve and lock payroll'),
  ('hr.payslip.read', 'Read authorized payslips'),
  ('hostel.resident.manage', 'Manage hostel residents'),
  ('hostel.security.manage', 'Manage visitors and incidents'),
  ('mess.service.manage', 'Manage meal service'),
  ('library.loan.manage', 'Manage library circulation'),
  ('transport.route.manage', 'Manage transport routes and assignments')
on conflict (code) do nothing;

create table public.hr_employments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  employee_person_id bigint not null,
  branch_id bigint not null,
  employee_number text not null,
  department_key text,
  designation_key text not null,
  contract_type text not null check (contract_type in ('permanent','fixed_term','part_time','casual','volunteer','consultant')),
  manager_person_id bigint,
  starts_on date not null,
  ends_on date,
  payroll_eligible boolean not null default true,
  state text not null default 'active' check (state in ('candidate','imported','active','on_leave','suspended','separated','archived')),
  separation_reason text,
  access_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, employee_number),
  foreign key (tenant_id, employee_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, manager_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict,
  constraint hr_employment_dates_check check (ends_on is null or ends_on >= starts_on),
  constraint hr_separation_check check (state <> 'separated' or (ends_on is not null and length(btrim(separation_reason)) >= 4))
);

create table public.hr_attendance_records (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  employment_id bigint not null,
  attendance_date date not null,
  status text not null check (status in ('present','absent','late','leave','holiday','weekend','unmarked')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  source text not null check (source in ('manual','device','import','leave','system')),
  source_reference text,
  approved_by_membership_id bigint,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, employment_id, attendance_date),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, employment_id) references public.hr_employments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint hr_attendance_times_check check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at)
);

create table public.hr_attendance_corrections (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  attendance_record_id bigint not null,
  corrected_status text not null,
  corrected_times jsonb not null default '{}'::jsonb,
  reason text not null check (length(btrim(reason)) >= 4),
  approved_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, attendance_record_id) references public.hr_attendance_records(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create table public.hr_leave_types (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null,
  labels jsonb not null,
  eligibility_rules jsonb not null default '{}'::jsonb,
  accrual_rules jsonb not null default '{}'::jsonb,
  carry_forward_rules jsonb not null default '{}'::jsonb,
  payroll_effect text not null default 'paid' check (payroll_effect in ('paid','unpaid','configured')),
  approval_rules jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  state text not null default 'active' check (state in ('active','inactive','archived')),
  unique (tenant_id, id),
  unique (tenant_id, key, version)
);

create table public.hr_leave_requests (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  employment_id bigint not null,
  leave_type_id bigint not null,
  starts_on date not null,
  ends_on date not null,
  requested_units numeric(8,2) not null check (requested_units > 0),
  reason text,
  state text not null default 'draft' check (state in ('draft','submitted','approved','rejected','cancelled','taken')),
  decided_by_membership_id bigint,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, employment_id) references public.hr_employments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, leave_type_id) references public.hr_leave_types(tenant_id, id) on delete restrict,
  foreign key (tenant_id, decided_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint hr_leave_dates_check check (ends_on >= starts_on),
  constraint hr_leave_decision_check check (state not in ('approved','rejected') or (decided_by_membership_id is not null and decided_at is not null))
);

create table public.salary_structure_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null,
  version integer not null check (version > 0),
  labels jsonb not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  effective_from date not null,
  effective_to date,
  state text not null default 'draft' check (state in ('draft','published','superseded','archived')),
  published_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, key, version),
  constraint salary_structure_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint salary_structure_publish_check check (state <> 'published' or published_at is not null)
);

create table public.salary_components (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  salary_structure_version_id bigint not null,
  key text not null,
  labels jsonb not null,
  component_type text not null check (component_type in ('earning','deduction','employer_cost','advance_recovery')),
  calculation_type text not null check (calculation_type in ('fixed','percentage','formula','input')),
  calculation_rules jsonb not null,
  account_id bigint not null,
  sequence integer not null default 0 check (sequence >= 0),
  unique (tenant_id, id),
  unique (tenant_id, salary_structure_version_id, key),
  foreign key (tenant_id, salary_structure_version_id) references public.salary_structure_versions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, account_id) references public.chart_accounts(tenant_id, id) on delete restrict
);

create table public.employee_salary_assignments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  employment_id bigint not null,
  salary_structure_version_id bigint not null,
  effective_from date not null,
  effective_to date,
  overrides jsonb not null default '{}'::jsonb,
  override_reason text,
  approved_by_membership_id bigint not null,
  unique (tenant_id, id),
  foreign key (tenant_id, employment_id) references public.hr_employments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, salary_structure_version_id) references public.salary_structure_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint employee_salary_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint employee_salary_override_reason_check check (overrides = '{}'::jsonb or length(btrim(override_reason)) >= 4)
);

create table public.payroll_runs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  fiscal_period_id bigint not null,
  pay_group_key text not null,
  run_number integer not null check (run_number > 0),
  state text not null default 'draft' check (state in ('draft','calculated','reviewed','approved','locked','posted','paid','reversed')),
  input_digest text not null check (length(input_digest) between 32 and 128),
  journal_id bigint,
  approved_by_membership_id bigint,
  approved_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, fiscal_period_id, pay_group_key, run_number),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fiscal_period_id) references public.fiscal_periods(tenant_id, id) on delete restrict,
  foreign key (tenant_id, journal_id) references public.journals(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint payroll_approval_check check (state not in ('approved','locked','posted','paid') or (approved_by_membership_id is not null and approved_at is not null)),
  constraint payroll_lock_check check (state not in ('locked','posted','paid') or locked_at is not null)
);

create table public.payroll_entries (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  payroll_run_id bigint not null,
  employment_id bigint not null,
  salary_assignment_id bigint not null,
  input_snapshot jsonb not null,
  gross_amount numeric(18,4) not null,
  deduction_amount numeric(18,4) not null,
  net_amount numeric(18,4) not null,
  variance_percent numeric(9,4),
  state text not null default 'calculated' check (state in ('calculated','reviewed','approved','withheld','paid','reversed')),
  unique (tenant_id, id),
  unique (tenant_id, payroll_run_id, employment_id),
  foreign key (tenant_id, payroll_run_id) references public.payroll_runs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, employment_id) references public.hr_employments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, salary_assignment_id) references public.employee_salary_assignments(tenant_id, id) on delete restrict,
  constraint payroll_entry_math_check check (net_amount = gross_amount - deduction_amount)
);

create table public.payroll_component_results (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  payroll_entry_id bigint not null,
  salary_component_id bigint not null,
  amount numeric(18,4) not null,
  input_values jsonb not null,
  calculation_trace jsonb not null,
  unique (tenant_id, payroll_entry_id, salary_component_id),
  foreign key (tenant_id, payroll_entry_id) references public.payroll_entries(tenant_id, id) on delete cascade,
  foreign key (tenant_id, salary_component_id) references public.salary_components(tenant_id, id) on delete restrict
);

create table public.payroll_anomalies (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  payroll_run_id bigint not null,
  payroll_entry_id bigint,
  anomaly_key text not null,
  severity text not null check (severity in ('warning','blocking','critical')),
  details jsonb not null,
  state text not null default 'open' check (state in ('open','resolved','waived')),
  resolution_reason text,
  resolved_by_membership_id bigint,
  resolved_at timestamptz,
  foreign key (tenant_id, payroll_run_id) references public.payroll_runs(tenant_id, id) on delete cascade,
  foreign key (tenant_id, payroll_entry_id) references public.payroll_entries(tenant_id, id) on delete cascade,
  foreign key (tenant_id, resolved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint payroll_anomaly_resolution_check check (state = 'open' or (length(btrim(resolution_reason)) >= 4 and resolved_by_membership_id is not null and resolved_at is not null))
);

create table public.payslips (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  payroll_entry_id bigint not null,
  employee_person_id bigint not null,
  document_id bigint,
  revision integer not null default 1 check (revision > 0),
  content_digest text not null check (length(content_digest) between 32 and 128),
  state text not null default 'issued' check (state in ('issued','superseded','revoked')),
  issued_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, payroll_entry_id, revision),
  foreign key (tenant_id, payroll_entry_id) references public.payroll_entries(tenant_id, id) on delete restrict,
  foreign key (tenant_id, employee_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, document_id) references public.documents(tenant_id, id) on delete restrict
);

create table public.hostels (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  key text not null,
  labels jsonb not null,
  warden_person_id bigint,
  rules jsonb not null default '{}'::jsonb,
  state text not null default 'active' check (state in ('active','inactive','archived')),
  unique (tenant_id, id), unique (tenant_id, branch_id, key),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, warden_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict
);

create table public.hostel_beds (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  hostel_id bigint not null,
  building_key text not null, floor_key text, room_key text not null, bed_key text not null,
  category text, fee_item_id bigint,
  state text not null default 'available' check (state in ('available','occupied','reserved','maintenance','inactive')),
  unique (tenant_id, id), unique (tenant_id, hostel_id, building_key, room_key, bed_key),
  foreign key (tenant_id, hostel_id) references public.hostels(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fee_item_id) references public.fee_items(tenant_id, id) on delete restrict
);

create table public.hostel_allocations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  bed_id bigint not null, student_person_id bigint not null, enrollment_id bigint not null,
  starts_on date not null, ends_on date,
  state text not null default 'allocated' check (state in ('eligible','allocated','occupied','temporary_leave','transferred','vacated','cancelled')),
  eligibility_snapshot jsonb not null, vacate_clearance jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, bed_id) references public.hostel_beds(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id) references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete restrict,
  constraint hostel_allocation_dates_check check (ends_on is null or ends_on >= starts_on)
);
create unique index hostel_bed_active_idx on public.hostel_allocations (tenant_id, bed_id) where state in ('allocated','occupied','temporary_leave');
create unique index hostel_student_active_idx on public.hostel_allocations (tenant_id, student_person_id) where state in ('allocated','occupied','temporary_leave');

create table public.hostel_allocation_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  allocation_id bigint not null, event_type text not null,
  from_state jsonb, to_state jsonb not null, reason text, occurred_at timestamptz not null default now(),
  foreign key (tenant_id, allocation_id) references public.hostel_allocations(tenant_id, id) on delete restrict
);

create table public.hostel_leaves (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  allocation_id bigint not null, destination text not null, guardian_contact_snapshot jsonb not null,
  departs_at timestamptz not null, expected_return_at timestamptz not null, actual_return_at timestamptz,
  state text not null default 'requested' check (state in ('requested','approved','departed','returned','overdue','rejected','cancelled')),
  approved_by_membership_id bigint,
  unique (tenant_id, id),
  foreign key (tenant_id, allocation_id) references public.hostel_allocations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint hostel_leave_times_check check (expected_return_at > departs_at)
);

create table public.hostel_visitors (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  allocation_id bigint not null, visitor_identity_snapshot jsonb not null, purpose text not null,
  restriction_flags jsonb not null default '{}'::jsonb, checked_in_at timestamptz not null, checked_out_at timestamptz,
  host_approved_by_membership_id bigint,
  foreign key (tenant_id, allocation_id) references public.hostel_allocations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, host_approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create table public.hostel_incidents (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  allocation_id bigint, category text not null, severity text not null check (severity in ('low','medium','high','critical')),
  restricted_details jsonb not null, action_summary jsonb not null default '{}'::jsonb,
  state text not null default 'open' check (state in ('open','investigating','resolved','closed')),
  occurred_at timestamptz not null,
  foreign key (tenant_id, allocation_id) references public.hostel_allocations(tenant_id, id) on delete restrict
);

create table public.mess_units (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null, key text not null, labels jsonb not null, cost_account_id bigint,
  state text not null default 'active' check (state in ('active','inactive','archived')),
  unique (tenant_id, id), unique (tenant_id, branch_id, key),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, cost_account_id) references public.chart_accounts(tenant_id, id) on delete restrict
);

create table public.mess_meal_services (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  mess_unit_id bigint not null, meal_type text not null, serving_date date not null,
  eligibility_rules jsonb not null default '{}'::jsonb, expected_count integer check (expected_count is null or expected_count >= 0),
  state text not null default 'planned' check (state in ('planned','open','closed','cancelled')),
  unique (tenant_id, id), unique (tenant_id, mess_unit_id, meal_type, serving_date),
  foreign key (tenant_id, mess_unit_id) references public.mess_units(tenant_id, id) on delete restrict
);

create table public.mess_attendance (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  meal_service_id bigint not null, person_id bigint, guest_key text,
  served_count integer not null default 1 check (served_count > 0), subsidy_fund_id bigint,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, meal_service_id) references public.mess_meal_services(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references public.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, subsidy_fund_id) references public.funds(tenant_id, id) on delete restrict,
  constraint mess_attendance_target_check check (num_nonnulls(person_id, guest_key) = 1)
);

create table public.library_titles (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  labels jsonb not null, authors jsonb not null default '[]'::jsonb, publisher text, category text,
  edition text, isbn text, classification text, state text not null default 'active' check (state in ('active','inactive','archived')),
  unique (tenant_id, id)
);

create table public.library_copies (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null, title_id bigint not null, accession_number text not null,
  condition text not null check (condition in ('new','good','fair','damaged','lost')),
  state text not null default 'available' check (state in ('available','issued','overdue','lost','damaged','withdrawn','repair')),
  unique (tenant_id, id), unique (tenant_id, accession_number),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, title_id) references public.library_titles(tenant_id, id) on delete restrict
);

create table public.library_loans (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  copy_id bigint not null, borrower_person_id bigint not null, issued_at timestamptz not null,
  due_at timestamptz not null, returned_at timestamptz, state text not null default 'issued' check (state in ('issued','returned','overdue','lost','damaged','cancelled')),
  fine_amount numeric(18,4) not null default 0 check (fine_amount >= 0), fine_waiver_reason text, fee_charge_id bigint,
  unique (tenant_id, id),
  foreign key (tenant_id, copy_id) references public.library_copies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, borrower_person_id) references public.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fee_charge_id) references public.fee_charges(tenant_id, id) on delete restrict,
  constraint library_loan_dates_check check (due_at > issued_at and (returned_at is null or returned_at >= issued_at))
);
create unique index library_copy_active_loan_idx on public.library_loans (tenant_id, copy_id) where state in ('issued','overdue');

create table public.transport_vehicles (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null, registration_number text not null, ownership text not null,
  capacity integer not null check (capacity > 0), driver_person_id bigint, helper_person_id bigint,
  state text not null default 'active' check (state in ('active','maintenance','inactive','archived')),
  unique (tenant_id, id), unique (tenant_id, registration_number),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, driver_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, helper_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict
);

create table public.transport_routes (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null, vehicle_id bigint not null, key text not null, labels jsonb not null,
  effective_from date not null, effective_to date, state text not null default 'active' check (state in ('active','inactive','archived')),
  unique (tenant_id, id), unique (tenant_id, branch_id, key, effective_from),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, vehicle_id) references public.transport_vehicles(tenant_id, id) on delete restrict
);

create table public.transport_stops (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  route_id bigint not null, key text not null, labels jsonb not null, sequence integer not null check (sequence >= 0),
  pickup_time time, drop_time time, fee_item_id bigint,
  unique (tenant_id, id), unique (tenant_id, route_id, key),
  foreign key (tenant_id, route_id) references public.transport_routes(tenant_id, id) on delete cascade,
  foreign key (tenant_id, fee_item_id) references public.fee_items(tenant_id, id) on delete restrict
);

create table public.transport_assignments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  enrollment_id bigint not null, student_person_id bigint not null, route_id bigint not null, stop_id bigint not null,
  starts_on date not null, ends_on date, state text not null default 'active' check (state in ('planned','active','paused','ended','cancelled')),
  fee_assignment_id bigint, approved_by_membership_id bigint not null,
  unique (tenant_id, id),
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id) references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, route_id) references public.transport_routes(tenant_id, id) on delete restrict,
  foreign key (tenant_id, stop_id) references public.transport_stops(tenant_id, id) on delete restrict,
  foreign key (tenant_id, fee_assignment_id) references public.fee_assignments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint transport_assignment_dates_check check (ends_on is null or ends_on >= starts_on)
);
create unique index transport_student_active_idx on public.transport_assignments (tenant_id, student_person_id) where state = 'active';

create table public.operational_document_alerts (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  entity_type text not null check (entity_type in ('vehicle','driver','helper','hostel','library')),
  entity_id text not null, document_type text not null, expires_on date not null,
  state text not null default 'pending' check (state in ('pending','sent','acknowledged','resolved','expired')),
  unique (tenant_id, entity_type, entity_id, document_type, expires_on)
);

create index payroll_entries_run_idx on public.payroll_entries (tenant_id, payroll_run_id, state);
create index hostel_allocations_student_idx on public.hostel_allocations (tenant_id, student_person_id, state);
create index hostel_incidents_severity_idx on public.hostel_incidents (tenant_id, severity, state);
create index library_loans_borrower_idx on public.library_loans (tenant_id, borrower_person_id, state);
create index transport_assignments_route_idx on public.transport_assignments (tenant_id, route_id, state);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'hr_employments','hr_attendance_records','hr_attendance_corrections','hr_leave_types','hr_leave_requests',
    'salary_structure_versions','salary_components','employee_salary_assignments','payroll_runs','payroll_entries',
    'payroll_component_results','payroll_anomalies','payslips','hostels','hostel_beds','hostel_allocations',
    'hostel_allocation_events','hostel_leaves','hostel_visitors','hostel_incidents','mess_units',
    'mess_meal_services','mess_attendance','library_titles','library_copies','library_loans',
    'transport_vehicles','transport_routes','transport_stops','transport_assignments','operational_document_alerts'
  ] loop
    execute format('create trigger %I before update of tenant_id on public.%I for each row execute function private.enforce_immutable_tenant_id()', table_name || '_immutable_tenant', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger hr_attendance_corrections_append_only before update or delete on public.hr_attendance_corrections for each row execute function private.reject_append_only_mutation();
create trigger payroll_components_append_only before update or delete on public.payroll_component_results for each row execute function private.reject_append_only_mutation();
create trigger hostel_allocation_events_append_only before update or delete on public.hostel_allocation_events for each row execute function private.reject_append_only_mutation();
create trigger mess_attendance_append_only before update or delete on public.mess_attendance for each row execute function private.reject_append_only_mutation();

grant select on table
  public.hr_employments, public.hr_attendance_records, public.hr_attendance_corrections,
  public.hr_leave_types, public.hr_leave_requests, public.salary_structure_versions,
  public.salary_components, public.employee_salary_assignments, public.payroll_runs,
  public.payroll_entries, public.payroll_component_results, public.payroll_anomalies, public.payslips,
  public.hostels, public.hostel_beds, public.hostel_allocations, public.hostel_allocation_events,
  public.hostel_leaves, public.hostel_visitors, public.hostel_incidents, public.mess_units,
  public.mess_meal_services, public.mess_attendance, public.library_titles, public.library_copies,
  public.library_loans, public.transport_vehicles, public.transport_routes, public.transport_stops,
  public.transport_assignments, public.operational_document_alerts
to authenticated;

create policy hr_employments_staff_read on public.hr_employments for select to authenticated using (private.has_permission(tenant_id, 'hr.employee.read', branch_id) or private.has_relationship(tenant_id, employee_person_id::text, 'read'));
create policy hr_attendance_staff_read on public.hr_attendance_records for select to authenticated using (private.has_permission(tenant_id, 'hr.employee.read', null) or exists (select 1 from public.hr_employments employment where employment.tenant_id = hr_attendance_records.tenant_id and employment.id = hr_attendance_records.employment_id and private.has_relationship(employment.tenant_id, employment.employee_person_id::text, 'read')));
create policy hr_attendance_corrections_staff_read on public.hr_attendance_corrections for select to authenticated using (private.has_permission(tenant_id, 'hr.employee.read', null));
create policy hr_leave_types_staff_read on public.hr_leave_types for select to authenticated using (private.has_tenant_membership(tenant_id));
create policy hr_leave_requests_staff_read on public.hr_leave_requests for select to authenticated using (private.has_permission(tenant_id, 'hr.employee.read', null));
create policy salary_structures_hr_read on public.salary_structure_versions for select to authenticated using (private.has_permission(tenant_id, 'hr.payroll.prepare', null));
create policy salary_components_hr_read on public.salary_components for select to authenticated using (private.has_permission(tenant_id, 'hr.payroll.prepare', null));
create policy salary_assignments_hr_read on public.employee_salary_assignments for select to authenticated using (private.has_permission(tenant_id, 'hr.payroll.prepare', null));
create policy payroll_runs_hr_read on public.payroll_runs for select to authenticated using (private.has_permission(tenant_id, 'hr.payroll.prepare', branch_id));
create policy payroll_entries_hr_read on public.payroll_entries for select to authenticated using (private.has_permission(tenant_id, 'hr.payroll.prepare', null));
create policy payroll_components_hr_read on public.payroll_component_results for select to authenticated using (private.has_permission(tenant_id, 'hr.payroll.prepare', null));
create policy payroll_anomalies_hr_read on public.payroll_anomalies for select to authenticated using (private.has_permission(tenant_id, 'hr.payroll.prepare', null));
create policy payslips_scoped_read on public.payslips for select to authenticated using (private.has_permission(tenant_id, 'hr.payslip.read', null) or private.has_relationship(tenant_id, employee_person_id::text, 'read'));
create policy hostels_ops_read on public.hostels for select to authenticated using (private.has_permission(tenant_id, 'hostel.resident.manage', branch_id));
create policy hostel_beds_ops_read on public.hostel_beds for select to authenticated using (private.has_permission(tenant_id, 'hostel.resident.manage', null));
create policy hostel_allocations_ops_read on public.hostel_allocations for select to authenticated using (private.has_permission(tenant_id, 'hostel.resident.manage', null));
create policy hostel_events_ops_read on public.hostel_allocation_events for select to authenticated using (private.has_permission(tenant_id, 'hostel.resident.manage', null));
create policy hostel_leaves_ops_read on public.hostel_leaves for select to authenticated using (private.has_permission(tenant_id, 'hostel.resident.manage', null));
create policy hostel_visitors_security_read on public.hostel_visitors for select to authenticated using (private.has_permission(tenant_id, 'hostel.security.manage', null));
create policy hostel_incidents_security_read on public.hostel_incidents for select to authenticated using (private.has_permission(tenant_id, 'hostel.security.manage', null));
create policy mess_units_ops_read on public.mess_units for select to authenticated using (private.has_permission(tenant_id, 'mess.service.manage', branch_id));
create policy mess_services_ops_read on public.mess_meal_services for select to authenticated using (private.has_permission(tenant_id, 'mess.service.manage', null));
create policy mess_attendance_ops_read on public.mess_attendance for select to authenticated using (private.has_permission(tenant_id, 'mess.service.manage', null));
create policy library_titles_member_read on public.library_titles for select to authenticated using (private.has_tenant_membership(tenant_id));
create policy library_copies_member_read on public.library_copies for select to authenticated using (private.has_tenant_membership(tenant_id));
create policy library_loans_ops_read on public.library_loans for select to authenticated using (private.has_permission(tenant_id, 'library.loan.manage', null));
create policy transport_vehicles_ops_read on public.transport_vehicles for select to authenticated using (private.has_permission(tenant_id, 'transport.route.manage', branch_id));
create policy transport_routes_ops_read on public.transport_routes for select to authenticated using (private.has_permission(tenant_id, 'transport.route.manage', branch_id));
create policy transport_stops_ops_read on public.transport_stops for select to authenticated using (private.has_permission(tenant_id, 'transport.route.manage', null));
create policy transport_assignments_ops_read on public.transport_assignments for select to authenticated using (private.has_permission(tenant_id, 'transport.route.manage', null));
create policy operational_alerts_ops_read on public.operational_document_alerts for select to authenticated using (private.has_permission(tenant_id, 'transport.route.manage', null));
