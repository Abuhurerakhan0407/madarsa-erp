-- Target the first-arrival lookup used by biometric guardian notifications.
-- This is intentionally partial so it does not add write overhead for unrelated device events.
create index if not exists attendance_device_events_student_arrival_idx
  on public.attendance_device_events (
    tenant_id,
    branch_id,
    student_person_id,
    occurred_at desc
  )
  where modality = 'biometric'
    and state = 'applied'
    and event_type in ('presence','check_in')
    and student_person_id is not null;
