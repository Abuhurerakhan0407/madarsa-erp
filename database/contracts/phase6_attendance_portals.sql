-- Phase 6 executable database contract: attendance, leave, homework, and portal publications.

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
