-- Phase 3 executable configuration-engine contract.
-- Apply after phase2_tenancy.sql. All browser access remains read-only;
-- privileged mutations must pass through audited server-side commands.

insert into public.permissions (code, description) values
  ('settings.configuration.read', 'Read tenant configuration'),
  ('settings.configuration.manage', 'Create and validate tenant configuration drafts'),
  ('settings.configuration.publish', 'Publish versioned tenant configuration')
on conflict (code) do nothing;

create table public.config_definitions (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$'),
  data_type text not null check (data_type in (
    'boolean', 'integer', 'decimal', 'text', 'date', 'time', 'duration',
    'locale', 'timezone', 'currency', 'enum', 'json'
  )),
  allowed_scopes text[] not null check (
    cardinality(allowed_scopes) > 0
    and allowed_scopes <@ array['tenant', 'branch', 'program', 'session']::text[]
  ),
  default_value jsonb,
  validation jsonb not null default '{}'::jsonb,
  change_risk text not null check (change_risk in ('low', 'medium', 'high', 'restricted')),
  historical_strategy text not null check (historical_strategy in ('current', 'retain', 'versioned')),
  description text not null check (length(btrim(description)) between 8 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.config_values (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  definition_key text not null references public.config_definitions(key) on delete restrict,
  scope_type text not null check (scope_type in ('tenant', 'branch', 'program', 'session')),
  scope_key text not null check (length(btrim(scope_key)) between 1 and 160),
  version integer not null check (version > 0),
  value jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  reason text check (reason is null or length(btrim(reason)) between 8 and 500),
  effective_at timestamptz,
  published_at timestamptz,
  created_by_membership_id bigint not null,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, created_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint config_values_publish_check check (
    status <> 'published'
    or (effective_at is not null and published_at is not null and published_by_membership_id is not null)
  ),
  unique (tenant_id, definition_key, scope_type, scope_key, version),
  unique (tenant_id, id)
);

create table public.terminology_sets (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  scope_type text not null default 'tenant' check (scope_type in ('tenant', 'branch', 'program')),
  scope_key text not null check (length(btrim(scope_key)) between 1 and 160),
  change_reason text check (change_reason is null or length(btrim(change_reason)) between 8 and 500),
  effective_at timestamptz,
  published_at timestamptz,
  created_by_membership_id bigint not null,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, created_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint terminology_sets_publish_check check (
    status <> 'published'
    or (effective_at is not null and published_at is not null and published_by_membership_id is not null)
  ),
  unique (tenant_id, key, scope_type, scope_key, version),
  unique (tenant_id, id)
);

create table public.terminology_entries (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  terminology_set_id bigint not null,
  concept_key text not null check (concept_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  locale text not null check (locale in ('en', 'ur', 'ar')),
  singular_label text not null check (length(btrim(singular_label)) between 1 and 120),
  plural_label text not null check (length(btrim(plural_label)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, terminology_set_id)
    references public.terminology_sets(tenant_id, id) on delete cascade,
  unique (tenant_id, terminology_set_id, concept_key, locale)
);

create table public.custom_field_definitions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  entity_type text not null check (entity_type in (
    'student', 'guardian', 'employee', 'admission_application', 'enrollment',
    'donor', 'donation', 'sponsorship', 'hostel_resident', 'hostel_allocation'
  )),
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  version integer not null check (version > 0),
  field_type text not null check (field_type in (
    'short_text', 'long_text', 'number', 'currency', 'date', 'date_time',
    'dropdown', 'multi_select', 'boolean', 'phone', 'email', 'url',
    'file', 'entity_reference', 'calculated_display'
  )),
  labels jsonb not null,
  help_text jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  visibility_rule jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  placement jsonb not null default '{}'::jsonb,
  sensitive_classification text not null default 'internal'
    check (sensitive_classification in ('public', 'internal', 'confidential', 'restricted')),
  required boolean not null default false,
  filterable boolean not null default false,
  exportable boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  effective_at timestamptz,
  published_at timestamptz,
  created_by_membership_id bigint not null,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, created_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint custom_field_publish_check check (
    status <> 'published'
    or (effective_at is not null and published_at is not null and published_by_membership_id is not null)
  ),
  unique (tenant_id, entity_type, key, version),
  unique (tenant_id, id)
);

create table public.custom_field_values (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  field_definition_id bigint not null,
  subject_type text not null check (length(btrim(subject_type)) between 2 and 80),
  subject_key text not null check (length(btrim(subject_key)) between 1 and 160),
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, field_definition_id)
    references public.custom_field_definitions(tenant_id, id) on delete restrict,
  unique (tenant_id, field_definition_id, subject_type, subject_key)
);

create table public.form_definitions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  entity_type text not null check (length(btrim(entity_type)) between 2 and 80),
  audience text not null check (audience in ('internal', 'authenticated', 'public')),
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id)
);

