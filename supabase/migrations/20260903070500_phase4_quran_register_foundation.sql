begin;

create table public.quran_student_targets (
  id bigint generated always as identity primary key,
  tenant_id bigint not null,
  branch_id bigint not null,
  student_person_id bigint not null,
  work_category text not null,
  target_mode text not null,
  juz_number smallint,
  start_surah_number smallint,
  start_ayah_number integer,
  end_surah_number smallint,
  end_ayah_number integer,
  page_start integer,
  page_end integer,
  assigned_on date not null,
  due_on date,
  status text not null default 'active',
  source_attempt_id bigint,
  teacher_person_id bigint,
  created_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete cascade,
  foreign key (tenant_id,student_person_id) references public.persons(tenant_id,id) on delete cascade,
  foreign key (tenant_id,source_attempt_id) references public.recitation_attempts(tenant_id,id) on delete set null,
  foreign key (tenant_id,teacher_person_id) references public.employee_profiles(tenant_id,person_id) on delete set null,
  foreign key (tenant_id,created_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  check (work_category in ('sabaq','sabqi','manzil','nazra','qaida','tajweed')),
  check (target_mode in ('juz','ayah','page')),
  check (status in ('active','completed','superseded','cancelled')),
  check (due_on is null or due_on>=assigned_on),
  check (
    (target_mode='juz' and juz_number between 1 and 30 and start_surah_number is null and start_ayah_number is null and end_surah_number is null and end_ayah_number is null and page_start is null and page_end is null)
    or (target_mode='ayah' and juz_number is null and start_surah_number between 1 and 114 and end_surah_number between 1 and 114 and start_ayah_number>0 and end_ayah_number>0 and (end_surah_number>start_surah_number or (end_surah_number=start_surah_number and end_ayah_number>=start_ayah_number)) and page_start is null and page_end is null)
    or (target_mode='page' and juz_number is null and start_surah_number is null and start_ayah_number is null and end_surah_number is null and end_ayah_number is null and page_start between 1 and 604 and page_end between page_start and 604)
  )
);
create unique index quran_student_targets_one_active on public.quran_student_targets(tenant_id,branch_id,student_person_id,work_category) where status='active';
create index quran_student_targets_history on public.quran_student_targets(tenant_id,student_person_id,assigned_on desc,id desc);

create table public.quran_daily_roster_statuses (
  id bigint generated always as identity primary key,
  tenant_id bigint not null,
  branch_id bigint not null,
  group_id bigint not null,
  student_person_id bigint not null,
  session_date date not null,
  status text not null,
  note text,
  recorded_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete cascade,
  foreign key (tenant_id,student_person_id) references public.persons(tenant_id,id) on delete cascade,
  foreign key (tenant_id,recorded_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  check (status in ('absent','no_lesson')),
  check (note is null or length(note)<=500),
  unique (tenant_id,branch_id,group_id,student_person_id,session_date)
);
create index quran_daily_roster_statuses_group_date on public.quran_daily_roster_statuses(tenant_id,branch_id,group_id,session_date);

alter table public.quran_student_targets enable row level security;
alter table public.quran_daily_roster_statuses enable row level security;
revoke all on public.quran_student_targets from public,anon,authenticated;
revoke all on public.quran_daily_roster_statuses from public,anon,authenticated;
grant select,insert,update,delete on public.quran_student_targets to service_role;
grant select,insert,update,delete on public.quran_daily_roster_statuses to service_role;
grant usage,select on sequence public.quran_student_targets_id_seq to service_role;
grant usage,select on sequence public.quran_daily_roster_statuses_id_seq to service_role;

commit;
