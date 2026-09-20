
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

insert into public.permissions (code, description) values
  ('admissions.enquiry.read', 'Read scoped admission enquiries'),
  ('admissions.enquiry.manage', 'Create and update scoped admission enquiries'),
  ('admissions.application.read', 'Read scoped admission applications'),
  ('admissions.application.review', 'Review submitted applications and documents'),
  ('admissions.application.decide', 'Accept, waitlist, or reject applications'),
  ('admissions.application.override', 'Override admission capacity or eligibility with reason'),
  ('admissions.application.convert', 'Convert accepted applications into students and enrollments'),
  ('admissions.application.export', 'Export scoped admission records'),
  ('admissions.waitlist.manage', 'Manage admission waitlist ordering'),
  ('admissions.assessment.manage', 'Schedule and record admission assessments')
on conflict (code) do nothing;

create table public.enquiries (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  session_id bigint,
  program_id bigint,
  opaque_key uuid not null default gen_random_uuid(),
  applicant_name text not null check (length(btrim(applicant_name)) between 2 and 160),
  guardian_name text,
  normalized_phone text,
  normalized_email text,
  preferred_locale text not null default 'ur' check (preferred_locale in ('en','ur','ar')),
  source text,
  consent jsonb not null default '{}'::jsonb,
  owner_membership_id bigint,
  status text not null default 'new'
    check (status in ('new','contacted','qualified','application_started','converted','lost','archived')),
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, opaque_key),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id)
    references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, owner_membership_id)
    references public.memberships(tenant_id, id) on delete restrict
);

create table public.applications (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  enquiry_id bigint,
  session_id bigint not null,
  program_id bigint not null,
  form_version_id bigint not null,
  workflow_version_id bigint not null,
  tracking_id uuid not null default gen_random_uuid(),
  tracking_secret_hash text not null check (length(tracking_secret_hash) between 32 and 128),
  applicant_person_id bigint,
  guardian_person_id bigint,
  applicant_data jsonb not null default '{}'::jsonb,
  state text not null default 'draft' check (state in (
    'draft','submitted','verification','assessment','decision','offered','waitlisted',
    'rejected','payment_pending','enrolled','expired','withdrawn'
  )),
  revision integer not null default 1 check (revision > 0),
  preferred_locale text not null default 'ur' check (preferred_locale in ('en','ur','ar')),
  consent jsonb not null default '{}'::jsonb,
  duplicate_review_status text not null default 'not_checked'
    check (duplicate_review_status in ('not_checked','clear','possible','resolved')),
  expires_at timestamptz,
  submitted_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, tracking_id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, enquiry_id)
    references public.enquiries(tenant_id, id) on delete restrict,
  foreign key (tenant_id, session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id)
    references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, form_version_id)
    references public.form_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, workflow_version_id)
    references public.workflow_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, applicant_person_id)
    references public.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, guardian_person_id)
    references public.persons(tenant_id, id) on delete restrict,
  constraint applications_submission_check check (
    state = 'draft' or submitted_at is not null
  ),
  constraint applications_conversion_check check (
    state <> 'enrolled' or converted_at is not null
  )
);

create table public.application_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  application_id bigint not null,
  revision integer not null check (revision > 0),
  core_answers jsonb not null,
  custom_answers jsonb not null default '{}'::jsonb,
  validation_snapshot jsonb not null default '{}'::jsonb,
  submitted_by_identity_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tenant_id, application_id, revision),
  foreign key (tenant_id, application_id)
    references public.applications(tenant_id, id) on delete restrict
);

create table public.application_documents (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  application_id bigint not null,
  document_id bigint not null,
  requirement_key text not null check (length(btrim(requirement_key)) between 1 and 80),
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired','waived')),
  reason text,
  reupload_due_at timestamptz,
  verified_by_membership_id bigint,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, application_id, requirement_key, document_id),
  foreign key (tenant_id, application_id)
    references public.applications(tenant_id, id) on delete restrict,
  foreign key (tenant_id, document_id)
    references public.documents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, verified_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint application_documents_reason_check check (
    status not in ('rejected','waived') or length(btrim(reason)) >= 8
  ),
  constraint application_documents_verified_check check (
    status <> 'verified' or (verified_at is not null and verified_by_membership_id is not null)
  )
);

create table public.application_reviews (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  application_id bigint not null,
  review_type text not null check (review_type in ('completeness','eligibility','duplicate','document','final')),
  outcome text not null check (outcome in ('pending','pass','fail','needs_information','overridden')),
  notes text,
  reviewer_membership_id bigint not null,
  reviewed_revision integer not null check (reviewed_revision > 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, application_id)
    references public.applications(tenant_id, id) on delete restrict,
  foreign key (tenant_id, reviewer_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint application_reviews_notes_check check (
    outcome not in ('fail','needs_information','overridden') or length(btrim(notes)) >= 8
  )
);

create table public.admission_assessments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  application_id bigint not null,
  assessment_type text not null check (assessment_type in ('interview','entrance_test','placement','hifz_evaluation')),
  scheduled_at timestamptz,
  evaluator_membership_id bigint,
  criteria_version jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  recommendation text check (recommendation is null or recommendation in ('accept','waitlist','reject','reassess')),
  remarks text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, application_id)
    references public.applications(tenant_id, id) on delete restrict,
  foreign key (tenant_id, evaluator_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint admission_assessments_completion_check check (
    status <> 'completed' or completed_at is not null
  )
);

create table public.admission_decisions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  application_id bigint not null,
  outcome text not null check (outcome in ('offered','waitlisted','rejected')),
  reason text not null check (length(btrim(reason)) >= 8),
  overrides jsonb not null default '[]'::jsonb,
  application_revision integer not null check (application_revision > 0),
  decided_by_membership_id bigint not null,
  decided_at timestamptz not null default now(),
  supersedes_decision_id bigint,
  unique (tenant_id, id),
  foreign key (tenant_id, application_id)
    references public.applications(tenant_id, id) on delete restrict,
  foreign key (tenant_id, decided_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, supersedes_decision_id)
    references public.admission_decisions(tenant_id, id) on delete restrict,
  constraint admission_decisions_override_reason_check check (
    jsonb_array_length(overrides) = 0 or length(btrim(reason)) >= 20
  )
);

create table public.admission_offers (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  application_id bigint not null,
  decision_id bigint not null,
  offered_program_id bigint not null,
  offered_level_id bigint,
  offered_group_id bigint,
  valid_until timestamptz not null,
  conditions jsonb not null default '[]'::jsonb,
  charge_reference text,
  status text not null default 'active' check (status in ('active','accepted','declined','expired','revoked')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, application_id)
    references public.applications(tenant_id, id) on delete restrict,
  foreign key (tenant_id, decision_id)
    references public.admission_decisions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, offered_program_id)
    references public.programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, offered_level_id)
    references public.academic_levels(tenant_id, id) on delete restrict,
  foreign key (tenant_id, offered_group_id)
    references public.academic_groups(tenant_id, id) on delete restrict,
  constraint admission_offers_validity_check check (valid_until > created_at),
  constraint admission_offers_acceptance_check check (status <> 'accepted' or accepted_at is not null)
);