create table public.form_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  form_definition_id bigint not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  labels jsonb not null,
  sections jsonb not null,
  submission_rules jsonb not null default '{}'::jsonb,
  validation_result jsonb not null default '{}'::jsonb,
  effective_at timestamptz,
  published_at timestamptz,
  created_by_membership_id bigint not null,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, form_definition_id)
    references public.form_definitions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint form_versions_publish_check check (
    status <> 'published'
    or (effective_at is not null and published_at is not null and published_by_membership_id is not null)
  ),
  unique (tenant_id, form_definition_id, version),
  unique (tenant_id, id)
);

create table public.status_definitions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  family text not null check (family in (
    'attendance', 'application', 'incident', 'task', 'student', 'employee',
    'hostel_resident', 'salah_attendance'
  )),
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  labels jsonb not null,
  category text not null check (length(btrim(category)) between 2 and 80),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  icon text,
  display_order integer not null default 0,
  terminal boolean not null default false,
  core_semantic boolean not null default false,
  reporting_behavior jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, family, key),
  unique (tenant_id, id)
);

create table public.status_transitions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  family text not null,
  from_status_id bigint not null,
  to_status_id bigint not null,
  permission_code text not null references public.permissions(code) on delete restrict,
  required_reason boolean not null default false,
  approval_rule jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  side_effects jsonb not null default '[]'::jsonb,
  notifications jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, from_status_id)
    references public.status_definitions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, to_status_id)
    references public.status_definitions(tenant_id, id) on delete restrict,
  constraint status_transitions_distinct_check check (from_status_id <> to_status_id),
  unique (tenant_id, family, from_status_id, to_status_id)
);

create table public.workflow_definitions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  workflow_type text not null check (workflow_type in (
    'admission', 'leave', 'document_verification', 'fee_concession',
    'financial_reversal', 'result_publication', 'certificate_request',
    'customization_request'
  )),
  labels jsonb not null,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id)
);

create table public.workflow_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  workflow_definition_id bigint not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  nodes jsonb not null,
  transitions jsonb not null,
  validation_result jsonb not null default '{}'::jsonb,
  impact_summary jsonb not null default '{}'::jsonb,
  effective_at timestamptz,
  published_at timestamptz,
  created_by_membership_id bigint not null,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, workflow_definition_id)
    references public.workflow_definitions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint workflow_versions_publish_check check (
    status <> 'published'
    or (effective_at is not null and published_at is not null and published_by_membership_id is not null)
  ),
  unique (tenant_id, workflow_definition_id, version),
  unique (tenant_id, id)
);

create table public.workflow_instances (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  workflow_version_id bigint not null,
  subject_type text not null check (length(btrim(subject_type)) between 2 and 80),
  subject_key text not null check (length(btrim(subject_key)) between 1 and 160),
  current_node_key text not null check (length(btrim(current_node_key)) between 1 and 80),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'failed')),
  context jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, workflow_version_id)
    references public.workflow_versions(tenant_id, id) on delete restrict,
  constraint workflow_instances_completion_check check (
    status not in ('completed', 'cancelled') or completed_at is not null
  ),
  unique (tenant_id, id)
);

