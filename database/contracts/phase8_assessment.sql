-- Phase 8 executable database contract: curriculum, exams, results, and promotion.

insert into public.permissions (code, description) values
  ('assessment.setup.manage', 'Manage curriculum, grading, and exam setup'),
  ('assessment.marks.read', 'Read assigned marks workflows'),
  ('assessment.marks.enter', 'Enter assigned marks'),
  ('assessment.marks.moderate', 'Moderate submitted marks'),
  ('assessment.results.approve', 'Approve and lock calculated results'),
  ('assessment.results.publish', 'Publish immutable result snapshots'),
  ('assessment.results.reopen', 'Reopen locked results with reason'),
  ('assessment.promotion.approve', 'Approve promotion, retention, and completion')
on conflict (code) do nothing;

create table public.curriculum_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  program_id bigint not null,
  version integer not null check (version > 0),
  labels jsonb not null,
  state text not null default 'draft' check (state in ('draft','published','superseded','archived')),
  entry_rules jsonb not null default '{}'::jsonb,
  completion_rules jsonb not null default '{}'::jsonb,
  assessment_rules jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, program_id, version),
  foreign key (tenant_id, program_id) references public.programs(tenant_id, id) on delete restrict,
  constraint curriculum_versions_publish_check check (state <> 'published' or published_at is not null)
);

create table public.curriculum_version_items (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  curriculum_version_id bigint not null,
  level_id bigint,
  subject_id bigint not null,
  book_id bigint,
  sequence integer not null default 0 check (sequence >= 0),
  required boolean not null default true,
  credit_weight numeric(8,3) not null default 1 check (credit_weight >= 0),
  teaching_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, curriculum_version_id, level_id, subject_id, book_id),
  foreign key (tenant_id, curriculum_version_id) references public.curriculum_versions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, level_id) references public.academic_levels(tenant_id, id) on delete restrict,
  foreign key (tenant_id, subject_id) references public.subjects(tenant_id, id) on delete restrict,
  foreign key (tenant_id, book_id) references public.books(tenant_id, id) on delete restrict
);

create table public.curriculum_units (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  curriculum_item_id bigint not null,
  parent_unit_id bigint,
  key text not null check (length(btrim(key)) between 1 and 80),
  labels jsonb not null,
  sequence integer not null check (sequence >= 0),
  expected_periods numeric(7,2) check (expected_periods is null or expected_periods >= 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, curriculum_item_id, key),
  foreign key (tenant_id, curriculum_item_id) references public.curriculum_version_items(tenant_id, id) on delete cascade,
  foreign key (tenant_id, parent_unit_id) references public.curriculum_units(tenant_id, id) on delete restrict
);

create table public.curriculum_coverage_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  curriculum_unit_id bigint not null,
  group_id bigint not null,
  teacher_person_id bigint not null,
  lesson_plan_id bigint,
  state text not null check (state in ('introduced','in_progress','covered','revised','skipped')),
  coverage_percent numeric(6,2) not null check (coverage_percent between 0 and 100),
  reason text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, curriculum_unit_id) references public.curriculum_units(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id) references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, teacher_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, lesson_plan_id) references public.lesson_plans(tenant_id, id) on delete restrict,
  constraint curriculum_coverage_skip_reason_check check (state <> 'skipped' or length(btrim(reason)) >= 4)
);

create table public.grading_scale_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  version integer not null check (version > 0),
  labels jsonb not null,
  rounding_mode text not null default 'half_up' check (rounding_mode in ('half_up','half_even','floor','ceil','none')),
  decimal_places smallint not null default 2 check (decimal_places between 0 and 4),
  state text not null default 'draft' check (state in ('draft','published','superseded','archived')),
  rules jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key, version),
  constraint grading_scale_publish_check check (state <> 'published' or published_at is not null)
);

create table public.grading_bands (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  grading_scale_version_id bigint not null,
  grade_key text not null check (length(btrim(grade_key)) between 1 and 20),
  labels jsonb not null,
  minimum_percent numeric(7,4) not null check (minimum_percent between 0 and 100),
  maximum_percent numeric(7,4) not null check (maximum_percent between 0 and 100),
  outcome text not null check (outcome in ('pass','fail','incomplete','withheld')),
  points numeric(7,3),
  sequence integer not null check (sequence >= 0),
  unique (tenant_id, id),
  unique (tenant_id, grading_scale_version_id, grade_key),
  foreign key (tenant_id, grading_scale_version_id) references public.grading_scale_versions(tenant_id, id) on delete cascade,
  constraint grading_bands_range_check check (maximum_percent >= minimum_percent)
);