create table public.waitlist_entries (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  application_id bigint not null,
  program_id bigint not null,
  priority integer not null check (priority > 0),
  status text not null default 'active' check (status in ('active','offered','removed','expired')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, application_id, program_id),
  foreign key (tenant_id, application_id)
    references public.applications(tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id)
    references public.programs(tenant_id, id) on delete restrict
);

create table public.admission_conversions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  application_id bigint not null,
  student_person_id bigint not null,
  enrollment_id bigint not null,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  converted_by_membership_id bigint not null,
  converted_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, application_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, application_id)
    references public.applications(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, enrollment_id)
    references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, converted_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict
);

create table public.admission_followups (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  enquiry_id bigint,
  application_id bigint,
  owner_membership_id bigint,
  due_at timestamptz not null,
  channel text check (channel is null or channel in ('phone','email','whatsapp','in_person')),
  outcome text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, enquiry_id)
    references public.enquiries(tenant_id, id) on delete restrict,
  foreign key (tenant_id, application_id)
    references public.applications(tenant_id, id) on delete restrict,
  foreign key (tenant_id, owner_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint admission_followups_target_check check (
    num_nonnulls(enquiry_id, application_id) = 1
  ),
  constraint admission_followups_completion_check check (
    completed_at is null or length(btrim(outcome)) >= 2
  )
);

create index enquiries_branch_status_idx on public.enquiries (tenant_id, branch_id, status, created_at desc);
create index enquiries_session_idx on public.enquiries (tenant_id, session_id) where session_id is not null;
create index enquiries_program_idx on public.enquiries (tenant_id, program_id) where program_id is not null;
create index enquiries_owner_idx on public.enquiries (tenant_id, owner_membership_id, next_follow_up_at)
  where owner_membership_id is not null;
create index enquiries_phone_idx on public.enquiries (tenant_id, normalized_phone) where normalized_phone is not null;
create index enquiries_email_idx on public.enquiries (tenant_id, normalized_email) where normalized_email is not null;
create index applications_branch_state_idx on public.applications (tenant_id, branch_id, state, created_at desc);
create index applications_enquiry_idx on public.applications (tenant_id, enquiry_id) where enquiry_id is not null;
create index applications_session_idx on public.applications (tenant_id, session_id, state);
create index applications_program_idx on public.applications (tenant_id, program_id, state);
create index applications_form_version_idx on public.applications (tenant_id, form_version_id);
create index applications_workflow_version_idx on public.applications (tenant_id, workflow_version_id);
create index applications_applicant_idx on public.applications (tenant_id, applicant_person_id)
  where applicant_person_id is not null;
create index applications_guardian_idx on public.applications (tenant_id, guardian_person_id)
  where guardian_person_id is not null;
create index application_versions_identity_idx on public.application_versions (submitted_by_identity_id, created_at desc)
  where submitted_by_identity_id is not null;
create index application_documents_application_idx on public.application_documents (tenant_id, application_id, status);
create index application_documents_document_idx on public.application_documents (tenant_id, document_id);
create index application_documents_verifier_idx on public.application_documents (tenant_id, verified_by_membership_id)
  where verified_by_membership_id is not null;
create index application_reviews_application_idx on public.application_reviews (tenant_id, application_id, created_at desc);
create index application_reviews_reviewer_idx on public.application_reviews (tenant_id, reviewer_membership_id);
create index admission_assessments_application_idx on public.admission_assessments (tenant_id, application_id, status);
create index admission_assessments_evaluator_idx on public.admission_assessments (tenant_id, evaluator_membership_id, scheduled_at)
  where evaluator_membership_id is not null;
create index admission_decisions_application_idx on public.admission_decisions (tenant_id, application_id, decided_at desc);
create index admission_decisions_actor_idx on public.admission_decisions (tenant_id, decided_by_membership_id);
create index admission_decisions_supersedes_idx on public.admission_decisions (tenant_id, supersedes_decision_id)
  where supersedes_decision_id is not null;
create index admission_offers_application_idx on public.admission_offers (tenant_id, application_id, status);
create index admission_offers_decision_idx on public.admission_offers (tenant_id, decision_id);
create index admission_offers_program_idx on public.admission_offers (tenant_id, offered_program_id);
create index admission_offers_level_idx on public.admission_offers (tenant_id, offered_level_id)
  where offered_level_id is not null;
create index admission_offers_group_idx on public.admission_offers (tenant_id, offered_group_id)
  where offered_group_id is not null;
create index waitlist_entries_program_idx on public.waitlist_entries (tenant_id, program_id, status, priority);
create index admission_conversions_student_idx on public.admission_conversions (tenant_id, student_person_id);
create index admission_conversions_enrollment_idx on public.admission_conversions (tenant_id, enrollment_id);
create index admission_conversions_actor_idx on public.admission_conversions (tenant_id, converted_by_membership_id);
create index admission_followups_enquiry_idx on public.admission_followups (tenant_id, enquiry_id) where enquiry_id is not null;
create index admission_followups_application_idx on public.admission_followups (tenant_id, application_id) where application_id is not null;
create index admission_followups_owner_idx on public.admission_followups (tenant_id, owner_membership_id, due_at)
  where owner_membership_id is not null and completed_at is null;

create or replace function private.admission_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'draft' then p_to = any(array['submitted','withdrawn','expired'])
    when 'submitted' then p_to = any(array['verification','withdrawn'])
    when 'verification' then p_to = any(array['assessment','decision','withdrawn'])
    when 'assessment' then p_to = any(array['decision','withdrawn'])
    when 'decision' then p_to = any(array['offered','waitlisted','rejected'])
    when 'offered' then p_to = any(array['payment_pending','enrolled','expired','withdrawn'])
    when 'waitlisted' then p_to = any(array['offered','rejected','withdrawn','expired'])
    when 'payment_pending' then p_to = any(array['enrolled','expired','withdrawn'])
    else false
  end;
$$;

create or replace function private.enforce_admission_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state is distinct from old.state and not private.admission_transition_allowed(old.state, new.state) then
    raise exception 'admission transition is not allowed: % -> %', old.state, new.state;
  end if;
  if new.revision <= old.revision then
    raise exception 'application revision must increase';
  end if;
  return new;
end;
$$;