create table public.workflow_tasks (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  workflow_instance_id bigint not null,
  node_key text not null check (length(btrim(node_key)) between 1 and 80),
  task_type text not null check (task_type in (
    'human_task', 'approval', 'data_requirement', 'decision', 'timer',
    'status_transition', 'notification', 'internal_action'
  )),
  assignee_membership_id bigint,
  state text not null default 'pending' check (state in ('pending', 'active', 'completed', 'cancelled', 'expired')),
  due_at timestamptz,
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, workflow_instance_id)
    references public.workflow_instances(tenant_id, id) on delete cascade,
  foreign key (tenant_id, assignee_membership_id)
    references public.memberships(tenant_id, id) on delete restrict
);

create table public.grade_scales (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  labels jsonb not null,
  calculation_type text not null check (calculation_type in ('marks', 'percentage', 'letter', 'pass_fail', 'gpa')),
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id)
);

create table public.grade_scale_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  grade_scale_id bigint not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  bands jsonb not null,
  rules jsonb not null default '{}'::jsonb,
  rounding_mode text not null default 'half_up' check (rounding_mode in ('half_up', 'half_even', 'floor', 'ceil', 'none')),
  effective_at timestamptz,
  published_at timestamptz,
  created_by_membership_id bigint not null,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, grade_scale_id)
    references public.grade_scales(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint grade_scale_versions_publish_check check (
    status <> 'published'
    or (effective_at is not null and published_at is not null and published_by_membership_id is not null)
  ),
  unique (tenant_id, grade_scale_id, version),
  unique (tenant_id, id)
);

create table public.attendance_status_sets (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  subject_type text not null check (subject_type in ('student', 'employee', 'hostel_resident', 'salah')),
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  statuses jsonb not null,
  rules jsonb not null default '{}'::jsonb,
  effective_at timestamptz,
  published_at timestamptz,
  created_by_membership_id bigint not null,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, created_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint attendance_status_sets_publish_check check (
    status <> 'published'
    or (effective_at is not null and published_at is not null and published_by_membership_id is not null)
  ),
  unique (tenant_id, key, subject_type, version),
  unique (tenant_id, id)
);

create table public.template_definitions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  document_type text not null check (document_type in (
    'certificate', 'report', 'identity_card', 'receipt', 'invoice', 'voucher', 'payslip'
  )),
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id)
);

create table public.template_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  template_definition_id bigint not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  locale text not null check (locale in ('en', 'ur', 'ar')),
  direction text not null check (direction in ('ltr', 'rtl')),
  page_size text not null check (page_size in ('a4', 'a5', 'letter', 'card')),
  allowed_variables text[] not null default array[]::text[],
  layout jsonb not null,
  issuer_rules jsonb not null default '{}'::jsonb,
  approval_rules jsonb not null default '{}'::jsonb,
  numbering_sequence_key text,
  validation_result jsonb not null default '{}'::jsonb,
  effective_at timestamptz,
  published_at timestamptz,
  created_by_membership_id bigint not null,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, template_definition_id)
    references public.template_definitions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint template_versions_publish_check check (
    status <> 'published'
    or (effective_at is not null and published_at is not null and published_by_membership_id is not null)
  ),
  unique (tenant_id, template_definition_id, locale, version),
  unique (tenant_id, id)
);

create table public.number_sequences (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  entity_type text not null check (entity_type in (
    'admission', 'student', 'employee', 'receipt', 'invoice', 'voucher',
    'donation', 'sponsorship', 'certificate'
  )),
  pattern text not null check (length(btrim(pattern)) between 3 and 160),
  next_value bigint not null default 1 check (next_value > 0),
  padding smallint not null default 5 check (padding between 1 and 12),
  reset_period text not null default 'never' check (reset_period in ('never', 'yearly', 'session')),
  reserved_values bigint[] not null default array[]::bigint[],
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  effective_at timestamptz,
  published_at timestamptz,
  created_by_membership_id bigint not null,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint number_sequences_publish_check check (
    status <> 'published'
    or (effective_at is not null and published_at is not null and published_by_membership_id is not null)
  ),
  unique nulls not distinct (tenant_id, branch_id, key),
  unique (tenant_id, id)
);

