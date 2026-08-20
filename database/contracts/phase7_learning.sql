-- Phase 7 executable database contract: Hifz, Nazra, and Qaida learning records.

insert into public.permissions (code, description) values
  ('learning.plan.read', 'Read scoped learning plans'),
  ('learning.plan.manage', 'Create and update learning plans'),
  ('learning.recitation.read', 'Read scoped recitation records'),
  ('learning.recitation.record', 'Record Hifz, Nazra, and Qaida attempts'),
  ('learning.recitation.correct', 'Request or apply authorized learning corrections'),
  ('learning.milestone.verify', 'Verify learning milestones'),
  ('learning.progress.publish', 'Publish approved progress to portals'),
  ('learning.curriculum.manage', 'Manage versioned reading curricula')
on conflict (code) do nothing;

create table public.quran_editions (
  id bigint generated always as identity primary key,
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  labels jsonb not null,
  reference_scheme text not null default 'surah_ayah' check (reference_scheme = 'surah_ayah'),
  page_count integer check (page_count is null or page_count > 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now()
);

create table public.quran_references (
  id bigint generated always as identity primary key,
  surah_number smallint not null check (surah_number between 1 and 114),
  ayah_number integer not null check (ayah_number > 0),
  juz_number smallint check (juz_number between 1 and 30),
  hizb_number smallint check (hizb_number between 1 and 60),
  canonical_ordinal integer not null unique check (canonical_ordinal > 0),
  labels jsonb not null default '{}'::jsonb,
  unique (surah_number, ayah_number)
);

create table public.quran_page_mappings (
  edition_id bigint not null references public.quran_editions(id) on delete restrict,
  quran_reference_id bigint not null references public.quran_references(id) on delete restrict,
  page_number integer not null check (page_number > 0),
  line_number integer check (line_number is null or line_number > 0),
  primary key (edition_id, quran_reference_id)
);

create table public.learning_plans (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  enrollment_id bigint not null,
  teacher_person_id bigint,
  edition_id bigint references public.quran_editions(id) on delete restrict,
  plan_type text not null check (plan_type in ('hifz','nazra','qaida')),
  starts_on date not null,
  ends_on date,
  targets jsonb not null default '{}'::jsonb,
  evaluation_config_version jsonb not null default '{}'::jsonb,
  parent_visibility jsonb not null default '{}'::jsonb,
  baseline_estimated boolean not null default false,
  state text not null default 'draft' check (state in ('draft','active','paused','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, enrollment_id)
    references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, teacher_person_id)
    references public.employee_profiles(tenant_id, person_id) on delete restrict,
  constraint learning_plans_dates_check check (ends_on is null or ends_on >= starts_on)
);

create table public.learning_plan_items (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  learning_plan_id bigint not null,
  work_category text not null check (length(btrim(work_category)) between 2 and 80),
  start_reference_id bigint references public.quran_references(id) on delete restrict,
  end_reference_id bigint references public.quran_references(id) on delete restrict,
  reading_unit_id bigint,
  due_on date,
  target_state text not null default 'assigned'
    check (target_state in ('assigned','attempted','passed','memorized','verified','revision_current','cancelled')),
  sequence integer not null default 0 check (sequence >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, learning_plan_id)
    references public.learning_plans(tenant_id, id) on delete cascade,
  constraint learning_plan_items_target_check check (
    (start_reference_id is not null and end_reference_id is not null and reading_unit_id is null)
    or (start_reference_id is null and end_reference_id is null and reading_unit_id is not null)
  )
);

create table public.recitation_sessions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  group_id bigint,
  teacher_person_id bigint not null,
  session_date date not null,
  state text not null default 'draft' check (state in ('draft','submitted','locked','corrected')),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id)
    references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, teacher_person_id)
    references public.employee_profiles(tenant_id, person_id) on delete restrict,
  constraint recitation_sessions_submit_check check (state = 'draft' or submitted_at is not null)
);