create or replace function private.convert_admission(
  p_tenant_id bigint,
  p_application_id bigint,
  p_student_number text,
  p_idempotency_key text,
  p_actor_membership_id bigint
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
  existing_conversion_id bigint;
  new_person_id bigint;
  new_enrollment_id bigint;
  new_conversion_id bigint;
  enrollment_start date;
begin
  if length(btrim(p_idempotency_key)) < 16 then
    raise exception 'idempotency key is too short';
  end if;

  select id into existing_conversion_id
  from public.admission_conversions
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;

  if existing_conversion_id is not null then
    return existing_conversion_id;
  end if;

  select * into application_record
  from public.applications
  where tenant_id = p_tenant_id and id = p_application_id
  for update;

  if application_record.id is null then raise exception 'application not found'; end if;
  if application_record.state not in ('offered','payment_pending') then
    raise exception 'application is not ready for conversion';
  end if;

  insert into public.persons (tenant_id, display_name, name_native, date_of_birth, preferred_locale)
  values (
    p_tenant_id,
    application_record.applicant_data->>'display_name',
    application_record.applicant_data->>'name_native',
    nullif(application_record.applicant_data->>'date_of_birth','')::date,
    application_record.preferred_locale
  )
  returning id into new_person_id;

  insert into public.student_profiles (tenant_id, person_id, student_number, joined_on, status)
  values (p_tenant_id, new_person_id, p_student_number, current_date, 'active');

  select greatest(current_date, starts_on) into enrollment_start
  from public.academic_sessions
  where tenant_id = p_tenant_id and id = application_record.session_id;

  insert into public.enrollments (
    tenant_id, branch_id, student_person_id, session_id, program_id, starts_on, status
  ) values (
    p_tenant_id, application_record.branch_id, new_person_id,
    application_record.session_id, application_record.program_id, enrollment_start, 'active'
  ) returning id into new_enrollment_id;

  insert into public.admission_conversions (
    tenant_id, application_id, student_person_id, enrollment_id, idempotency_key, converted_by_membership_id
  ) values (
    p_tenant_id, p_application_id, new_person_id, new_enrollment_id, p_idempotency_key, p_actor_membership_id
  ) returning id into new_conversion_id;

  update public.applications
  set state = 'enrolled', revision = revision + 1, converted_at = now(), updated_at = now()
  where tenant_id = p_tenant_id and id = p_application_id;

  return new_conversion_id;
end;
$$;

revoke all on function private.admission_transition_allowed(text, text) from public, anon, authenticated;
revoke all on function private.enforce_admission_transition() from public, anon, authenticated;
revoke all on function private.convert_admission(bigint, bigint, text, text, bigint) from public, anon, authenticated;
grant execute on function private.convert_admission(bigint, bigint, text, text, bigint) to service_role;

create trigger applications_enforce_transition
  before update of state, revision on public.applications
  for each row execute function private.enforce_admission_transition();

create trigger enquiries_immutable_tenant before update of tenant_id on public.enquiries
  for each row execute function private.enforce_immutable_tenant_id();
create trigger applications_immutable_tenant before update of tenant_id on public.applications
  for each row execute function private.enforce_immutable_tenant_id();
create trigger application_versions_append_only before update or delete on public.application_versions
  for each row execute function private.reject_append_only_mutation();
create trigger application_documents_immutable_tenant before update of tenant_id on public.application_documents
  for each row execute function private.enforce_immutable_tenant_id();
create trigger application_reviews_append_only before update or delete on public.application_reviews
  for each row execute function private.reject_append_only_mutation();
create trigger admission_assessments_immutable_tenant before update of tenant_id on public.admission_assessments
  for each row execute function private.enforce_immutable_tenant_id();
create trigger admission_decisions_append_only before update or delete on public.admission_decisions
  for each row execute function private.reject_append_only_mutation();
create trigger admission_offers_immutable_tenant before update of tenant_id on public.admission_offers
  for each row execute function private.enforce_immutable_tenant_id();
create trigger waitlist_entries_immutable_tenant before update of tenant_id on public.waitlist_entries
  for each row execute function private.enforce_immutable_tenant_id();
create trigger admission_conversions_append_only before update or delete on public.admission_conversions
  for each row execute function private.reject_append_only_mutation();
create trigger admission_followups_immutable_tenant before update of tenant_id on public.admission_followups
  for each row execute function private.enforce_immutable_tenant_id();

alter table public.enquiries enable row level security;
alter table public.enquiries force row level security;
alter table public.applications enable row level security;
alter table public.applications force row level security;
alter table public.application_versions enable row level security;
alter table public.application_versions force row level security;
alter table public.application_documents enable row level security;
alter table public.application_documents force row level security;
alter table public.application_reviews enable row level security;
alter table public.application_reviews force row level security;
alter table public.admission_assessments enable row level security;
alter table public.admission_assessments force row level security;
alter table public.admission_decisions enable row level security;
alter table public.admission_decisions force row level security;
alter table public.admission_offers enable row level security;
alter table public.admission_offers force row level security;
alter table public.waitlist_entries enable row level security;
alter table public.waitlist_entries force row level security;
alter table public.admission_conversions enable row level security;
alter table public.admission_conversions force row level security;
alter table public.admission_followups enable row level security;
alter table public.admission_followups force row level security;

revoke all on table
  public.enquiries, public.applications, public.application_versions,
  public.application_documents, public.application_reviews, public.admission_assessments,
  public.admission_decisions, public.admission_offers, public.waitlist_entries,
  public.admission_conversions, public.admission_followups
from anon, authenticated;

grant select on table
  public.enquiries, public.applications, public.application_versions,
  public.application_documents, public.application_reviews, public.admission_assessments,
  public.admission_decisions, public.admission_offers, public.waitlist_entries,
  public.admission_conversions, public.admission_followups
to authenticated;

create policy enquiries_scoped_read on public.enquiries
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.enquiry.read', branch_id));
create policy applications_scoped_read on public.applications
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.application.read', branch_id));
create policy application_versions_scoped_read on public.application_versions
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.application.read', null));
create policy application_documents_scoped_read on public.application_documents
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.application.read', null));
create policy application_reviews_scoped_read on public.application_reviews
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.application.review', null));
create policy admission_assessments_scoped_read on public.admission_assessments
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.application.read', null));
create policy admission_decisions_scoped_read on public.admission_decisions
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.application.read', null));
create policy admission_offers_scoped_read on public.admission_offers
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.application.read', null));
create policy waitlist_entries_scoped_read on public.waitlist_entries
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.application.read', null));
create policy admission_conversions_scoped_read on public.admission_conversions
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.application.read', null));
create policy admission_followups_scoped_read on public.admission_followups
  for select to authenticated using (private.has_permission(tenant_id, 'admissions.enquiry.read', null));

insert into public.permissions (code, description) values
  ('attendance.student.read', 'Read scoped student attendance'),
  ('attendance.student.mark', 'Mark scoped student attendance'),
  ('attendance.student.correct', 'Request attendance corrections'),
  ('attendance.student.approve', 'Approve locked attendance corrections'),
  ('attendance.staff.read', 'Read scoped staff attendance'),
  ('attendance.staff.mark', 'Mark scoped staff attendance'),
  ('attendance.hostel.read', 'Read scoped hostel roll calls'),
  ('attendance.hostel.mark', 'Mark scoped hostel roll calls'),
  ('leave.request.read', 'Read scoped leave requests'),
  ('leave.request.manage', 'Create and update leave requests'),
  ('leave.request.approve', 'Approve or reject leave requests'),
  ('academics.homework.read', 'Read scoped homework'),
  ('academics.homework.manage', 'Create and publish homework'),
  ('portal.notice.read', 'Read published portal notices'),
  ('portal.notice.manage', 'Create and publish portal notices')
on conflict (code) do nothing;

create table public.attendance_sessions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  academic_session_id bigint,
  context_type text not null check (context_type in ('student_daily','student_period','employee','hostel','salah')),
  context_key text not null check (length(btrim(context_key)) between 1 and 160),
  attendance_date date not null,
  slot_id bigint,
  status_set_id bigint not null,
  opens_at timestamptz,
  locks_at timestamptz,
  state text not null default 'open' check (state in ('draft','open','submitted','locked','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, context_type, context_key, attendance_date, slot_id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, academic_session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, slot_id)
    references public.timetable_slots(tenant_id, id) on delete restrict,
  foreign key (tenant_id, status_set_id)
    references public.attendance_status_sets(tenant_id, id) on delete restrict,
  constraint attendance_sessions_window_check check (locks_at is null or opens_at is null or locks_at > opens_at)
);

create table public.attendance_rosters (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  attendance_session_id bigint not null,
  group_id bigint,
  generated_from_version text not null,
  member_count integer not null default 0 check (member_count >= 0),
  generated_at timestamptz not null default now(),
  generated_by_membership_id bigint,
  unique (tenant_id, id),
  unique (tenant_id, attendance_session_id, group_id),
  foreign key (tenant_id, attendance_session_id)
    references public.attendance_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id)
    references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, generated_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict
);

create table public.attendance_roster_members (
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  roster_id bigint not null,
  subject_type text not null check (subject_type in ('student','employee','hostel_resident')),
  person_id bigint not null,
  enrollment_id bigint,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, roster_id, person_id),
  foreign key (tenant_id, roster_id)
    references public.attendance_rosters(tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id)
    references public.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, enrollment_id)
    references public.enrollments(tenant_id, id) on delete restrict
);

