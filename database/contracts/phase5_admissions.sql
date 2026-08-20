-- Phase 5 executable database contract: enquiries, applications, decisions, and conversion.

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