create table public.exam_series (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  session_id bigint not null,
  program_id bigint not null,
  level_id bigint,
  group_id bigint,
  curriculum_version_id bigint not null,
  grading_scale_version_id bigint not null,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  labels jsonb not null,
  starts_on date not null,
  ends_on date not null,
  state text not null default 'draft' check (state in ('draft','scheduled','timetable_published','marks_open','marks_locked','results_approved','results_published','archived')),
  publication_policy jsonb not null default '{}'::jsonb,
  ranking_enabled boolean not null default false,
  rules_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, branch_id, session_id, key),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, session_id) references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id) references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, level_id) references public.academic_levels(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id) references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, curriculum_version_id) references public.curriculum_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, grading_scale_version_id) references public.grading_scale_versions(tenant_id, id) on delete restrict,
  constraint exam_series_dates_check check (ends_on >= starts_on)
);

create table public.exam_subjects (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  exam_series_id bigint not null,
  subject_id bigint not null,
  evaluator_person_id bigint,
  maximum_marks numeric(9,3) not null check (maximum_marks > 0),
  pass_marks numeric(9,3) check (pass_marks is null or pass_marks between 0 and maximum_marks),
  weight numeric(9,4) not null default 100 check (weight > 0),
  optional boolean not null default false,
  rules_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, exam_series_id, subject_id),
  foreign key (tenant_id, exam_series_id) references public.exam_series(tenant_id, id) on delete cascade,
  foreign key (tenant_id, subject_id) references public.subjects(tenant_id, id) on delete restrict,
  foreign key (tenant_id, evaluator_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict
);

create table public.assessment_components (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  exam_subject_id bigint not null,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  labels jsonb not null,
  entry_mode text not null default 'marks' check (entry_mode in ('marks','grade','status')),
  maximum_marks numeric(9,3) check (maximum_marks is null or maximum_marks > 0),
  pass_marks numeric(9,3),
  weight numeric(9,4) not null check (weight > 0),
  required boolean not null default true,
  sequence integer not null check (sequence >= 0),
  allowed_statuses text[] not null default array['present','absent','exempt','incomplete','withheld']::text[],
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, exam_subject_id, key),
  foreign key (tenant_id, exam_subject_id) references public.exam_subjects(tenant_id, id) on delete cascade,
  constraint assessment_components_marks_check check (
    (entry_mode = 'marks' and maximum_marks is not null and (pass_marks is null or pass_marks between 0 and maximum_marks))
    or (entry_mode <> 'marks' and maximum_marks is null and pass_marks is null)
  )
);

create table public.exam_schedules (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  exam_subject_id bigint not null,
  assessment_component_id bigint,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room_key text,
  invigilator_person_id bigint,
  timetable_published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, exam_subject_id) references public.exam_subjects(tenant_id, id) on delete cascade,
  foreign key (tenant_id, assessment_component_id) references public.assessment_components(tenant_id, id) on delete restrict,
  foreign key (tenant_id, invigilator_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict,
  constraint exam_schedules_times_check check (ends_at > starts_at)
);

create table public.marksheets (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  exam_subject_id bigint not null,
  group_id bigint,
  evaluator_person_id bigint not null,
  state text not null default 'not_started' check (state in ('not_started','draft','submitted','moderated','approved','locked','published','reopened')),
  version integer not null default 1 check (version > 0),
  reopen_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  locked_at timestamptz,
  published_at timestamptz,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, exam_subject_id, group_id, version),
  foreign key (tenant_id, exam_subject_id) references public.exam_subjects(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id) references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, evaluator_person_id) references public.employee_profiles(tenant_id, person_id) on delete restrict,
  constraint marksheets_reopen_reason_check check (state <> 'reopened' or length(btrim(reopen_reason)) >= 4)
);