create table public.attendance_records (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  attendance_session_id bigint not null,
  roster_id bigint not null,
  person_id bigint not null,
  enrollment_id bigint,
  status_key text not null,
  status_category text not null check (status_category in ('present','absent','late','leave','excused','unmarked')),
  presence_ratio numeric(5,4) not null check (presence_ratio between 0 and 1),
  marked_at timestamptz,
  reason text,
  note text,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  marked_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, attendance_session_id, person_id),
  unique (tenant_id, idempotency_key, person_id),
  foreign key (tenant_id, attendance_session_id)
    references public.attendance_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, roster_id, person_id)
    references public.attendance_roster_members(tenant_id, roster_id, person_id) on delete restrict,
  foreign key (tenant_id, enrollment_id)
    references public.enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, marked_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict
);

create table public.attendance_corrections (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  attendance_record_id bigint not null,
  requested_status_key text not null,
  requested_status_category text not null check (requested_status_category in ('present','absent','late','leave','excused','unmarked')),
  requested_presence_ratio numeric(5,4) not null check (requested_presence_ratio between 0 and 1),
  reason text not null check (length(btrim(reason)) >= 8),
  requested_by_membership_id bigint not null,
  state text not null default 'pending' check (state in ('pending','approved','rejected','cancelled')),
  reviewed_by_membership_id bigint,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, attendance_record_id)
    references public.attendance_records(tenant_id, id) on delete restrict,
  foreign key (tenant_id, requested_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, reviewed_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint attendance_corrections_review_check check (
    state not in ('approved','rejected')
    or (reviewed_by_membership_id is not null and reviewed_at is not null and length(btrim(review_reason)) >= 8)
  )
);

create table public.leave_requests (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  subject_type text not null check (subject_type in ('student','employee','hostel_resident')),
  subject_person_id bigint not null,
  requested_by_identity_id uuid references auth.users(id) on delete restrict,
  requested_by_membership_id bigint,
  starts_on date not null,
  ends_on date not null,
  expected_return_at timestamptz,
  actual_return_at timestamptz,
  reason text not null check (length(btrim(reason)) >= 4),
  state text not null default 'draft' check (state in (
    'draft','submitted','reviewed','approved','rejected','active','returned','closed','cancelled'
  )),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, subject_person_id)
    references public.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, requested_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint leave_requests_dates_check check (ends_on >= starts_on),
  constraint leave_requests_return_check check (actual_return_at is null or state in ('returned','closed'))
);

create table public.leave_decisions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  leave_request_id bigint not null,
  decision text not null check (decision in ('reviewed','approved','rejected','return_confirmed','closed')),
  reason text,
  decided_by_membership_id bigint not null,
  request_revision integer not null check (request_revision > 0),
  decided_at timestamptz not null default now(),
  foreign key (tenant_id, leave_request_id)
    references public.leave_requests(tenant_id, id) on delete restrict,
  foreign key (tenant_id, decided_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint leave_decisions_reason_check check (decision <> 'rejected' or length(btrim(reason)) >= 8)
);

create table public.attendance_alerts (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  person_id bigint not null,
  attendance_record_id bigint,
  alert_type text not null check (alert_type in ('absence','late','consecutive_absence','percentage','hostel_unresolved')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  state text not null default 'open' check (state in ('open','acknowledged','resolved','dismissed')),
  notification_event_key text,
  acknowledged_by_membership_id bigint,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id)
    references public.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, attendance_record_id)
    references public.attendance_records(tenant_id, id) on delete restrict,
  foreign key (tenant_id, acknowledged_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict
);

