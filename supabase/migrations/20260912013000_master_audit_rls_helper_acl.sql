-- Final ACL state for Phase 0 RLS helpers.
-- These private-schema SECURITY DEFINER functions are used only from RLS policy evaluation.
-- Browser-facing public RPC execution remains denied; service_role bypasses RLS and does not need these helpers.

revoke all on function private.person_branch_read_allowed_v1(bigint,bigint) from public, anon, authenticated, service_role;
revoke all on function private.student_profile_branch_read_allowed_v1(bigint,bigint) from public, anon, authenticated, service_role;
revoke all on function private.attendance_record_branch_read_allowed_v1(bigint,bigint,bigint) from public, anon, authenticated, service_role;
revoke all on function private.mark_entry_branch_read_allowed_v1(bigint,bigint) from public, anon, authenticated, service_role;
revoke all on function private.identity_assigned_teacher_for_student_v1(bigint,bigint) from public, anon, authenticated, service_role;
revoke all on function private.attendance_record_scoped_read_allowed_v2(bigint,bigint,bigint,bigint) from public, anon, authenticated, service_role;
revoke all on function private.mark_entry_scoped_read_allowed_v2(bigint,bigint,bigint,bigint) from public, anon, authenticated, service_role;

grant execute on function private.person_branch_read_allowed_v1(bigint,bigint) to authenticated;
grant execute on function private.student_profile_branch_read_allowed_v1(bigint,bigint) to authenticated;
grant execute on function private.attendance_record_branch_read_allowed_v1(bigint,bigint,bigint) to authenticated;
grant execute on function private.mark_entry_branch_read_allowed_v1(bigint,bigint) to authenticated;
grant execute on function private.identity_assigned_teacher_for_student_v1(bigint,bigint) to authenticated;
grant execute on function private.attendance_record_scoped_read_allowed_v2(bigint,bigint,bigint,bigint) to authenticated;
grant execute on function private.mark_entry_scoped_read_allowed_v2(bigint,bigint,bigint,bigint) to authenticated;

-- Public SECURITY DEFINER entrypoint remains service-only.
revoke all on function public.set_portal_identity_access_v1(uuid,bigint,bigint,bigint,text,boolean) from public, anon, authenticated;
grant execute on function public.set_portal_identity_access_v1(uuid,bigint,bigint,bigint,text,boolean) to service_role;