create table public.recitation_attempts (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  recitation_session_id bigint not null,
  learning_plan_id bigint,
  learning_plan_item_id bigint,
  student_person_id bigint not null,
  attendance_record_id bigint,
  edition_id bigint references public.quran_editions(id) on delete restrict,
  work_category text not null check (length(btrim(work_category)) between 2 and 80),
  start_reference_id bigint references public.quran_references(id) on delete restrict,
  end_reference_id bigint references public.quran_references(id) on delete restrict,
  reading_unit_id bigint,
  attempt_number integer not null default 1 check (attempt_number > 0),
  accuracy_score numeric(6,2) check (accuracy_score between 0 and 100),
  fluency_score numeric(6,2) check (fluency_score between 0 and 100),
  tajweed_score numeric(6,2) check (tajweed_score between 0 and 100),
  overall_score numeric(6,2) check (overall_score between 0 and 100),
  prompts integer check (prompts is null or prompts >= 0),
  outcome text not null check (outcome in ('passed','partial','repeat','excused','not_attempted')),
  private_note text,
  teacher_remark text,
  parent_visible_remark text,
  evaluation_snapshot jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, recitation_session_id, student_person_id, work_category, attempt_number),
  foreign key (tenant_id, recitation_session_id)
    references public.recitation_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, learning_plan_id)
    references public.learning_plans(tenant_id, id) on delete restrict,
  foreign key (tenant_id, learning_plan_item_id)
    references public.learning_plan_items(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, attendance_record_id)
    references public.attendance_records(tenant_id, id) on delete restrict,
  constraint recitation_attempts_target_check check (
    (start_reference_id is not null and end_reference_id is not null and reading_unit_id is null)
    or (start_reference_id is null and end_reference_id is null and reading_unit_id is not null)
  )
);

create table public.recitation_mistakes (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  recitation_attempt_id bigint not null,
  category_key text not null check (length(btrim(category_key)) between 2 and 80),
  quran_reference_id bigint references public.quran_references(id) on delete restrict,
  reading_unit_id bigint,
  severity smallint not null default 1 check (severity between 1 and 5),
  count integer not null default 1 check (count > 0),
  repeated_derived boolean not null default false,
  repeated_teacher_override boolean,
  note text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, recitation_attempt_id)
    references public.recitation_attempts(tenant_id, id) on delete cascade
);

create table public.revision_obligations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  student_person_id bigint not null,
  learning_plan_id bigint,
  source_type text not null check (source_type in ('schedule','weak_score','repeated_mistake','missed_work','teacher')),
  source_key text,
  start_reference_id bigint references public.quran_references(id) on delete restrict,
  end_reference_id bigint references public.quran_references(id) on delete restrict,
  reading_unit_id bigint,
  due_on date not null,
  state text not null default 'due' check (state in ('due','assigned','attempted','completed','waived','cancelled')),
  completed_by_attempt_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, student_person_id)
    references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, learning_plan_id)
    references public.learning_plans(tenant_id, id) on delete restrict,
  foreign key (tenant_id, completed_by_attempt_id)
    references public.recitation_attempts(tenant_id, id) on delete restrict,
  constraint revision_obligations_completion_check check (
    state <> 'completed' or completed_by_attempt_id is not null
  )
);

create table public.learning_strength_snapshots (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  student_person_id bigint not null,
  portion_key text not null check (length(btrim(portion_key)) between 2 and 160),
  score numeric(6,2) not null check (score between 0 and 100),
  state text not null check (state in ('strong','due','weak','critical')),
  factors jsonb not null,
  configuration_snapshot jsonb not null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, student_person_id)
    references public.student_profiles(tenant_id, person_id) on delete restrict
);

create table public.learning_milestones (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  student_person_id bigint not null,
  learning_plan_id bigint,
  milestone_type text not null check (milestone_type in ('juz','surah','stage','half','completion','verification','custom')),
  milestone_key text not null check (length(btrim(milestone_key)) between 1 and 160),
  achieved_at timestamptz not null,
  state text not null default 'achieved' check (state in ('achieved','verification_pending','verified','revoked')),
  verified_by_person_id bigint,
  verified_at timestamptz,
  certificate_eligible boolean not null default false,
  parent_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, student_person_id, milestone_type, milestone_key),
  foreign key (tenant_id, student_person_id)
    references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, learning_plan_id)
    references public.learning_plans(tenant_id, id) on delete restrict,
  foreign key (tenant_id, verified_by_person_id)
    references public.employee_profiles(tenant_id, person_id) on delete restrict,
  constraint learning_milestones_verification_check check (
    state <> 'verified' or (verified_by_person_id is not null and verified_at is not null)
  )
);