create table public.lesson_plans (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  academic_session_id bigint not null,
  group_id bigint not null,
  subject_id bigint,
  teacher_person_id bigint not null,
  lesson_date date not null,
  title text not null check (length(btrim(title)) between 2 and 200),
  content jsonb not null default '{}'::jsonb,
  visibility text not null default 'private' check (visibility in ('private','staff','portal')),
  state text not null default 'planned' check (state in ('planned','in_progress','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, academic_session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id)
    references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, subject_id)
    references public.subjects(tenant_id, id) on delete restrict,
  foreign key (tenant_id, teacher_person_id)
    references public.employee_profiles(tenant_id, person_id) on delete restrict,
  constraint lesson_plans_completion_check check (state <> 'completed' or completed_at is not null)
);

create table public.homework_assignments (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  academic_session_id bigint not null,
  group_id bigint not null,
  subject_id bigint,
  teacher_person_id bigint not null,
  title text not null check (length(btrim(title)) between 2 and 200),
  instructions text not null check (length(btrim(instructions)) >= 2),
  assigned_at timestamptz,
  due_at timestamptz not null,
  allow_submission boolean not null default false,
  state text not null default 'draft' check (state in ('draft','published','closed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, academic_session_id)
    references public.academic_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, group_id)
    references public.academic_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, subject_id)
    references public.subjects(tenant_id, id) on delete restrict,
  foreign key (tenant_id, teacher_person_id)
    references public.employee_profiles(tenant_id, person_id) on delete restrict,
  constraint homework_assignments_publish_check check (state <> 'published' or assigned_at is not null),
  constraint homework_assignments_due_check check (assigned_at is null or due_at > assigned_at)
);

create table public.homework_submissions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  assignment_id bigint not null,
  student_person_id bigint not null,
  content jsonb not null default '{}'::jsonb,
  state text not null default 'draft' check (state in ('draft','submitted','returned','accepted','late')),
  submitted_at timestamptz,
  reviewed_by_membership_id bigint,
  reviewed_at timestamptz,
  remark text,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, assignment_id, student_person_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, assignment_id)
    references public.homework_assignments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.student_profiles(tenant_id, person_id) on delete restrict,
  foreign key (tenant_id, reviewed_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint homework_submissions_submit_check check (state = 'draft' or submitted_at is not null)
);

create table public.portal_notices (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint,
  audience_type text not null check (audience_type in ('tenant','branch','program','group','parents','students','employees')),
  audience_key text,
  labels jsonb not null,
  body jsonb not null,
  state text not null default 'draft' check (state in ('draft','published','expired','revoked')),
  published_at timestamptz,
  expires_at timestamptz,
  published_by_membership_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id)
    references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, published_by_membership_id)
    references public.memberships(tenant_id, id) on delete restrict,
  constraint portal_notices_publish_check check (
    state <> 'published' or (published_at is not null and published_by_membership_id is not null)
  )
);

create table public.portal_notice_receipts (
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  notice_id bigint not null,
  identity_id uuid not null references auth.users(id) on delete restrict,
  read_at timestamptz not null default now(),
  primary key (tenant_id, notice_id, identity_id),
  foreign key (tenant_id, notice_id)
    references public.portal_notices(tenant_id, id) on delete cascade
);

create index attendance_sessions_branch_idx on public.attendance_sessions (tenant_id, branch_id, attendance_date, context_type);
create index attendance_sessions_academic_idx on public.attendance_sessions (tenant_id, academic_session_id)
  where academic_session_id is not null;
create index attendance_sessions_slot_idx on public.attendance_sessions (tenant_id, slot_id) where slot_id is not null;
create index attendance_sessions_status_set_idx on public.attendance_sessions (tenant_id, status_set_id);
create index attendance_rosters_session_idx on public.attendance_rosters (tenant_id, attendance_session_id);
create index attendance_rosters_group_idx on public.attendance_rosters (tenant_id, group_id) where group_id is not null;
create index attendance_rosters_generator_idx on public.attendance_rosters (tenant_id, generated_by_membership_id)
  where generated_by_membership_id is not null;
create index attendance_roster_members_person_idx on public.attendance_roster_members (tenant_id, person_id, roster_id);
create index attendance_roster_members_enrollment_idx on public.attendance_roster_members (tenant_id, enrollment_id)
  where enrollment_id is not null;
create index attendance_records_person_idx on public.attendance_records (tenant_id, person_id, created_at desc);
create index attendance_records_roster_idx on public.attendance_records (tenant_id, roster_id, person_id);
create index attendance_records_enrollment_idx on public.attendance_records (tenant_id, enrollment_id, created_at desc)
  where enrollment_id is not null;
create index attendance_records_actor_idx on public.attendance_records (tenant_id, marked_by_membership_id);
create index attendance_corrections_record_idx on public.attendance_corrections (tenant_id, attendance_record_id, state);
create index attendance_corrections_requester_idx on public.attendance_corrections (tenant_id, requested_by_membership_id);
create index attendance_corrections_reviewer_idx on public.attendance_corrections (tenant_id, reviewed_by_membership_id)
  where reviewed_by_membership_id is not null;
create index leave_requests_subject_idx on public.leave_requests (tenant_id, subject_person_id, starts_on, ends_on);
create index leave_requests_branch_idx on public.leave_requests (tenant_id, branch_id, state, starts_on);
create index leave_requests_identity_idx on public.leave_requests (requested_by_identity_id, tenant_id)
  where requested_by_identity_id is not null;
create index leave_requests_membership_idx on public.leave_requests (tenant_id, requested_by_membership_id)
  where requested_by_membership_id is not null;
create index leave_decisions_request_idx on public.leave_decisions (tenant_id, leave_request_id, decided_at desc);
create index leave_decisions_actor_idx on public.leave_decisions (tenant_id, decided_by_membership_id);
create index attendance_alerts_branch_idx on public.attendance_alerts (tenant_id, branch_id, state, severity);
create index attendance_alerts_person_idx on public.attendance_alerts (tenant_id, person_id, created_at desc);
create index attendance_alerts_record_idx on public.attendance_alerts (tenant_id, attendance_record_id)
  where attendance_record_id is not null;
create index attendance_alerts_ack_idx on public.attendance_alerts (tenant_id, acknowledged_by_membership_id)
  where acknowledged_by_membership_id is not null;
create index lesson_plans_group_idx on public.lesson_plans (tenant_id, group_id, lesson_date);
create index lesson_plans_branch_idx on public.lesson_plans (tenant_id, branch_id, lesson_date);
create index lesson_plans_session_idx on public.lesson_plans (tenant_id, academic_session_id, lesson_date);
create index lesson_plans_subject_idx on public.lesson_plans (tenant_id, subject_id) where subject_id is not null;
create index lesson_plans_teacher_idx on public.lesson_plans (tenant_id, teacher_person_id, lesson_date);
create index homework_assignments_group_idx on public.homework_assignments (tenant_id, group_id, state, due_at);
create index homework_assignments_branch_idx on public.homework_assignments (tenant_id, branch_id, due_at);
create index homework_assignments_session_idx on public.homework_assignments (tenant_id, academic_session_id);
create index homework_assignments_subject_idx on public.homework_assignments (tenant_id, subject_id) where subject_id is not null;
create index homework_assignments_teacher_idx on public.homework_assignments (tenant_id, teacher_person_id, due_at);
create index homework_submissions_student_idx on public.homework_submissions (tenant_id, student_person_id, state);
create index homework_submissions_reviewer_idx on public.homework_submissions (tenant_id, reviewed_by_membership_id)
  where reviewed_by_membership_id is not null;
