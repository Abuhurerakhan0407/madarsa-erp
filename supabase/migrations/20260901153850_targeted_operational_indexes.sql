-- Target only operational query paths supported by production evidence.
-- No index removals: zero-scan indexes are not enough evidence to drop safely.

create index if not exists transport_assignments_stop_state_idx
  on public.transport_assignments (tenant_id, stop_id, state, ends_on);

create index if not exists mess_attendance_service_idx
  on public.mess_attendance (tenant_id, meal_service_id);

create index if not exists library_copies_title_branch_state_idx
  on public.library_copies (tenant_id, title_id, branch_id, state);

create index if not exists library_copies_branch_state_idx
  on public.library_copies (tenant_id, branch_id, state, accession_number);