create table public.reading_curricula (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  labels jsonb not null,
  curriculum_type text not null check (curriculum_type in ('nazra','qaida','custom_reading')),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id)
);

create table public.reading_curriculum_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  curriculum_id bigint not null,
  version integer not null check (version > 0),
  state text not null default 'draft' check (state in ('draft','published','superseded','archived')),
  effective_at timestamptz,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, curriculum_id, version),
  foreign key (tenant_id, curriculum_id)
    references public.reading_curricula(tenant_id, id) on delete restrict,
  constraint reading_curriculum_versions_publish_check check (state <> 'published' or effective_at is not null)
);

create table public.reading_units (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  curriculum_version_id bigint not null,
  parent_unit_id bigint,
  unit_type text not null check (unit_type in ('book','lesson','exercise','page','surah','juz','stage','custom')),
  key text not null check (length(btrim(key)) between 1 and 80),
  labels jsonb not null,
  sequence integer not null check (sequence >= 0),
  prerequisite_unit_ids bigint[] not null default array[]::bigint[],
  content_reference jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, curriculum_version_id, key),
  foreign key (tenant_id, curriculum_version_id)
    references public.reading_curriculum_versions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, parent_unit_id)
    references public.reading_units(tenant_id, id) on delete restrict
);

alter table public.learning_plan_items
  add constraint learning_plan_items_reading_unit_fk
  foreign key (tenant_id, reading_unit_id)
  references public.reading_units(tenant_id, id) on delete restrict;
alter table public.recitation_attempts
  add constraint recitation_attempts_reading_unit_fk
  foreign key (tenant_id, reading_unit_id)
  references public.reading_units(tenant_id, id) on delete restrict;
alter table public.recitation_mistakes
  add constraint recitation_mistakes_reading_unit_fk
  foreign key (tenant_id, reading_unit_id)
  references public.reading_units(tenant_id, id) on delete restrict;
alter table public.revision_obligations
  add constraint revision_obligations_reading_unit_fk
  foreign key (tenant_id, reading_unit_id)
  references public.reading_units(tenant_id, id) on delete restrict;

create table public.reading_attempts (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  learning_plan_id bigint not null,
  curriculum_version_id bigint not null,
  reading_unit_id bigint not null,
  student_person_id bigint not null,
  teacher_person_id bigint not null,
  attempt_number integer not null default 1 check (attempt_number > 0),
  scores jsonb not null default '{}'::jsonb,
  outcome text not null check (outcome in ('pass','partial','repeat','skip','advance')),
  reason text,
  teacher_remark text,
  parent_visible_remark text,
  next_unit_id bigint,
  due_on date,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, student_person_id, reading_unit_id, attempt_number),
  foreign key (tenant_id, learning_plan_id)
    references public.learning_plans(tenant_id, id) on delete restrict,
  foreign key (tenant_id, curriculum_version_id)
    references public.reading_curriculum_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, reading_unit_id)
    references public.reading_units(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, teacher_person_id)
    references public.employee_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, next_unit_id)
    references public.reading_units(tenant_id, id) on delete restrict,
  constraint reading_attempts_skip_reason_check check (outcome <> 'skip' or length(btrim(reason)) >= 4)
);

insert into public.quran_editions (key, labels, page_count) values
  ('indo_pak', '{"en":"Indo-Pak Mushaf","ur":"ہند و پاک مصحف","ar":"مصحف هندي باكستاني"}'::jsonb, null),
  ('madani_604', '{"en":"Madani Mushaf (604 pages)","ur":"مدنی مصحف (604 صفحات)","ar":"المصحف المدني (604 صفحات)"}'::jsonb, 604)
on conflict (key) do nothing;

create index quran_page_mappings_reference_idx on public.quran_page_mappings (quran_reference_id, edition_id);
create index learning_plans_enrollment_idx on public.learning_plans (tenant_id, enrollment_id, state);
create index learning_plans_teacher_idx on public.learning_plans (tenant_id, teacher_person_id, state)
  where teacher_person_id is not null;