create index portal_notices_branch_idx on public.portal_notices (tenant_id, branch_id, state, published_at desc)
  where branch_id is not null;
create index portal_notices_publisher_idx on public.portal_notices (tenant_id, published_by_membership_id)
  where published_by_membership_id is not null;
create index portal_notice_receipts_identity_idx on public.portal_notice_receipts (identity_id, tenant_id, read_at desc);

create or replace function private.leave_transition_allowed(p_from text, p_to text)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'draft' then p_to = any(array['submitted','cancelled'])
    when 'submitted' then p_to = any(array['reviewed','cancelled'])
    when 'reviewed' then p_to = any(array['approved','rejected'])
    when 'approved' then p_to = any(array['active','cancelled'])
    when 'active' then p_to = any(array['returned','closed'])
    when 'returned' then p_to = 'closed'
    else false
  end;
$$;

create or replace function private.enforce_leave_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.state is distinct from old.state and not private.leave_transition_allowed(old.state, new.state) then
    raise exception 'leave transition is not allowed: % -> %', old.state, new.state;
  end if;
  if new.revision <= old.revision then raise exception 'leave revision must increase'; end if;
  return new;
end;
$$;

revoke all on function private.leave_transition_allowed(text, text) from public, anon, authenticated;
revoke all on function private.enforce_leave_transition() from public, anon, authenticated;

create trigger leave_requests_enforce_transition before update of state, revision on public.leave_requests
  for each row execute function private.enforce_leave_transition();
create trigger attendance_records_append_only before update or delete on public.attendance_records
  for each row execute function private.reject_append_only_mutation();
create trigger leave_decisions_append_only before update or delete on public.leave_decisions
  for each row execute function private.reject_append_only_mutation();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'attendance_sessions','attendance_rosters','attendance_roster_members','attendance_corrections',
    'leave_requests','attendance_alerts','lesson_plans','homework_assignments','homework_submissions',
    'portal_notices','portal_notice_receipts'
  ] loop
    execute format(
      'create trigger %I before update of tenant_id on public.%I for each row execute function private.enforce_immutable_tenant_id()',
      table_name || '_immutable_tenant', table_name
    );
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'attendance_sessions','attendance_rosters','attendance_roster_members','attendance_records',
    'attendance_corrections','leave_requests','leave_decisions','attendance_alerts','lesson_plans',
    'homework_assignments','homework_submissions','portal_notices','portal_notice_receipts'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

grant select on table
  public.attendance_sessions, public.attendance_rosters, public.attendance_roster_members,
  public.attendance_records, public.attendance_corrections, public.leave_requests,
  public.leave_decisions, public.attendance_alerts, public.lesson_plans,
  public.homework_assignments, public.homework_submissions, public.portal_notices,
  public.portal_notice_receipts
to authenticated;

create policy attendance_sessions_scoped_read on public.attendance_sessions
  for select to authenticated using (
    private.has_permission(tenant_id, 'attendance.student.read', branch_id)
    or private.has_permission(tenant_id, 'attendance.staff.read', branch_id)
    or private.has_permission(tenant_id, 'attendance.hostel.read', branch_id)
  );
create policy attendance_rosters_scoped_read on public.attendance_rosters
  for select to authenticated using (private.has_permission(tenant_id, 'attendance.student.read', null));
create policy attendance_roster_members_scoped_read on public.attendance_roster_members
  for select to authenticated using (
    private.has_permission(tenant_id, 'attendance.student.read', null)
    or private.has_relationship(tenant_id, person_id::text, 'read')
  );
create policy attendance_records_scoped_read on public.attendance_records
  for select to authenticated using (
    private.has_permission(tenant_id, 'attendance.student.read', null)
    or private.has_permission(tenant_id, 'attendance.staff.read', null)
    or private.has_relationship(tenant_id, person_id::text, 'read')
  );
create policy attendance_corrections_scoped_read on public.attendance_corrections
  for select to authenticated using (private.has_permission(tenant_id, 'attendance.student.read', null));
create policy leave_requests_scoped_read on public.leave_requests
  for select to authenticated using (
    private.has_permission(tenant_id, 'leave.request.read', branch_id)
    or private.has_relationship(tenant_id, subject_person_id::text, 'read')
  );
create policy leave_decisions_scoped_read on public.leave_decisions
  for select to authenticated using (private.has_permission(tenant_id, 'leave.request.read', null));
create policy attendance_alerts_scoped_read on public.attendance_alerts
  for select to authenticated using (
    private.has_permission(tenant_id, 'attendance.student.read', branch_id)
    or private.has_relationship(tenant_id, person_id::text, 'read')
  );
create policy lesson_plans_scoped_read on public.lesson_plans
  for select to authenticated using (private.has_permission(tenant_id, 'academics.structure.read', branch_id));
create policy homework_assignments_scoped_read on public.homework_assignments
  for select to authenticated using (
    state = 'published' and private.has_permission(tenant_id, 'academics.homework.read', branch_id)
  );
create policy homework_submissions_scoped_read on public.homework_submissions
  for select to authenticated using (
    private.has_permission(tenant_id, 'academics.homework.read', null)
    or private.has_relationship(tenant_id, student_person_id::text, 'read')
  );
create policy portal_notices_scoped_read on public.portal_notices
  for select to authenticated using (
    state = 'published' and private.has_tenant_membership(tenant_id)
  );
create policy portal_notice_receipts_self_read on public.portal_notice_receipts
  for select to authenticated using (
    identity_id = (select auth.uid()) and private.has_tenant_membership(tenant_id)
  );

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

insert into public.permissions (code, description) values
  ('document.template.manage', 'Manage document templates'),
  ('document.job.manage', 'Generate and issue documents'),
  ('notification.policy.manage', 'Manage notification policies and templates'),
  ('notification.message.send', 'Send scoped external notifications'),
  ('notification.usage.read', 'Read communication usage and cost'),
  ('data.import.manage', 'Run validated data imports'),
  ('data.export.manage', 'Run scoped exports'),
  ('report.definition.manage', 'Manage report definitions'),
  ('report.run.execute', 'Execute scoped reports')
on conflict (code) do nothing;

create table public.document_templates (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null, document_type text not null,
  labels jsonb not null, state text not null default 'active' check (state in ('active','inactive','archived')),
  unique (tenant_id, id), unique (tenant_id, key)
);