create table public.mark_entries (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  marksheet_id bigint not null,
  assessment_component_id bigint not null,
  enrollment_id bigint not null,
  student_person_id bigint not null,
  entry_status text not null check (entry_status in ('present','absent','exempt','incomplete','withheld')),
  raw_marks numeric(9,3),
  grade_key text,
  comment text,
  current_version integer not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, marksheet_id, assessment_component_id, enrollment_id),
  foreign key (tenant_id, marksheet_id) references public.marksheets(tenant_id, id) on delete restrict,
  foreign key (tenant_id, assessment_component_id) references public.assessment_components(tenant_id, id) on delete restrict,
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id) references public.student_profiles(tenant_id, person_id) on delete restrict,
  constraint mark_entries_value_check check (
    (entry_status = 'present' and (raw_marks is not null or grade_key is not null))
    or (entry_status <> 'present' and raw_marks is null)
  )
);

create table public.mark_entry_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  mark_entry_id bigint not null,
  version integer not null check (version > 0),
  entry_status text not null,
  raw_marks numeric(9,3),
  grade_key text,
  comment text,
  source text not null check (source in ('entry','submission','moderation','correction','reopen')),
  actor_membership_id bigint,
  reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, mark_entry_id, version),
  foreign key (tenant_id, mark_entry_id) references public.mark_entries(tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create table public.mark_moderations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  mark_entry_id bigint not null,
  before_version integer not null check (before_version > 0),
  after_version integer not null check (after_version > before_version),
  reason text not null check (length(btrim(reason)) >= 4),
  moderator_membership_id bigint not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, mark_entry_id) references public.mark_entries(tenant_id, id) on delete restrict,
  foreign key (tenant_id, moderator_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create table public.result_runs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  exam_series_id bigint not null,
  run_number integer not null check (run_number > 0),
  curriculum_version_id bigint not null,
  grading_scale_version_id bigint not null,
  input_digest text not null check (length(input_digest) between 32 and 128),
  rules_snapshot jsonb not null,
  state text not null default 'calculating' check (state in ('calculating','calculated','failed','approved','superseded')),
  anomaly_summary jsonb not null default '{}'::jsonb,
  calculated_at timestamptz,
  approved_by_membership_id bigint,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, exam_series_id, run_number),
  foreign key (tenant_id, exam_series_id) references public.exam_series(tenant_id, id) on delete restrict,
  foreign key (tenant_id, curriculum_version_id) references public.curriculum_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, grading_scale_version_id) references public.grading_scale_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint result_runs_approval_check check (state <> 'approved' or (approved_by_membership_id is not null and approved_at is not null))
);

create table public.result_snapshots (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  result_run_id bigint not null,
  enrollment_id bigint not null,
  student_person_id bigint not null,
  revision integer not null default 1 check (revision > 0),
  supersedes_snapshot_id bigint,
  raw_total numeric(12,4),
  weighted_total numeric(12,4),
  percentage numeric(9,4),
  aggregate_status text not null check (aggregate_status in ('pass','fail','incomplete','withheld','exempt')),
  grade_key text,
  rank_value integer check (rank_value is null or rank_value > 0),
  tie_key text,
  promotion_recommendation text not null check (promotion_recommendation in ('promote','retain','complete','review','none')),
  calculation_trace jsonb not null,
  state text not null default 'approved' check (state in ('approved','published','superseded','revoked')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, result_run_id, enrollment_id, revision),
  foreign key (tenant_id, result_run_id) references public.result_runs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id) references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, supersedes_snapshot_id) references public.result_snapshots(tenant_id, id) on delete restrict,
  constraint result_snapshots_publish_check check (state <> 'published' or published_at is not null)
);

create table public.result_subject_snapshots (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  result_snapshot_id bigint not null,
  exam_subject_id bigint not null,
  raw_marks numeric(12,4),
  normalized_marks numeric(12,4),
  weighted_marks numeric(12,4),
  rounded_marks numeric(12,4),
  maximum_marks numeric(12,4) not null check (maximum_marks > 0),
  outcome text not null check (outcome in ('pass','fail','incomplete','withheld','exempt')),
  grade_key text,
  component_trace jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, result_snapshot_id, exam_subject_id),
  foreign key (tenant_id, result_snapshot_id) references public.result_snapshots(tenant_id, id) on delete cascade,
  foreign key (tenant_id, exam_subject_id) references public.exam_subjects(tenant_id, id) on delete restrict
);