create index learning_plans_edition_idx on public.learning_plans (edition_id) where edition_id is not null;
create index learning_plan_items_plan_idx on public.learning_plan_items (tenant_id, learning_plan_id, sequence);
create index learning_plan_items_start_ref_idx on public.learning_plan_items (start_reference_id) where start_reference_id is not null;
create index learning_plan_items_end_ref_idx on public.learning_plan_items (end_reference_id) where end_reference_id is not null;
create index learning_plan_items_reading_idx on public.learning_plan_items (tenant_id, reading_unit_id) where reading_unit_id is not null;
create index recitation_sessions_branch_idx on public.recitation_sessions (tenant_id, branch_id, session_date, state);
create index recitation_sessions_group_idx on public.recitation_sessions (tenant_id, group_id, session_date) where group_id is not null;
create index recitation_sessions_teacher_idx on public.recitation_sessions (tenant_id, teacher_person_id, session_date);
create index recitation_attempts_student_idx on public.recitation_attempts (tenant_id, student_person_id, occurred_at desc);
create index recitation_attempts_session_idx on public.recitation_attempts (tenant_id, recitation_session_id);
create index recitation_attempts_plan_idx on public.recitation_attempts (tenant_id, learning_plan_id) where learning_plan_id is not null;
create index recitation_attempts_item_idx on public.recitation_attempts (tenant_id, learning_plan_item_id) where learning_plan_item_id is not null;
create index recitation_attempts_attendance_idx on public.recitation_attempts (tenant_id, attendance_record_id) where attendance_record_id is not null;
create index recitation_attempts_edition_idx on public.recitation_attempts (edition_id) where edition_id is not null;
create index recitation_attempts_start_ref_idx on public.recitation_attempts (start_reference_id) where start_reference_id is not null;
create index recitation_attempts_end_ref_idx on public.recitation_attempts (end_reference_id) where end_reference_id is not null;
create index recitation_attempts_reading_idx on public.recitation_attempts (tenant_id, reading_unit_id) where reading_unit_id is not null;
create index recitation_mistakes_attempt_idx on public.recitation_mistakes (tenant_id, recitation_attempt_id, category_key);
create index recitation_mistakes_reference_idx on public.recitation_mistakes (quran_reference_id, category_key) where quran_reference_id is not null;
create index recitation_mistakes_reading_idx on public.recitation_mistakes (tenant_id, reading_unit_id) where reading_unit_id is not null;
create index revision_obligations_student_idx on public.revision_obligations (tenant_id, student_person_id, state, due_on);
create index revision_obligations_plan_idx on public.revision_obligations (tenant_id, learning_plan_id) where learning_plan_id is not null;
create index revision_obligations_start_ref_idx on public.revision_obligations (start_reference_id) where start_reference_id is not null;
create index revision_obligations_end_ref_idx on public.revision_obligations (end_reference_id) where end_reference_id is not null;
create index revision_obligations_reading_idx on public.revision_obligations (tenant_id, reading_unit_id) where reading_unit_id is not null;
create index revision_obligations_attempt_idx on public.revision_obligations (tenant_id, completed_by_attempt_id) where completed_by_attempt_id is not null;
create index learning_strength_student_idx on public.learning_strength_snapshots (tenant_id, student_person_id, calculated_at desc);
create index learning_milestones_student_idx on public.learning_milestones (tenant_id, student_person_id, achieved_at desc);
create index learning_milestones_plan_idx on public.learning_milestones (tenant_id, learning_plan_id) where learning_plan_id is not null;
create index learning_milestones_verifier_idx on public.learning_milestones (tenant_id, verified_by_person_id) where verified_by_person_id is not null;
create index reading_curriculum_versions_curriculum_idx on public.reading_curriculum_versions (tenant_id, curriculum_id, version desc);
create index reading_units_version_idx on public.reading_units (tenant_id, curriculum_version_id, sequence);
create index reading_units_parent_idx on public.reading_units (tenant_id, parent_unit_id) where parent_unit_id is not null;
create index reading_attempts_student_idx on public.reading_attempts (tenant_id, student_person_id, occurred_at desc);
create index reading_attempts_plan_idx on public.reading_attempts (tenant_id, learning_plan_id);
create index reading_attempts_version_idx on public.reading_attempts (tenant_id, curriculum_version_id);
create index reading_attempts_unit_idx on public.reading_attempts (tenant_id, reading_unit_id);
create index reading_attempts_teacher_idx on public.reading_attempts (tenant_id, teacher_person_id, occurred_at desc);
create index reading_attempts_next_idx on public.reading_attempts (tenant_id, next_unit_id) where next_unit_id is not null;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'learning_plans','learning_plan_items','recitation_sessions','recitation_attempts',
    'recitation_mistakes','revision_obligations','learning_strength_snapshots',
    'learning_milestones','reading_curricula','reading_curriculum_versions',
    'reading_units','reading_attempts'
  ] loop
    execute format(
      'create trigger %I before update of tenant_id on public.%I for each row execute function private.enforce_immutable_tenant_id()',
      table_name || '_immutable_tenant', table_name
    );
  end loop;