create table public.document_template_versions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  template_id bigint not null, version integer not null check (version > 0),
  locale text not null, direction text not null check (direction in ('ltr','rtl')),
  renderer text not null check (renderer in ('html_pdf','html_image','zpl','json')),
  source text not null, variables jsonb not null, font_manifest jsonb not null,
  layout_rules jsonb not null default '{}'::jsonb,
  state text not null default 'draft' check (state in ('draft','validated','published','superseded','archived')),
  validation_result jsonb not null default '{}'::jsonb, published_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, template_id, version, locale),
  foreign key (tenant_id, template_id) references public.document_templates(tenant_id, id) on delete cascade,
  constraint document_template_publish_check check (state <> 'published' or published_at is not null)
);

create table public.document_generation_jobs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint, template_version_id bigint not null, job_type text not null check (job_type in ('single','bulk')),
  requested_by_membership_id bigint not null, input_digest text not null check (length(input_digest) between 32 and 128),
  input_reference jsonb not null, state text not null default 'queued' check (state in ('queued','running','completed','partial','failed','cancelled')),
  total_items integer not null default 1 check (total_items > 0), completed_items integer not null default 0 check (completed_items >= 0),
  error_summary jsonb not null default '{}'::jsonb, idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, idempotency_key),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, template_version_id) references public.document_template_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, requested_by_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create table public.issued_document_records (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  generation_job_id bigint not null, template_version_id bigint not null, document_id bigint not null,
  subject_type text not null, subject_id text not null, revision integer not null default 1 check (revision > 0),
  verification_code text not null unique, content_digest text not null check (length(content_digest) between 32 and 128),
  state text not null default 'active' check (state in ('active','superseded','revoked','void')),
  issued_at timestamptz not null default now(), state_reason text,
  unique (tenant_id, id), unique (tenant_id, subject_type, subject_id, revision),
  foreign key (tenant_id, generation_job_id) references public.document_generation_jobs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, template_version_id) references public.document_template_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, document_id) references public.documents(tenant_id, id) on delete restrict,
  constraint issued_document_state_reason_check check (state = 'active' or length(btrim(state_reason)) >= 4)
);

create table public.notification_channel_configs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  channel text not null check (channel in ('in_app','email','whatsapp')),
  provider text not null, sender_reference text, encrypted_config_reference text,
  monthly_allowance bigint not null default 0 check (monthly_allowance >= 0), prepaid_units bigint not null default 0 check (prepaid_units >= 0),
  state text not null default 'inactive' check (state in ('active','inactive','suspended','archived')),
  unique (tenant_id, id), unique (tenant_id, channel)
);

create table public.notification_policies (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  event_key text not null, version integer not null check (version > 0),
  channels text[] not null, audience_rules jsonb not null, consent_basis jsonb not null,
  quiet_hours jsonb not null default '{}'::jsonb, retry_policy jsonb not null default '{}'::jsonb,
  state text not null default 'draft' check (state in ('draft','published','superseded','archived')),
  published_at timestamptz, unique (tenant_id, id), unique (tenant_id, event_key, version),
  constraint notification_policy_publish_check check (state <> 'published' or published_at is not null)
);

create table public.notification_templates (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  policy_id bigint not null, channel text not null check (channel in ('in_app','email','whatsapp')),
  locale text not null, provider_template_reference text, category text,
  subject_template text, body_template text not null, required_variables text[] not null default array[]::text[],
  state text not null default 'draft' check (state in ('draft','validated','published','rejected','archived')),
  validation_result jsonb not null default '{}'::jsonb, published_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, policy_id, channel, locale),
  foreign key (tenant_id, policy_id) references public.notification_policies(tenant_id, id) on delete cascade,
  constraint notification_template_publish_check check (state <> 'published' or published_at is not null)
);

create table public.domain_notification_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  event_key text not null, aggregate_type text not null, aggregate_id text not null,
  payload jsonb not null, payload_digest text not null check (length(payload_digest) between 32 and 128),
  occurred_at timestamptz not null, idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(), unique (tenant_id, id), unique (tenant_id, idempotency_key)
);

create table public.notification_recipient_resolutions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  event_id bigint not null, recipient_identity_id uuid not null, related_person_id bigint,
  relationship_evidence jsonb not null, locale text not null, channels text[] not null,
  consent_snapshot jsonb not null, resolved_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id, event_id, recipient_identity_id),
  foreign key (tenant_id, event_id) references public.domain_notification_events(tenant_id, id) on delete cascade,
  foreign key (tenant_id, related_person_id) references public.persons(tenant_id, id) on delete restrict
);

create table public.notification_dispatches (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  event_id bigint not null, recipient_resolution_id bigint not null, template_id bigint not null,
  channel text not null check (channel in ('in_app','email','whatsapp')),
  destination_hash text not null, tokenized_link_reference text,
  rendered_digest text not null check (length(rendered_digest) between 32 and 128),
  provider_message_id text, usage_units numeric(18,4) not null default 0 check (usage_units >= 0),
  estimated_cost numeric(18,4) not null default 0 check (estimated_cost >= 0), currency_code text,
  state text not null default 'queued' check (state in ('queued','sending','sent','delivered','read','failed','blocked','opted_out','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0), last_error jsonb,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(), sent_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, idempotency_key),
  foreign key (tenant_id, event_id) references public.domain_notification_events(tenant_id, id) on delete restrict,
  foreign key (tenant_id, recipient_resolution_id) references public.notification_recipient_resolutions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, template_id) references public.notification_templates(tenant_id, id) on delete restrict
);
create unique index notification_provider_message_idx on public.notification_dispatches (tenant_id, channel, provider_message_id) where provider_message_id is not null;

create table public.notification_delivery_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  dispatch_id bigint not null, provider_event_id text, state text not null,
  signature_verified boolean not null default false, payload_digest text not null check (length(payload_digest) between 32 and 128),
  occurred_at timestamptz not null, received_at timestamptz not null default now(),
  foreign key (tenant_id, dispatch_id) references public.notification_dispatches(tenant_id, id) on delete restrict
);
create unique index notification_delivery_provider_idx on public.notification_delivery_events (tenant_id, provider_event_id) where provider_event_id is not null;

create table public.bulk_message_campaigns (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  policy_id bigint not null, labels jsonb not null, audience_query jsonb not null,
  audience_count integer not null default 0 check (audience_count >= 0), exclusion_count integer not null default 0 check (exclusion_count >= 0),
  estimated_units numeric(18,4) not null default 0, estimated_cost numeric(18,4) not null default 0,
  throttle_per_minute integer not null default 30 check (throttle_per_minute > 0),
  state text not null default 'draft' check (state in ('draft','previewed','approved','queued','sending','completed','partial','cancelled')),
  approved_by_membership_id bigint, approved_at timestamptz, created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, policy_id) references public.notification_policies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, approved_by_membership_id) references public.memberships(tenant_id, id) on delete restrict,
  constraint bulk_campaign_approval_check check (state not in ('approved','queued','sending','completed','partial') or (approved_by_membership_id is not null and approved_at is not null))
);