create table public.configuration_presets (
  key text primary key check (key in (
    'maktab', 'hifz_academy', 'dars_e_nizami', 'islamic_school', 'urdu_medium_school'
  )),
  version integer not null check (version > 0),
  labels jsonb not null,
  configuration jsonb not null,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_setup_progress (
  tenant_id bigint primary key references public.tenants(id) on delete restrict,
  preset_key text references public.configuration_presets(key) on delete restrict,
  preset_version integer,
  current_step text not null default 'institution' check (current_step in (
    'institution', 'branches', 'languages', 'calendar', 'academics',
    'terminology', 'grading', 'attendance', 'fees', 'roles',
    'notifications', 'review', 'complete'
  )),
  completed_steps text[] not null default array[]::text[],
  readiness jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  updated_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, updated_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint tenant_setup_preset_version_check check (
    (preset_key is null and preset_version is null)
    or (preset_key is not null and preset_version is not null and preset_version > 0)
  )
);

insert into public.config_definitions (
  key, data_type, allowed_scopes, default_value, validation,
  change_risk, historical_strategy, description
) values
  (
    'institution.timezone', 'timezone', array['tenant'], '"Asia/Kolkata"'::jsonb,
    '{}'::jsonb, 'medium', 'retain', 'Timezone used for institutional dates and operational boundaries'
  ),
  (
    'institution.primary_locale', 'locale', array['tenant', 'branch'], '"ur"'::jsonb,
    '{"allowed":["en","ur","ar"]}'::jsonb, 'low', 'retain', 'Primary display locale for an institution or approved branch override'
  ),
  (
    'institution.week_start', 'enum', array['tenant'], '"monday"'::jsonb,
    '{"allowed":["monday","saturday","sunday"]}'::jsonb, 'medium', 'versioned', 'First weekday used by calendars, attendance, and scheduled reporting'
  ),
  (
    'academics.calendar_mode', 'enum', array['tenant', 'program'], '"gregorian_hijri_display"'::jsonb,
    '{"allowed":["gregorian","gregorian_hijri_display"]}'::jsonb, 'high', 'versioned', 'Approved civil and Hijri calendar presentation mode'
  ),
  (
    'attendance.correction_window_days', 'integer', array['tenant', 'branch', 'program'], '3'::jsonb,
    '{"minimum":0,"maximum":30}'::jsonb, 'high', 'versioned', 'Number of days during which authorized attendance corrections are allowed'
  ),
  (
    'attendance.default_status', 'text', array['tenant', 'program'], '"present"'::jsonb,
    '{"stable_key":true}'::jsonb, 'high', 'versioned', 'Stable attendance status applied by approved bulk-entry defaults'
  ),
  (
    'documents.default_locale', 'locale', array['tenant', 'branch'], '"ur"'::jsonb,
    '{"allowed":["en","ur","ar"]}'::jsonb, 'medium', 'versioned', 'Default document locale for approved institution and branch templates'
  )
on conflict (key) do nothing;

insert into public.configuration_presets (
  key, version, labels, configuration
) values
  (
    'maktab', 1,
    '{"en":"Maktab","ur":"مکتب","ar":"الكتّاب"}'::jsonb,
    '{"domains":["admissions","attendance","nazra","qaida","fees"],"attendance_statuses":["present","absent","late","leave"],"terminology":{"student":{"en":"Student","ur":"طالب علم","ar":"طالب"},"teacher":{"en":"Ustad","ur":"استاد","ar":"أستاذ"},"class":{"en":"Group","ur":"جماعت","ar":"حلقة"}}}'::jsonb
  ),
  (
    'hifz_academy', 1,
    '{"en":"Hifz Academy","ur":"حفظ اکیڈمی","ar":"أكاديمية التحفيظ"}'::jsonb,
    '{"domains":["admissions","attendance","hifz","nazra","qaida","fees","parent_portal"],"attendance_statuses":["present","absent","late","leave","excused"],"terminology":{"student":{"en":"Hifz Student","ur":"طالب حفظ","ar":"طالب حفظ"},"teacher":{"en":"Hifz Ustad","ur":"استاد حفظ","ar":"أستاذ التحفيظ"},"class":{"en":"Halaqah","ur":"حلقہ","ar":"حلقة"}}}'::jsonb
  ),
  (
    'dars_e_nizami', 1,
    '{"en":"Dars-e-Nizami","ur":"درس نظامی","ar":"الدرس النظامي"}'::jsonb,
    '{"domains":["admissions","attendance","dars_e_nizami","exams","library","fees"],"attendance_statuses":["present","absent","late","leave"],"terminology":{"student":{"en":"Talib-e-Ilm","ur":"طالب علم","ar":"طالب علم"},"teacher":{"en":"Ustad","ur":"استاد","ar":"أستاذ"},"class":{"en":"Sanah","ur":"سنہ","ar":"سنة"}}}'::jsonb
  ),
  (
    'islamic_school', 1,
    '{"en":"Islamic School","ur":"اسلامی اسکول","ar":"المدرسة الإسلامية"}'::jsonb,
    '{"domains":["admissions","attendance","academics","homework","exams","fees","transport"],"attendance_statuses":["present","absent","late","leave","half_day"],"terminology":{"student":{"en":"Student","ur":"طالب علم","ar":"طالب"},"teacher":{"en":"Teacher","ur":"استاد","ar":"معلّم"},"class":{"en":"Class","ur":"کلاس","ar":"صف"}}}'::jsonb
  ),
  (
    'urdu_medium_school', 1,
    '{"en":"Urdu-medium School","ur":"اردو میڈیم اسکول","ar":"مدرسة أُردية"}'::jsonb,
    '{"domains":["admissions","attendance","academics","homework","exams","fees"],"attendance_statuses":["present","absent","late","leave"],"terminology":{"student":{"en":"Student","ur":"طالب علم","ar":"طالب"},"teacher":{"en":"Teacher","ur":"استاد","ar":"معلّم"},"class":{"en":"Class","ur":"جماعت","ar":"صف"}}}'::jsonb
  )
on conflict (key) do nothing;

create index config_values_resolution_idx
  on public.config_values (tenant_id, definition_key, scope_type, scope_key, effective_at desc)
  where status = 'published';
create index terminology_sets_resolution_idx
  on public.terminology_sets (tenant_id, scope_type, scope_key, effective_at desc)
  where status = 'published';
create index terminology_entries_lookup_idx
  on public.terminology_entries (tenant_id, terminology_set_id, locale, concept_key);
create index custom_field_definitions_entity_idx
  on public.custom_field_definitions (tenant_id, entity_type, status, key);
create index custom_field_values_subject_idx
  on public.custom_field_values (tenant_id, subject_type, subject_key);
create index form_versions_published_idx
  on public.form_versions (tenant_id, form_definition_id, effective_at desc)
  where status = 'published';
create index status_definitions_family_idx
  on public.status_definitions (tenant_id, family, status, display_order);
create index status_transitions_from_idx
  on public.status_transitions (tenant_id, family, from_status_id);
create index status_transitions_to_idx
  on public.status_transitions (tenant_id, to_status_id);
create index workflow_versions_published_idx
  on public.workflow_versions (tenant_id, workflow_definition_id, effective_at desc)
  where status = 'published';
create index workflow_instances_subject_idx
  on public.workflow_instances (tenant_id, subject_type, subject_key, status);
create index workflow_instances_version_idx
  on public.workflow_instances (tenant_id, workflow_version_id, status);
create index workflow_tasks_assignee_idx
  on public.workflow_tasks (tenant_id, assignee_membership_id, state, due_at)
  where assignee_membership_id is not null;
create index workflow_tasks_instance_idx
  on public.workflow_tasks (tenant_id, workflow_instance_id, state);
create index grade_scale_versions_published_idx
  on public.grade_scale_versions (tenant_id, grade_scale_id, effective_at desc)
  where status = 'published';
create index template_versions_published_idx
  on public.template_versions (tenant_id, template_definition_id, locale, effective_at desc)
  where status = 'published';
create index number_sequences_lookup_idx
  on public.number_sequences (tenant_id, branch_id, entity_type, status);
create index config_values_definition_idx
  on public.config_values (definition_key);
create index config_values_created_by_idx
  on public.config_values (tenant_id, created_by_membership_id);
create index config_values_published_by_idx
  on public.config_values (tenant_id, published_by_membership_id);
create index terminology_sets_created_by_idx
  on public.terminology_sets (tenant_id, created_by_membership_id);
create index terminology_sets_published_by_idx
  on public.terminology_sets (tenant_id, published_by_membership_id);
create index custom_field_definitions_created_by_idx
  on public.custom_field_definitions (tenant_id, created_by_membership_id);
create index custom_field_definitions_published_by_idx
  on public.custom_field_definitions (tenant_id, published_by_membership_id);
create index form_versions_created_by_idx
  on public.form_versions (tenant_id, created_by_membership_id);
create index form_versions_published_by_idx
  on public.form_versions (tenant_id, published_by_membership_id);
create index status_transitions_permission_idx
  on public.status_transitions (permission_code);
create index status_transitions_tenant_from_idx
  on public.status_transitions (tenant_id, from_status_id);
create index workflow_versions_created_by_idx
  on public.workflow_versions (tenant_id, created_by_membership_id);
create index workflow_versions_published_by_idx
  on public.workflow_versions (tenant_id, published_by_membership_id);
create index workflow_instances_branch_idx
  on public.workflow_instances (tenant_id, branch_id);
create index grade_scale_versions_created_by_idx
  on public.grade_scale_versions (tenant_id, created_by_membership_id);
create index grade_scale_versions_published_by_idx
  on public.grade_scale_versions (tenant_id, published_by_membership_id);
create index attendance_status_sets_created_by_idx
  on public.attendance_status_sets (tenant_id, created_by_membership_id);
create index attendance_status_sets_published_by_idx
  on public.attendance_status_sets (tenant_id, published_by_membership_id);
create index template_versions_created_by_idx
  on public.template_versions (tenant_id, created_by_membership_id);
create index template_versions_published_by_idx
  on public.template_versions (tenant_id, published_by_membership_id);
create index number_sequences_created_by_idx
  on public.number_sequences (tenant_id, created_by_membership_id);
create index number_sequences_published_by_idx
  on public.number_sequences (tenant_id, published_by_membership_id);
create index tenant_setup_progress_preset_idx
  on public.tenant_setup_progress (preset_key);
create index tenant_setup_progress_updated_by_idx
  on public.tenant_setup_progress (tenant_id, updated_by_membership_id);

create or replace function private.protect_published_configuration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'published configuration is immutable; create a new version';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function private.protect_core_status_definition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.core_semantic then
      raise exception 'core status semantics cannot be changed or archived';
    end if;

    return old;
  end if;

  if old.core_semantic and (
    new.key is distinct from old.key
    or new.family is distinct from old.family
    or new.core_semantic is distinct from old.core_semantic
    or new.status = 'archived'
  ) then
    raise exception 'core status semantics cannot be changed or archived';
  end if;

  return new;
end;
$$;

create or replace function private.reserve_number_sequence(
  p_tenant_id bigint,
  p_key text,
  p_branch_id bigint default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reserved_value bigint;
begin
  update public.number_sequences
  set next_value = next_value + 1,
      updated_at = now()
  where tenant_id = p_tenant_id
    and key = p_key
    and branch_id is not distinct from p_branch_id
    and status = 'published'
  returning next_value - 1 into reserved_value;

  if reserved_value is null then
    raise exception 'published number sequence not found';
  end if;

  return reserved_value;
end;
$$;

revoke all on function private.protect_published_configuration() from public, anon, authenticated;
revoke all on function private.protect_core_status_definition() from public, anon, authenticated;
revoke all on function private.reserve_number_sequence(bigint, text, bigint) from public, anon, authenticated;
grant execute on function private.reserve_number_sequence(bigint, text, bigint) to service_role;

create trigger config_values_protect_published
  before update or delete on public.config_values
  for each row execute function private.protect_published_configuration();
create trigger terminology_sets_protect_published
  before update or delete on public.terminology_sets
  for each row execute function private.protect_published_configuration();
create trigger custom_field_definitions_protect_published
  before update or delete on public.custom_field_definitions
  for each row execute function private.protect_published_configuration();
create trigger form_versions_protect_published
  before update or delete on public.form_versions
  for each row execute function private.protect_published_configuration();
create trigger workflow_versions_protect_published
  before update or delete on public.workflow_versions
  for each row execute function private.protect_published_configuration();
create trigger grade_scale_versions_protect_published
  before update or delete on public.grade_scale_versions
  for each row execute function private.protect_published_configuration();
create trigger attendance_status_sets_protect_published
  before update or delete on public.attendance_status_sets
  for each row execute function private.protect_published_configuration();
create trigger template_versions_protect_published
  before update or delete on public.template_versions
  for each row execute function private.protect_published_configuration();
create trigger number_sequences_protect_published
  before update or delete on public.number_sequences
  for each row execute function private.protect_published_configuration();
create trigger status_definitions_protect_core
  before update or delete on public.status_definitions
  for each row execute function private.protect_core_status_definition();

create trigger config_values_immutable_tenant
  before update of tenant_id on public.config_values
  for each row execute function private.enforce_immutable_tenant_id();
create trigger terminology_sets_immutable_tenant
  before update of tenant_id on public.terminology_sets
  for each row execute function private.enforce_immutable_tenant_id();
create trigger terminology_entries_immutable_tenant
  before update of tenant_id on public.terminology_entries
  for each row execute function private.enforce_immutable_tenant_id();
create trigger custom_field_definitions_immutable_tenant
  before update of tenant_id on public.custom_field_definitions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger custom_field_values_immutable_tenant
  before update of tenant_id on public.custom_field_values
  for each row execute function private.enforce_immutable_tenant_id();
create trigger form_definitions_immutable_tenant
  before update of tenant_id on public.form_definitions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger form_versions_immutable_tenant
  before update of tenant_id on public.form_versions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger status_definitions_immutable_tenant
  before update of tenant_id on public.status_definitions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger status_transitions_immutable_tenant
  before update of tenant_id on public.status_transitions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger workflow_definitions_immutable_tenant
  before update of tenant_id on public.workflow_definitions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger workflow_versions_immutable_tenant
  before update of tenant_id on public.workflow_versions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger workflow_instances_immutable_tenant
  before update of tenant_id on public.workflow_instances
  for each row execute function private.enforce_immutable_tenant_id();
create trigger workflow_tasks_immutable_tenant
  before update of tenant_id on public.workflow_tasks
  for each row execute function private.enforce_immutable_tenant_id();
create trigger grade_scales_immutable_tenant
  before update of tenant_id on public.grade_scales
  for each row execute function private.enforce_immutable_tenant_id();
create trigger grade_scale_versions_immutable_tenant
  before update of tenant_id on public.grade_scale_versions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger attendance_status_sets_immutable_tenant
  before update of tenant_id on public.attendance_status_sets
  for each row execute function private.enforce_immutable_tenant_id();
create trigger template_definitions_immutable_tenant
  before update of tenant_id on public.template_definitions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger template_versions_immutable_tenant
  before update of tenant_id on public.template_versions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger number_sequences_immutable_tenant
  before update of tenant_id on public.number_sequences
  for each row execute function private.enforce_immutable_tenant_id();
create trigger tenant_setup_progress_immutable_tenant
  before update of tenant_id on public.tenant_setup_progress
  for each row execute function private.enforce_immutable_tenant_id();

alter table public.config_definitions enable row level security;
alter table public.config_definitions force row level security;
alter table public.config_values enable row level security;
alter table public.config_values force row level security;
alter table public.terminology_sets enable row level security;
alter table public.terminology_sets force row level security;
alter table public.terminology_entries enable row level security;
alter table public.terminology_entries force row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_definitions force row level security;
alter table public.custom_field_values enable row level security;
alter table public.custom_field_values force row level security;
alter table public.form_definitions enable row level security;
alter table public.form_definitions force row level security;
alter table public.form_versions enable row level security;
alter table public.form_versions force row level security;
alter table public.status_definitions enable row level security;
alter table public.status_definitions force row level security;
alter table public.status_transitions enable row level security;
alter table public.status_transitions force row level security;
alter table public.workflow_definitions enable row level security;
alter table public.workflow_definitions force row level security;
alter table public.workflow_versions enable row level security;
alter table public.workflow_versions force row level security;
alter table public.workflow_instances enable row level security;
alter table public.workflow_instances force row level security;
alter table public.workflow_tasks enable row level security;
alter table public.workflow_tasks force row level security;
alter table public.grade_scales enable row level security;
alter table public.grade_scales force row level security;
alter table public.grade_scale_versions enable row level security;
alter table public.grade_scale_versions force row level security;
alter table public.attendance_status_sets enable row level security;
alter table public.attendance_status_sets force row level security;
alter table public.template_definitions enable row level security;
alter table public.template_definitions force row level security;
alter table public.template_versions enable row level security;
alter table public.template_versions force row level security;
alter table public.number_sequences enable row level security;
alter table public.number_sequences force row level security;
alter table public.configuration_presets enable row level security;
alter table public.configuration_presets force row level security;
alter table public.tenant_setup_progress enable row level security;
alter table public.tenant_setup_progress force row level security;

create policy config_definitions_select_member
  on public.config_definitions for select to authenticated
  using ((select private.has_any_tenant_membership()));
create policy configuration_presets_select_member
  on public.configuration_presets for select to authenticated
  using ((select private.has_any_tenant_membership()));

create policy config_values_select_authorized
  on public.config_values for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy terminology_sets_select_authorized
  on public.terminology_sets for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy terminology_entries_select_authorized
  on public.terminology_entries for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy custom_field_definitions_select_authorized
  on public.custom_field_definitions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy form_definitions_select_authorized
  on public.form_definitions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy form_versions_select_authorized
  on public.form_versions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy status_definitions_select_authorized
  on public.status_definitions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy status_transitions_select_authorized
  on public.status_transitions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy workflow_definitions_select_authorized
  on public.workflow_definitions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy workflow_versions_select_authorized
  on public.workflow_versions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy grade_scales_select_authorized
  on public.grade_scales for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy grade_scale_versions_select_authorized
  on public.grade_scale_versions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy attendance_status_sets_select_authorized
  on public.attendance_status_sets for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy template_definitions_select_authorized
  on public.template_definitions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy template_versions_select_authorized
  on public.template_versions for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));