create table public.result_publications (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  exam_series_id bigint not null,
  publication_number integer not null check (publication_number > 0),
  result_run_id bigint not null,
  audience text not null default 'portal' check (audience in ('portal','staff','public_verification')),
  published_by_membership_id bigint not null,
  notification_policy_snapshot jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  unique (tenant_id, id),
  unique (tenant_id, exam_series_id, publication_number),
  foreign key (tenant_id, exam_series_id) references public.exam_series(tenant_id, id) on delete restrict,
  foreign key (tenant_id, result_run_id) references public.result_runs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint result_publications_revoke_check check (revoked_at is null or length(btrim(revocation_reason)) >= 4)
);

create table public.promotion_decisions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  result_snapshot_id bigint not null,
  enrollment_id bigint not null,
  decision text not null check (decision in ('promote','retain','transfer','complete','defer')),
  recommendation text not null,
  exception boolean not null default false,
  reason text,
  target_session_id bigint,
  target_program_id bigint,
  target_level_id bigint,
  target_group_id bigint,
  created_enrollment_id bigint,
  approved_by_membership_id bigint not null,
  approved_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  rollback_reason text,
  unique (tenant_id, id),
  unique (tenant_id, result_snapshot_id),
  foreign key (tenant_id, result_snapshot_id) references public.result_snapshots(tenant_id, id) on delete restrict,
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, target_session_id) references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, target_program_id) references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, target_level_id) references public.academic_levels(tenant_id, id) on delete restrict,
  foreign key (tenant_id, target_group_id) references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_enrollment_id) references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint promotion_exception_reason_check check (not exception or length(btrim(reason)) >= 4),
  constraint promotion_rollback_reason_check check (rolled_back_at is null or length(btrim(rollback_reason)) >= 4)
);

create table public.report_card_issues (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  result_snapshot_id bigint not null,
  document_id bigint,
  revision integer not null check (revision > 0),
  template_key text not null,
  template_version integer not null check (template_version > 0),
  content_digest text not null check (length(content_digest) between 32 and 128),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, result_snapshot_id, revision),
  foreign key (tenant_id, result_snapshot_id) references public.result_snapshots(tenant_id, id) on delete restrict,
  foreign key (tenant_id, document_id) references public.documents(tenant_id, id) on delete restrict
);

create index curriculum_items_version_idx on public.curriculum_version_items (tenant_id, curriculum_version_id, level_id, sequence);
create index curriculum_units_item_idx on public.curriculum_units (tenant_id, curriculum_item_id, sequence);
create index curriculum_coverage_group_idx on public.curriculum_coverage_events (tenant_id, group_id, occurred_at desc);
create index grading_bands_scale_idx on public.grading_bands (tenant_id, grading_scale_version_id, minimum_percent desc);
create index exam_series_scope_idx on public.exam_series (tenant_id, branch_id, session_id, state);
create index exam_subjects_series_idx on public.exam_subjects (tenant_id, exam_series_id);
create index components_subject_idx on public.assessment_components (tenant_id, exam_subject_id, sequence);
create index exam_schedules_time_idx on public.exam_schedules (tenant_id, starts_at, ends_at);
create index marksheets_series_subject_idx on public.marksheets (tenant_id, exam_subject_id, state);
create index mark_entries_student_idx on public.mark_entries (tenant_id, student_person_id, marksheet_id);
create index mark_entry_versions_entry_idx on public.mark_entry_versions (tenant_id, mark_entry_id, version desc);
create index mark_moderations_entry_idx on public.mark_moderations (tenant_id, mark_entry_id, created_at desc);
create index result_runs_series_idx on public.result_runs (tenant_id, exam_series_id, run_number desc);
create index result_snapshots_student_idx on public.result_snapshots (tenant_id, student_person_id, state, created_at desc);
create index result_subject_snapshots_result_idx on public.result_subject_snapshots (tenant_id, result_snapshot_id);
create index result_publications_series_idx on public.result_publications (tenant_id, exam_series_id, published_at desc);
create index promotion_decisions_enrollment_idx on public.promotion_decisions (tenant_id, enrollment_id, approved_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'curriculum_versions','curriculum_version_items','curriculum_units','curriculum_coverage_events',
    'grading_scale_versions','grading_bands','exam_series','exam_subjects','assessment_components',
    'exam_schedules','marksheets','mark_entries','mark_entry_versions','mark_moderations',
    'result_runs','result_snapshots','result_subject_snapshots','result_publications',
    'promotion_decisions','report_card_issues'
  ] loop
    execute format(
      'create trigger %I before update of tenant_id on public.%I for each row execute function private.enforce_immutable_tenant_id()',
      table_name || '_immutable_tenant', table_name
    );
  end loop;
