alter table public.attendance_records add column if not exists source text not null default 'manual';
alter table public.attendance_records add column if not exists source_ref text;

do $block$
begin
  if not exists (
    select 1 from pg_constraint where conname='attendance_records_source_check' and conrelid='public.attendance_records'::regclass
  ) then
    alter table public.attendance_records add constraint attendance_records_source_check check (source in ('manual','biometric','nfc','import'));
  end if;
end;
$block$;

create index if not exists attendance_records_tenant_session_source_idx on public.attendance_records(tenant_id,attendance_session_id,source);
create index if not exists attendance_records_tenant_person_marked_idx on public.attendance_records(tenant_id,person_id,marked_at desc);
create index if not exists attendance_roster_members_roster_subject_idx on public.attendance_roster_members(tenant_id,roster_id,subject_type,person_id);
