-- Phase 4 executable database contract: people, academic foundation, and documents.

insert into public.permissions (code, description) values
  ('people.person.read', 'Read approved person profile fields'),
  ('people.person.manage', 'Create and update person profiles'),
  ('people.relationship.read', 'Read verified person relationships'),
  ('people.relationship.verify', 'Verify or restrict person relationships'),
  ('people.employee.read', 'Read employee profiles'),
  ('people.employee.manage', 'Create and update employee profiles'),
  ('academics.structure.read', 'Read academic structure and calendars'),
  ('academics.structure.manage', 'Manage academic structure and calendars'),
  ('academics.enrollment.read', 'Read student enrollments'),
  ('academics.enrollment.manage', 'Create and update enrollments'),
  ('academics.enrollment.transfer', 'Transfer enrollments across groups, programs, or branches'),
  ('academics.timetable.manage', 'Manage timetable entries and conflict resolution')
on conflict (code) do nothing;

create table public.institution_profiles (
  tenant_id bigint primary key references public.tenants(id) on delete restrict,
  legal_name text,
  display_name text not null check (length(btrim(display_name)) between 2 and 160),
  registration_number text,
  email text,
  phone text,
  website text,
  address jsonb not null default '{}'::jsonb,
  supported_locales text[] not null default array['en','ur','ar']::text[],
  primary_locale text not null default 'ur' check (primary_locale in ('en','ur','ar')),
  timezone text not null default 'Asia/Kolkata',
  calendar_mode text not null default 'gregorian_hijri_display'
    check (calendar_mode in ('gregorian','gregorian_hijri_display')),
  logo_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_profiles_locales_check check (
    cardinality(supported_locales) between 1 and 3
    and supported_locales <@ array['en','ur','ar']::text[]
    and primary_locale = any(supported_locales)
  )
);

create table public.persons (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  public_key uuid not null default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 2 and 160),
  name_native text,
  given_name text,
  family_name text,
  date_of_birth date,
  gender text check (gender is null or gender in ('male','female','other','undisclosed')),
  photo_storage_path text,
  preferred_locale text not null default 'ur' check (preferred_locale in ('en','ur','ar')),
  status text not null default 'active' check (status in ('active','inactive','deceased','merged','archived')),
  merged_into_person_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, public_key),
  foreign key (tenant_id, merged_into_person_id)
    references public.persons(tenant_id, id) on delete restrict,
  constraint persons_merge_check check (
    (status = 'merged' and merged_into_person_id is not null and merged_into_person_id <> id)
    or (status <> 'merged' and merged_into_person_id is null)
  )
);

create table public.person_contacts (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  person_id bigint not null,
  type text not null check (type in ('email','phone','whatsapp','address','emergency')),
  label text,
  value text not null check (length(btrim(value)) between 2 and 500),
  normalized_value text,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  consent jsonb not null default '{}'::jsonb,
  visibility text not null default 'restricted' check (visibility in ('restricted','staff','portal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id)
    references public.persons(tenant_id, id) on delete cascade
);

create table public.student_profiles (
  person_id bigint primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  student_number text not null,
  admission_number text,
  joined_on date,
  exited_on date,
  status text not null default 'active'
    check (status in ('applicant','active','paused','transferred','completed','withdrawn','alumni','archived')),
  medical_summary text,
  accessibility_needs text,
  pickup_restrictions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, student_number),
  unique (tenant_id, person_id),
  foreign key (tenant_id, person_id)
    references public.persons(tenant_id, id) on delete restrict,
  constraint student_profiles_dates_check check (
    exited_on is null or joined_on is null or exited_on >= joined_on
  )
);

create table public.guardian_profiles (
  person_id bigint primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  occupation text,
  education text,
  preferred_contact_type text check (
    preferred_contact_type is null or preferred_contact_type in ('email','phone','whatsapp')
  ),
  portal_invitation_status text not null default 'not_invited'
    check (portal_invitation_status in ('not_invited','invited','active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, person_id),
  foreign key (tenant_id, person_id)
    references public.persons(tenant_id, id) on delete restrict
);

create table public.employee_profiles (
  person_id bigint primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  employee_number text not null,
  department_key text,
  designation text,
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time','part_time','contract','volunteer','visiting')),
  joined_on date not null,
  exited_on date,
  status text not null default 'active'
    check (status in ('active','leave','suspended','exited','archived')),
  qualification_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_number),
  unique (tenant_id, person_id),
  foreign key (tenant_id, person_id)
    references public.persons(tenant_id, id) on delete restrict,
  constraint employee_profiles_dates_check check (exited_on is null or exited_on >= joined_on)
);

create table public.person_relationships (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  source_person_id bigint not null,
  target_person_id bigint not null,
  relationship_type text not null check (relationship_type in (
    'father','mother','guardian','sibling','spouse','child','emergency_contact','other'
  )),
  status text not null default 'pending' check (status in ('pending','verified','restricted','revoked')),
  is_primary boolean not null default false,
  can_collect_student boolean not null default false,
  portal_visibility text not null default 'limited' check (portal_visibility in ('none','limited','standard')),
  restriction_flags jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  verified_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_person_id, target_person_id, relationship_type),
  foreign key (tenant_id, source_person_id)
    references public.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, target_person_id)
    references public.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, verified_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint person_relationships_people_differ_check check (source_person_id <> target_person_id),
  constraint person_relationships_verification_check check (
    status <> 'verified' or (verified_at is not null and verified_by_membership_id is not null)
  )
);