create policy number_sequences_select_authorized
  on public.number_sequences for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read', branch_id)));
create policy tenant_setup_progress_select_authorized
  on public.tenant_setup_progress for select to authenticated
  using ((select private.has_permission(tenant_id, 'settings.configuration.read')));

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.config_definitions,
     public.config_values,
     public.terminology_sets,
     public.terminology_entries,
     public.custom_field_definitions,
     public.custom_field_values,
     public.form_definitions,
     public.form_versions,
     public.status_definitions,
     public.status_transitions,
     public.workflow_definitions,
     public.workflow_versions,
     public.workflow_instances,
     public.workflow_tasks,
     public.grade_scales,
     public.grade_scale_versions,
     public.attendance_status_sets,
     public.template_definitions,
     public.template_versions,
     public.number_sequences,
     public.configuration_presets,
     public.tenant_setup_progress
  from authenticated;
grant select
  on public.config_definitions,
     public.config_values,
     public.terminology_sets,
     public.terminology_entries,
     public.custom_field_definitions,
     public.form_definitions,
     public.form_versions,
     public.status_definitions,
     public.status_transitions,
     public.workflow_definitions,
     public.workflow_versions,
     public.grade_scales,
     public.grade_scale_versions,
     public.attendance_status_sets,
     public.template_definitions,
     public.template_versions,
     public.number_sequences,
     public.configuration_presets,
     public.tenant_setup_progress
  to authenticated;
