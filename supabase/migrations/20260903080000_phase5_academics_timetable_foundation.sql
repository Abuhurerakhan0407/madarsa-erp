begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.timetable_entries'::regclass
      and conname='timetable_entries_tenant_id_id_key'
  ) then
    alter table public.timetable_entries
      add constraint timetable_entries_tenant_id_id_key unique (tenant_id,id);
  end if;
end;
$$;

create table if not exists public.academic_schedule_exceptions (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  timetable_entry_id bigint not null,
  session_date date not null,
  action text not null,
  replacement_date date,
  replacement_slot_id bigint,
  replacement_teacher_person_id bigint,
  replacement_room_key text,
  note text,
  status text not null default 'active',
  created_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_schedule_exceptions_branch_fk
    foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
  constraint academic_schedule_exceptions_entry_fk
    foreign key (tenant_id,timetable_entry_id) references public.timetable_entries(tenant_id,id) on delete restrict,
  constraint academic_schedule_exceptions_slot_fk
    foreign key (tenant_id,replacement_slot_id) references public.timetable_slots(tenant_id,id) on delete restrict,
  constraint academic_schedule_exceptions_teacher_fk
    foreign key (tenant_id,replacement_teacher_person_id) references public.employee_profiles(tenant_id,person_id) on delete restrict,
  constraint academic_schedule_exceptions_membership_fk
    foreign key (tenant_id,created_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  constraint academic_schedule_exceptions_action_check
    check (action in ('cancel','reschedule','substitute')),
  constraint academic_schedule_exceptions_status_check
    check (status in ('active','reverted')),
  constraint academic_schedule_exceptions_note_check
    check (note is null or length(btrim(note)) between 1 and 1000),
  constraint academic_schedule_exceptions_shape_check
    check (
      (action='cancel' and replacement_date is null and replacement_slot_id is null and replacement_teacher_person_id is null)
      or
      (action='substitute' and replacement_date is null and replacement_slot_id is null and replacement_teacher_person_id is not null)
      or
      (action='reschedule' and replacement_date is not null and replacement_slot_id is not null)
    ),
  constraint academic_schedule_exceptions_unique_day
    unique (tenant_id,timetable_entry_id,session_date)
);

create index if not exists academic_schedule_exceptions_day_idx
  on public.academic_schedule_exceptions(tenant_id,branch_id,session_date,status);
create index if not exists academic_schedule_exceptions_teacher_idx
  on public.academic_schedule_exceptions(tenant_id,replacement_teacher_person_id,replacement_date)
  where replacement_teacher_person_id is not null and status='active';

alter table public.academic_schedule_exceptions enable row level security;
alter table public.academic_schedule_exceptions force row level security;
revoke all on public.academic_schedule_exceptions from public,anon,authenticated;
grant select on public.academic_schedule_exceptions to authenticated;
grant select,insert,update,delete on public.academic_schedule_exceptions to service_role;
grant usage,select on sequence public.academic_schedule_exceptions_id_seq to service_role;

drop policy if exists academic_schedule_exceptions_scoped_read on public.academic_schedule_exceptions;
create policy academic_schedule_exceptions_scoped_read
  on public.academic_schedule_exceptions
  for select
  to authenticated
  using (private.has_permission(tenant_id,'academics.structure.read',branch_id));

alter table public.homework_assignments alter column group_id drop not null;
alter table public.homework_assignments add column if not exists student_person_id bigint;
alter table public.homework_assignments add column if not exists priority text not null default 'normal';
alter table public.homework_assignments add column if not exists parent_visible boolean not null default true;
alter table public.homework_assignments add column if not exists student_visible boolean not null default true;
alter table public.homework_assignments add column if not exists attachment_storage_path text;
alter table public.homework_assignments add column if not exists created_by_membership_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.homework_assignments'::regclass and conname='homework_assignments_student_fk') then
    alter table public.homework_assignments add constraint homework_assignments_student_fk
      foreign key (tenant_id,student_person_id) references public.student_profiles(tenant_id,person_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.homework_assignments'::regclass and conname='homework_assignments_creator_fk') then
    alter table public.homework_assignments add constraint homework_assignments_creator_fk
      foreign key (tenant_id,created_by_membership_id) references public.memberships(tenant_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.homework_assignments'::regclass and conname='homework_assignments_target_check') then
    alter table public.homework_assignments add constraint homework_assignments_target_check
      check (num_nonnulls(group_id,student_person_id)=1);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.homework_assignments'::regclass and conname='homework_assignments_priority_check') then
    alter table public.homework_assignments add constraint homework_assignments_priority_check
      check (priority in ('low','normal','high','urgent'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.homework_assignments'::regclass and conname='homework_assignments_attachment_path_check') then
    alter table public.homework_assignments add constraint homework_assignments_attachment_path_check
      check (attachment_storage_path is null or attachment_storage_path ~ '^[0-9]+/academics/homework/[a-f0-9]{24,64}\.[a-z0-9]{2,8}$');
  end if;
end;
$$;

create index if not exists homework_assignments_student_target_idx
  on public.homework_assignments(tenant_id,student_person_id,state,due_at)
  where student_person_id is not null;
create index if not exists homework_assignments_priority_idx
  on public.homework_assignments(tenant_id,branch_id,state,priority,due_at);

alter table public.academic_calendar_events add column if not exists description text;
alter table public.academic_calendar_events add column if not exists location text;
alter table public.academic_calendar_events add column if not exists audience text not null default 'all';
alter table public.academic_calendar_events add column if not exists priority text not null default 'normal';
alter table public.academic_calendar_events add column if not exists attachment_storage_path text;
alter table public.academic_calendar_events add column if not exists status text not null default 'active';
alter table public.academic_calendar_events add column if not exists created_by_membership_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.academic_calendar_events'::regclass and conname='academic_calendar_events_audience_check') then
    alter table public.academic_calendar_events add constraint academic_calendar_events_audience_check
      check (audience in ('all','parents','students','teachers','staff'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.academic_calendar_events'::regclass and conname='academic_calendar_events_priority_check') then
    alter table public.academic_calendar_events add constraint academic_calendar_events_priority_check
      check (priority in ('low','normal','high','urgent'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.academic_calendar_events'::regclass and conname='academic_calendar_events_status_check') then
    alter table public.academic_calendar_events add constraint academic_calendar_events_status_check
      check (status in ('active','cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.academic_calendar_events'::regclass and conname='academic_calendar_events_description_check') then
    alter table public.academic_calendar_events add constraint academic_calendar_events_description_check
      check (description is null or length(btrim(description)) between 1 and 4000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.academic_calendar_events'::regclass and conname='academic_calendar_events_attachment_path_check') then
    alter table public.academic_calendar_events add constraint academic_calendar_events_attachment_path_check
      check (attachment_storage_path is null or attachment_storage_path ~ '^[0-9]+/academics/calendar/[a-f0-9]{24,64}\.[a-z0-9]{2,8}$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.academic_calendar_events'::regclass and conname='academic_calendar_events_creator_fk') then
    alter table public.academic_calendar_events add constraint academic_calendar_events_creator_fk
      foreign key (tenant_id,created_by_membership_id) references public.memberships(tenant_id,id) on delete restrict;
  end if;
end;
$$;

create index if not exists academic_calendar_events_status_idx
  on public.academic_calendar_events(tenant_id,branch_id,status,starts_at);

commit;