create table public.identity_person_links (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  identity_id uuid not null references auth.users(id) on delete restrict,
  person_id bigint not null,
  link_type text not null check (link_type in ('self','guardian','employee','student','donor','sponsor')),
  status text not null default 'pending' check (status in ('pending','verified','revoked')),
  verified_at timestamptz,
  verified_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, identity_id, person_id, link_type),
  foreign key (tenant_id, person_id)
    references public.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, verified_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint identity_person_links_verification_check check (
    status <> 'verified' or (verified_at is not null and verified_by_membership_id is not null)
  )
);

create table public.academic_sessions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  labels jsonb not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft' check (status in ('draft','active','closing','closed','archived')),
  is_default boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id),
  constraint academic_sessions_dates_check check (ends_on > starts_on),
  constraint academic_sessions_close_check check (status <> 'closed' or closed_at is not null)
);

create unique index academic_sessions_default_idx
  on public.academic_sessions (tenant_id)
  where is_default and status = 'active';

create table public.programs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  labels jsonb not null,
  program_type text not null check (program_type in ('general','hifz','nazra','qaida','dars_e_nizami','custom')),
  allows_concurrent_enrollment boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict
);

create table public.academic_levels (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  program_id bigint not null,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  labels jsonb not null,
  sequence integer not null check (sequence >= 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, program_id, key),
  unique (tenant_id, id),
  foreign key (tenant_id, program_id)
    references public.programs(tenant_id, id) on delete restrict
);

create table public.academic_groups (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  session_id bigint not null,
  program_id bigint not null,
  level_id bigint,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  labels jsonb not null,
  capacity integer check (capacity is null or capacity > 0),
  primary_teacher_person_id bigint,
  cohort_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, session_id, key),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id)
    references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, level_id)
    references public.academic_levels(tenant_id, id) on delete restrict,
  foreign key (tenant_id, primary_teacher_person_id)
    references public.persons(tenant_id, id) on delete restrict
);

create table public.subjects (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  labels jsonb not null,
  subject_type text not null default 'academic'
    check (subject_type in ('academic','language','quran','traditional','activity','custom')),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id)
);

create table public.books (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  labels jsonb not null,
  author text,
  edition text,
  isbn text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, id)
);

create table public.curriculum_assignments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  session_id bigint not null,
  program_id bigint not null,
  level_id bigint,
  subject_id bigint not null,
  book_id bigint,
  sequence integer not null default 0 check (sequence >= 0),
  weekly_periods numeric(5,2) check (weekly_periods is null or weekly_periods >= 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, session_id, program_id, level_id, subject_id, book_id),
  foreign key (tenant_id, session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id)
    references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, level_id)
    references public.academic_levels(tenant_id, id) on delete restrict,
  foreign key (tenant_id, subject_id)
    references public.subjects(tenant_id, id) on delete restrict,
  foreign key (tenant_id, book_id)
    references public.books(tenant_id, id) on delete restrict
);