end;
$$;

create trigger recitation_attempts_append_only before update or delete on public.recitation_attempts
  for each row execute function private.reject_append_only_mutation();
create trigger recitation_mistakes_append_only before update or delete on public.recitation_mistakes
  for each row execute function private.reject_append_only_mutation();
create trigger learning_strength_append_only before update or delete on public.learning_strength_snapshots
  for each row execute function private.reject_append_only_mutation();
create trigger reading_attempts_append_only before update or delete on public.reading_attempts
  for each row execute function private.reject_append_only_mutation();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'quran_editions','quran_references','quran_page_mappings','learning_plans','learning_plan_items',
    'recitation_sessions','recitation_attempts','recitation_mistakes','revision_obligations',
    'learning_strength_snapshots','learning_milestones','reading_curricula',
    'reading_curriculum_versions','reading_units','reading_attempts'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

grant select on table
  public.quran_editions, public.quran_references, public.quran_page_mappings,
  public.learning_plans, public.learning_plan_items, public.recitation_sessions,
  public.recitation_attempts, public.recitation_mistakes, public.revision_obligations,
  public.learning_strength_snapshots, public.learning_milestones, public.reading_curricula,
  public.reading_curriculum_versions, public.reading_units, public.reading_attempts
to authenticated;

create policy quran_editions_authenticated_read on public.quran_editions for select to authenticated using (true);
create policy quran_references_authenticated_read on public.quran_references for select to authenticated using (true);
create policy quran_page_mappings_authenticated_read on public.quran_page_mappings for select to authenticated using (true);
create policy learning_plans_scoped_read on public.learning_plans for select to authenticated using (
  private.has_permission(tenant_id, 'learning.plan.read', null)
);
create policy learning_plan_items_scoped_read on public.learning_plan_items for select to authenticated using (
  private.has_permission(tenant_id, 'learning.plan.read', null)
);
create policy recitation_sessions_scoped_read on public.recitation_sessions for select to authenticated using (
  private.has_permission(tenant_id, 'learning.recitation.read', branch_id)
);
create policy recitation_attempts_scoped_read on public.recitation_attempts for select to authenticated using (
  private.has_permission(tenant_id, 'learning.recitation.read', null)
  or private.has_relationship(tenant_id, student_person_id::text, 'read')
);
create policy recitation_mistakes_staff_read on public.recitation_mistakes for select to authenticated using (
  private.has_permission(tenant_id, 'learning.recitation.read', null)
);
create policy revision_obligations_scoped_read on public.revision_obligations for select to authenticated using (
  private.has_permission(tenant_id, 'learning.recitation.read', null)
  or private.has_relationship(tenant_id, student_person_id::text, 'read')
);
create policy learning_strength_scoped_read on public.learning_strength_snapshots for select to authenticated using (
  private.has_permission(tenant_id, 'learning.recitation.read', null)
  or private.has_relationship(tenant_id, student_person_id::text, 'read')
);
create policy learning_milestones_scoped_read on public.learning_milestones for select to authenticated using (
  private.has_permission(tenant_id, 'learning.plan.read', null)
  or (parent_visible and private.has_relationship(tenant_id, student_person_id::text, 'read'))
);
create policy reading_curricula_scoped_read on public.reading_curricula for select to authenticated using (
  private.has_permission(tenant_id, 'learning.plan.read', null)
);
create policy reading_curriculum_versions_scoped_read on public.reading_curriculum_versions for select to authenticated using (
  private.has_permission(tenant_id, 'learning.plan.read', null)
);
create policy reading_units_scoped_read on public.reading_units for select to authenticated using (
  private.has_permission(tenant_id, 'learning.plan.read', null)
);
create policy reading_attempts_scoped_read on public.reading_attempts for select to authenticated using (
  private.has_permission(tenant_id, 'learning.recitation.read', null)
  or private.has_relationship(tenant_id, student_person_id::text, 'read')
);