end;
$$;

create trigger curriculum_coverage_append_only before update or delete on public.curriculum_coverage_events
  for each row execute function private.reject_append_only_mutation();
create trigger mark_entry_versions_append_only before update or delete on public.mark_entry_versions
  for each row execute function private.reject_append_only_mutation();
create trigger mark_moderations_append_only before update or delete on public.mark_moderations
  for each row execute function private.reject_append_only_mutation();
create trigger result_subject_snapshots_append_only before update or delete on public.result_subject_snapshots
  for each row execute function private.reject_append_only_mutation();
create trigger report_card_issues_append_only before update or delete on public.report_card_issues
  for each row execute function private.reject_append_only_mutation();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'curriculum_versions','curriculum_version_items','curriculum_units','curriculum_coverage_events',
    'grading_scale_versions','grading_bands','exam_series','exam_subjects','assessment_components',
    'exam_schedules','marksheets','mark_entries','mark_entry_versions','mark_moderations',
    'result_runs','result_snapshots','result_subject_snapshots','result_publications',
    'promotion_decisions','report_card_issues'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

grant select on table
  public.curriculum_versions, public.curriculum_version_items, public.curriculum_units,
  public.curriculum_coverage_events, public.grading_scale_versions, public.grading_bands,
  public.exam_series, public.exam_subjects, public.assessment_components, public.exam_schedules,
  public.marksheets, public.mark_entries, public.mark_entry_versions, public.mark_moderations,
  public.result_runs, public.result_snapshots, public.result_subject_snapshots,
  public.result_publications, public.promotion_decisions, public.report_card_issues
to authenticated;

create policy curriculum_versions_staff_read on public.curriculum_versions for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.setup.manage', null)
);
create policy curriculum_items_staff_read on public.curriculum_version_items for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.setup.manage', null)
);
create policy curriculum_units_staff_read on public.curriculum_units for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.setup.manage', null)
);
create policy curriculum_coverage_staff_read on public.curriculum_coverage_events for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.marks.read', null)
);
create policy grading_scales_staff_read on public.grading_scale_versions for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.setup.manage', null)
);
create policy grading_bands_staff_read on public.grading_bands for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.setup.manage', null)
);
create policy exam_series_scoped_read on public.exam_series for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.marks.read', branch_id)
);
create policy exam_subjects_staff_read on public.exam_subjects for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.marks.read', null)
);
create policy assessment_components_staff_read on public.assessment_components for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.marks.read', null)
);
create policy exam_schedules_staff_read on public.exam_schedules for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.marks.read', null)
);
create policy marksheets_staff_read on public.marksheets for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.marks.read', null)
);
create policy mark_entries_staff_read on public.mark_entries for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.marks.read', null)
);
create policy mark_versions_staff_read on public.mark_entry_versions for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.marks.read', null)
);
create policy mark_moderations_staff_read on public.mark_moderations for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.marks.moderate', null)
);
create policy result_runs_staff_read on public.result_runs for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.results.approve', null)
);
create policy result_snapshots_scoped_read on public.result_snapshots for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.results.approve', null)
  or (state = 'published' and private.has_relationship(tenant_id, student_person_id::text, 'read'))
);
create policy result_subject_snapshots_scoped_read on public.result_subject_snapshots for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.results.approve', null)
  or exists (
    select 1 from public.result_snapshots snapshot
    where snapshot.tenant_id = result_subject_snapshots.tenant_id
      and snapshot.id = result_subject_snapshots.result_snapshot_id
      and snapshot.state = 'published'
      and private.has_relationship(snapshot.tenant_id, snapshot.student_person_id::text, 'read')
  )
);
create policy result_publications_staff_read on public.result_publications for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.results.publish', null)
);
create policy promotion_decisions_staff_read on public.promotion_decisions for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.promotion.approve', null)
);
create policy report_card_issues_scoped_read on public.report_card_issues for select to authenticated using (
  private.has_permission(tenant_id, 'assessment.results.publish', null)
  or exists (
    select 1 from public.result_snapshots snapshot
    where snapshot.tenant_id = report_card_issues.tenant_id
      and snapshot.id = report_card_issues.result_snapshot_id
      and snapshot.state = 'published'
      and private.has_relationship(snapshot.tenant_id, snapshot.student_person_id::text, 'read')
  )
);