create table public.enrollments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  student_person_id bigint not null,
  session_id bigint not null,
  program_id bigint not null,
  level_id bigint,
  group_id bigint,
  starts_on date not null,
  ends_on date,
  status text not null default 'planned' check (status in (
    'planned','active','paused','transferred','completed','withdrawn','cancelled'
  )),
  exit_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id)
    references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, level_id)
    references public.academic_levels(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id)
    references public.academic_groups(tenant_id, id) on delete restrict,
  constraint enrollments_dates_check check (ends_on is null or ends_on >= starts_on)
);

create unique index enrollments_active_program_idx
  on public.enrollments (tenant_id, student_person_id, session_id, program_id)
  where status = 'active';

create table public.enrollment_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  enrollment_id bigint not null,
  event_type text not null check (event_type in (
    'created','activated','paused','resumed','group_changed','level_changed',
    'transferred','completed','withdrawn','cancelled'
  )),
  from_state jsonb,
  to_state jsonb not null,
  reason text,
  actor_membership_id bigint,
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, enrollment_id)
    references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_membership_id)
    references public.memberships(tenant_id, id) on delete restrict
);

create table public.academic_calendar_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  session_id bigint not null,
  event_type text not null check (event_type in ('working_day','holiday','event','exam_window','closure')),
  labels jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  affects_attendance boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  constraint academic_calendar_events_dates_check check (ends_at > starts_at)
);

create table public.timetable_slots (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  labels jsonb not null,
  starts_at time not null,
  ends_at time not null,
  sequence integer not null check (sequence >= 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, key),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  constraint timetable_slots_times_check check (ends_at > starts_at)
);

