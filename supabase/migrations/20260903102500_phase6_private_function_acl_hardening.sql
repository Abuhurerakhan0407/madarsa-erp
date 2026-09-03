-- Phase 6 follow-up hardening: private helpers are internal-only.
-- `authenticated` has USAGE on the private schema in the live project, so
-- default function EXECUTE privileges must be removed explicitly.

revoke all on function private.emit_client_v2_in_app_v1(bigint,text,text,text,jsonb,uuid[]) from public, anon, authenticated;
revoke all on function private.client_v2_guardian_identities_for_students_v1(bigint,bigint[]) from public, anon, authenticated;
revoke all on function private.client_v2_homework_notification_trigger_v1() from public, anon, authenticated;
revoke all on function private.client_v2_calendar_notification_trigger_v1() from public, anon, authenticated;
revoke all on function private.client_v2_schedule_exception_notification_trigger_v1() from public, anon, authenticated;
revoke all on function private.client_v2_result_publication_notification_trigger_v1() from public, anon, authenticated;
revoke all on function private.client_v2_portal_notice_notification_trigger_v1() from public, anon, authenticated;
revoke all on function private.client_v2_attendance_notification_trigger_v1() from public, anon, authenticated;