create table public.communication_usage_daily (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  usage_date date not null, channel text not null, category text not null,
  units numeric(18,4) not null default 0, cost numeric(18,4) not null default 0, currency_code text,
  event_count bigint not null default 0, source_digest text not null,
  unique (tenant_id, usage_date, channel, category)
);

create table public.data_import_jobs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  import_type text not null, source_document_id bigint not null, mapping_version jsonb not null,
  mode text not null check (mode in ('validate','commit')), state text not null default 'queued' check (state in ('queued','validating','validated','committing','completed','partial','failed','cancelled')),
  total_rows integer not null default 0, valid_rows integer not null default 0, invalid_rows integer not null default 0,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128), requested_by_membership_id bigint not null,
  created_at timestamptz not null default now(), unique (tenant_id, id), unique (tenant_id, idempotency_key),
  foreign key (tenant_id, source_document_id) references public.documents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, requested_by_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create table public.data_import_rows (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  import_job_id bigint not null, row_number integer not null check (row_number > 0),
  source_data jsonb not null, normalized_data jsonb, validation_errors jsonb not null default '[]'::jsonb,
  commit_reference jsonb, state text not null check (state in ('valid','invalid','committed','skipped','failed')),
  unique (tenant_id, import_job_id, row_number),
  foreign key (tenant_id, import_job_id) references public.data_import_jobs(tenant_id, id) on delete cascade
);

create table public.report_definitions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  key text not null, labels jsonb not null, version integer not null check (version > 0),
  domain text not null, parameter_schema jsonb not null, query_reference text not null,
  allowed_columns text[] not null, scope_rules jsonb not null,
  state text not null default 'draft' check (state in ('draft','published','superseded','archived')),
  unique (tenant_id, id), unique (tenant_id, key, version)
);

create table public.report_runs (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  report_definition_id bigint not null, parameters jsonb not null, scope_snapshot jsonb not null,
  output_format text not null check (output_format in ('screen','csv','xlsx','pdf','json')),
  state text not null default 'queued' check (state in ('queued','running','completed','failed','expired','cancelled')),
  row_count bigint, output_document_id bigint, output_digest text,
  requested_by_membership_id bigint not null, idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique (tenant_id, id), unique (tenant_id, idempotency_key),
  foreign key (tenant_id, report_definition_id) references public.report_definitions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, output_document_id) references public.documents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, requested_by_membership_id) references public.memberships(tenant_id, id) on delete restrict
);

create index dispatches_state_idx on public.notification_dispatches (tenant_id, state, created_at);
create index domain_events_aggregate_idx on public.domain_notification_events (tenant_id, aggregate_type, aggregate_id, occurred_at desc);
create index import_rows_state_idx on public.data_import_rows (tenant_id, import_job_id, state);
create index report_runs_requester_idx on public.report_runs (tenant_id, requested_by_membership_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'document_templates','document_template_versions','document_generation_jobs','issued_document_records',
    'notification_channel_configs','notification_policies','notification_templates','domain_notification_events',
    'notification_recipient_resolutions','notification_dispatches','notification_delivery_events',
    'bulk_message_campaigns','communication_usage_daily','data_import_jobs','data_import_rows',
    'report_definitions','report_runs'
  ] loop
    execute format('create trigger %I before update of tenant_id on public.%I for each row execute function private.enforce_immutable_tenant_id()', table_name || '_immutable_tenant', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger domain_notification_events_append_only before update or delete on public.domain_notification_events for each row execute function private.reject_append_only_mutation();
create trigger recipient_resolutions_append_only before update or delete on public.notification_recipient_resolutions for each row execute function private.reject_append_only_mutation();
create trigger notification_delivery_events_append_only before update or delete on public.notification_delivery_events for each row execute function private.reject_append_only_mutation();
create trigger communication_usage_append_only before update or delete on public.communication_usage_daily for each row execute function private.reject_append_only_mutation();

grant select on table
  public.document_templates, public.document_template_versions, public.document_generation_jobs,
  public.issued_document_records, public.notification_channel_configs, public.notification_policies,
  public.notification_templates, public.domain_notification_events, public.notification_recipient_resolutions,
  public.notification_dispatches, public.notification_delivery_events, public.bulk_message_campaigns,
  public.communication_usage_daily, public.data_import_jobs, public.data_import_rows,
  public.report_definitions, public.report_runs
to authenticated;

create policy document_templates_staff_read on public.document_templates for select to authenticated using (private.has_permission(tenant_id, 'document.template.manage', null));
create policy document_versions_staff_read on public.document_template_versions for select to authenticated using (private.has_permission(tenant_id, 'document.template.manage', null));
create policy document_jobs_staff_read on public.document_generation_jobs for select to authenticated using (private.has_permission(tenant_id, 'document.job.manage', branch_id));
create policy issued_documents_staff_read on public.issued_document_records for select to authenticated using (private.has_permission(tenant_id, 'document.job.manage', null));
create policy channel_configs_staff_read on public.notification_channel_configs for select to authenticated using (private.has_permission(tenant_id, 'notification.policy.manage', null));
create policy notification_policies_staff_read on public.notification_policies for select to authenticated using (private.has_permission(tenant_id, 'notification.policy.manage', null));
create policy notification_templates_staff_read on public.notification_templates for select to authenticated using (private.has_permission(tenant_id, 'notification.policy.manage', null));
create policy notification_events_staff_read on public.domain_notification_events for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy recipient_resolutions_staff_read on public.notification_recipient_resolutions for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy notification_dispatches_staff_read on public.notification_dispatches for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy delivery_events_staff_read on public.notification_delivery_events for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy bulk_campaigns_staff_read on public.bulk_message_campaigns for select to authenticated using (private.has_permission(tenant_id, 'notification.message.send', null));
create policy communication_usage_staff_read on public.communication_usage_daily for select to authenticated using (private.has_permission(tenant_id, 'notification.usage.read', null));
create policy import_jobs_staff_read on public.data_import_jobs for select to authenticated using (private.has_permission(tenant_id, 'data.import.manage', null));
create policy import_rows_staff_read on public.data_import_rows for select to authenticated using (private.has_permission(tenant_id, 'data.import.manage', null));
create policy report_definitions_staff_read on public.report_definitions for select to authenticated using (private.has_permission(tenant_id, 'report.definition.manage', null));
create policy report_runs_staff_read on public.report_runs for select to authenticated using (private.has_permission(tenant_id, 'report.run.execute', null));

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