create table public.timetable_entries (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  session_id bigint not null,
  group_id bigint not null,
  slot_id bigint not null,
  subject_id bigint,
  teacher_person_id bigint,
  room_key text,
  weekday smallint not null check (weekday between 1 and 7),
  effective_from date not null,
  effective_to date,
  status text not null default 'active' check (status in ('active','cancelled','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, group_id, weekday, slot_id, effective_from),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id)
    references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, slot_id)
    references public.timetable_slots(tenant_id, id) on delete restrict,
  foreign key (tenant_id, subject_id)
    references public.subjects(tenant_id, id) on delete restrict,
  foreign key (tenant_id, teacher_person_id)
    references public.employee_profiles(tenant_id, person_id) on delete restrict,
  constraint timetable_entries_dates_check check (effective_to is null or effective_to >= effective_from)
);

create table public.documents (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  category text not null check (length(btrim(category)) between 2 and 80),
  title text not null check (length(btrim(title)) between 2 and 200),
  status text not null default 'active' check (status in ('draft','active','expired','revoked','archived')),
  visibility text not null default 'restricted' check (visibility in ('restricted','staff','portal','public_verification')),
  issued_on date,
  expires_on date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  constraint documents_dates_check check (expires_on is null or issued_on is null or expires_on >= issued_on)
);

create table public.document_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  document_id bigint not null,
  version integer not null check (version > 0),
  storage_path text not null check (storage_path ~ ('^' || tenant_id::text || '/')),
  file_name text not null check (length(btrim(file_name)) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  checksum text not null check (length(checksum) between 32 and 128),
  uploaded_by_membership_id bigint,
  created_at timestamptz not null default now(),
  unique (tenant_id, document_id, version),
  foreign key (tenant_id, document_id)
    references public.documents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, uploaded_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict
);

create table public.document_links (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  document_id bigint not null,
  target_type text not null check (target_type in (
    'person','student','employee','application','enrollment','exam','receipt','donation','payroll','tenant','branch'
  )),
  target_key text not null check (length(btrim(target_key)) between 1 and 160),
  relationship_visibility text not null default 'restricted'
    check (relationship_visibility in ('restricted','staff','linked_portal')),
  created_at timestamptz not null default now(),
  unique (tenant_id, document_id, target_type, target_key),
  foreign key (tenant_id, document_id)
    references public.documents(tenant_id, id) on delete cascade
);

create index persons_merged_into_idx on public.persons (tenant_id, merged_into_person_id)
  where merged_into_person_id is not null;
create index persons_name_idx on public.persons (tenant_id, status, display_name);
create index person_contacts_person_idx on public.person_contacts (tenant_id, person_id, type);
create index person_contacts_normalized_idx on public.person_contacts (tenant_id, normalized_value)
  where normalized_value is not null;
create index person_relationships_target_idx on public.person_relationships (tenant_id, target_person_id, status);
create index person_relationships_source_idx on public.person_relationships (tenant_id, source_person_id, status);
create index person_relationships_verifier_idx on public.person_relationships (tenant_id, verified_by_membership_id)
  where verified_by_membership_id is not null;
create index identity_person_links_person_idx on public.identity_person_links (tenant_id, person_id, status);
create index identity_person_links_identity_idx on public.identity_person_links (identity_id, tenant_id, status);
create index identity_person_links_verifier_idx on public.identity_person_links (tenant_id, verified_by_membership_id)
  where verified_by_membership_id is not null;
create index programs_branch_idx on public.programs (tenant_id, branch_id, status)
  where branch_id is not null;
create index academic_levels_program_idx on public.academic_levels (tenant_id, program_id, sequence);
create index academic_groups_branch_idx on public.academic_groups (tenant_id, branch_id, session_id, status);
create index academic_groups_session_idx on public.academic_groups (tenant_id, session_id, program_id, level_id);
create index academic_groups_program_idx on public.academic_groups (tenant_id, program_id, level_id);
create index academic_groups_level_idx on public.academic_groups (tenant_id, level_id)
  where level_id is not null;
create index academic_groups_teacher_idx on public.academic_groups (tenant_id, primary_teacher_person_id)
  where primary_teacher_person_id is not null;
create index curriculum_assignments_session_idx on public.curriculum_assignments (tenant_id, session_id, program_id);
create index curriculum_assignments_program_idx on public.curriculum_assignments (tenant_id, program_id, level_id);
create index curriculum_assignments_level_idx on public.curriculum_assignments (tenant_id, level_id)
  where level_id is not null;
create index curriculum_assignments_subject_idx on public.curriculum_assignments (tenant_id, subject_id);
create index curriculum_assignments_book_idx on public.curriculum_assignments (tenant_id, book_id)
  where book_id is not null;
create index enrollments_roster_idx on public.enrollments (tenant_id, group_id, status, student_person_id);
create index enrollments_student_idx on public.enrollments (tenant_id, student_person_id, session_id, status);
create index enrollments_branch_idx on public.enrollments (tenant_id, branch_id, session_id, status);
create index enrollments_session_idx on public.enrollments (tenant_id, session_id, program_id, status);
create index enrollments_program_idx on public.enrollments (tenant_id, program_id, level_id, status);
create index enrollments_level_idx on public.enrollments (tenant_id, level_id) where level_id is not null;
create index enrollment_events_enrollment_idx on public.enrollment_events (tenant_id, enrollment_id, occurred_at desc);
create index enrollment_events_actor_idx on public.enrollment_events (tenant_id, actor_membership_id)
  where actor_membership_id is not null;
create index academic_calendar_events_session_idx on public.academic_calendar_events (tenant_id, session_id, starts_at);
create index academic_calendar_events_branch_idx on public.academic_calendar_events (tenant_id, branch_id, starts_at)
  where branch_id is not null;
create index timetable_slots_branch_idx on public.timetable_slots (tenant_id, branch_id, status, sequence);
create index timetable_entries_group_idx on public.timetable_entries (tenant_id, group_id, weekday, effective_from);
create index timetable_entries_teacher_idx on public.timetable_entries (tenant_id, teacher_person_id, weekday, effective_from)
  where teacher_person_id is not null and status = 'active';
create index timetable_entries_branch_idx on public.timetable_entries (tenant_id, branch_id, session_id, weekday);
create index timetable_entries_session_idx on public.timetable_entries (tenant_id, session_id, weekday);
create index timetable_entries_slot_idx on public.timetable_entries (tenant_id, slot_id);
create index timetable_entries_subject_idx on public.timetable_entries (tenant_id, subject_id)
  where subject_id is not null;
create index documents_branch_idx on public.documents (tenant_id, branch_id, status)
  where branch_id is not null;
create index document_versions_document_idx on public.document_versions (tenant_id, document_id, version desc);
create index document_versions_uploader_idx on public.document_versions (tenant_id, uploaded_by_membership_id)
  where uploaded_by_membership_id is not null;
create index document_links_target_idx on public.document_links (tenant_id, target_type, target_key);

create trigger persons_immutable_tenant before update of tenant_id on public.persons
  for each row execute function private.enforce_immutable_tenant_id();
create trigger person_contacts_immutable_tenant before update of tenant_id on public.person_contacts
  for each row execute function private.enforce_immutable_tenant_id();
create trigger student_profiles_immutable_tenant before update of tenant_id on public.student_profiles
  for each row execute function private.enforce_immutable_tenant_id();
create trigger guardian_profiles_immutable_tenant before update of tenant_id on public.guardian_profiles
  for each row execute function private.enforce_immutable_tenant_id();
create trigger employee_profiles_immutable_tenant before update of tenant_id on public.employee_profiles
  for each row execute function private.enforce_immutable_tenant_id();
create trigger person_relationships_immutable_tenant before update of tenant_id on public.person_relationships
  for each row execute function private.enforce_immutable_tenant_id();
create trigger identity_person_links_immutable_tenant before update of tenant_id on public.identity_person_links
  for each row execute function private.enforce_immutable_tenant_id();
create trigger academic_sessions_immutable_tenant before update of tenant_id on public.academic_sessions
  for each row execute function private.enforce_immutable_tenant_id();
create trigger programs_immutable_tenant before update of tenant_id on public.programs
  for each row execute function private.enforce_immutable_tenant_id();
create trigger academic_levels_immutable_tenant before update of tenant_id on public.academic_levels
  for each row execute function private.enforce_immutable_tenant_id();
create trigger academic_groups_immutable_tenant before update of tenant_id on public.academic_groups
  for each row execute function private.enforce_immutable_tenant_id();
create trigger subjects_immutable_tenant before update of tenant_id on public.subjects
  for each row execute function private.enforce_immutable_tenant_id();
create trigger books_immutable_tenant before update of tenant_id on public.books
  for each row execute function private.enforce_immutable_tenant_id();
create trigger curriculum_assignments_immutable_tenant before update of tenant_id on public.curriculum_assignments
  for each row execute function private.enforce_immutable_tenant_id();
create trigger enrollments_immutable_tenant before update of tenant_id on public.enrollments
  for each row execute function private.enforce_immutable_tenant_id();
create trigger enrollment_events_append_only before update or delete on public.enrollment_events
  for each row execute function private.reject_append_only_mutation();
create trigger academic_calendar_events_immutable_tenant before update of tenant_id on public.academic_calendar_events
  for each row execute function private.enforce_immutable_tenant_id();
create trigger timetable_slots_immutable_tenant before update of tenant_id on public.timetable_slots
  for each row execute function private.enforce_immutable_tenant_id();
create trigger timetable_entries_immutable_tenant before update of tenant_id on public.timetable_entries
  for each row execute function private.enforce_immutable_tenant_id();
create trigger documents_immutable_tenant before update of tenant_id on public.documents
  for each row execute function private.enforce_immutable_tenant_id();
create trigger document_versions_append_only before update or delete on public.document_versions
  for each row execute function private.reject_append_only_mutation();
create trigger document_links_immutable_tenant before update of tenant_id on public.document_links
  for each row execute function private.enforce_immutable_tenant_id();

alter table public.institution_profiles enable row level security;
alter table public.institution_profiles force row level security;
alter table public.persons enable row level security;
alter table public.persons force row level security;
alter table public.person_contacts enable row level security;
alter table public.person_contacts force row level security;
alter table public.student_profiles enable row level security;
alter table public.student_profiles force row level security;
alter table public.guardian_profiles enable row level security;
alter table public.guardian_profiles force row level security;
alter table public.employee_profiles enable row level security;
alter table public.employee_profiles force row level security;
alter table public.person_relationships enable row level security;
alter table public.person_relationships force row level security;
alter table public.identity_person_links enable row level security;
alter table public.identity_person_links force row level security;
alter table public.academic_sessions enable row level security;
alter table public.academic_sessions force row level security;
alter table public.programs enable row level security;
alter table public.programs force row level security;
alter table public.academic_levels enable row level security;
alter table public.academic_levels force row level security;
alter table public.academic_groups enable row level security;
alter table public.academic_groups force row level security;
alter table public.subjects enable row level security;
alter table public.subjects force row level security;
alter table public.books enable row level security;
alter table public.books force row level security;
alter table public.curriculum_assignments enable row level security;
alter table public.curriculum_assignments force row level security;
alter table public.enrollments enable row level security;
alter table public.enrollments force row level security;
alter table public.enrollment_events enable row level security;
alter table public.enrollment_events force row level security;
alter table public.academic_calendar_events enable row level security;
alter table public.academic_calendar_events force row level security;
alter table public.timetable_slots enable row level security;
alter table public.timetable_slots force row level security;
alter table public.timetable_entries enable row level security;
alter table public.timetable_entries force row level security;
alter table public.documents enable row level security;
alter table public.documents force row level security;
alter table public.document_versions enable row level security;
alter table public.document_versions force row level security;
alter table public.document_links enable row level security;
alter table public.document_links force row level security;

revoke all on table
  public.institution_profiles,
  public.persons,
  public.person_contacts,
  public.student_profiles,
  public.guardian_profiles,
  public.employee_profiles,
  public.person_relationships,
  public.identity_person_links,
  public.academic_sessions,
  public.programs,
  public.academic_levels,
  public.academic_groups,
  public.subjects,
  public.books,
  public.curriculum_assignments,
  public.enrollments,
  public.enrollment_events,
  public.academic_calendar_events,
  public.timetable_slots,
  public.timetable_entries,
  public.documents,
  public.document_versions,
  public.document_links
from anon, authenticated;

grant select on table
  public.institution_profiles,
  public.persons,
  public.student_profiles,
  public.guardian_profiles,
  public.employee_profiles,
  public.academic_sessions,
  public.programs,
  public.academic_levels,
  public.academic_groups,
  public.subjects,
  public.books,
  public.curriculum_assignments,
  public.enrollments,
  public.academic_calendar_events,
  public.timetable_slots,
  public.timetable_entries,
  public.documents,
  public.document_versions
to authenticated;

create policy institution_profiles_member_read on public.institution_profiles
  for select to authenticated using (private.has_tenant_membership(tenant_id));
create policy persons_scoped_read on public.persons
  for select to authenticated using (
    private.has_permission(tenant_id, 'people.person.read', null)
    or private.has_permission(tenant_id, 'students.profile.read', null)
    or private.has_relationship(tenant_id, id::text, 'read')
  );
create policy student_profiles_scoped_read on public.student_profiles
  for select to authenticated using (
    private.has_permission(tenant_id, 'students.profile.read', null)
    or private.has_relationship(tenant_id, person_id::text, 'read')
  );
create policy guardian_profiles_scoped_read on public.guardian_profiles
  for select to authenticated using (private.has_permission(tenant_id, 'people.person.read', null));
create policy employee_profiles_scoped_read on public.employee_profiles
  for select to authenticated using (private.has_permission(tenant_id, 'people.employee.read', null));
create policy academic_sessions_scoped_read on public.academic_sessions
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', null));
create policy programs_scoped_read on public.programs
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', branch_id));
create policy academic_levels_scoped_read on public.academic_levels
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', null));
create policy academic_groups_scoped_read on public.academic_groups
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', branch_id));
create policy subjects_scoped_read on public.subjects
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', null));
create policy books_scoped_read on public.books
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', null));
create policy curriculum_assignments_scoped_read on public.curriculum_assignments
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', null));
create policy enrollments_scoped_read on public.enrollments
  for select to authenticated using (
    private.has_permission(tenant_id, 'academics.enrollment.read', branch_id)
    or private.has_relationship(tenant_id, student_person_id::text, 'read')
  );
create policy academic_calendar_events_scoped_read on public.academic_calendar_events
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', branch_id));
create policy timetable_slots_scoped_read on public.timetable_slots
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', branch_id));
create policy timetable_entries_scoped_read on public.timetable_entries
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', branch_id));
create policy documents_scoped_read on public.documents
  for select to authenticated using (private.has_permission(tenant_id, 'documents.file.read', branch_id));
create policy document_versions_scoped_read on public.document_versions
  for select to authenticated using (private.has_permission(tenant_id, 'documents.file.read', null));
