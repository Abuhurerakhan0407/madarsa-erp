-- Allow server-side service-role RPCs to traverse the private helper schema without
-- exposing private runtime helpers to browser roles.
--
-- Admission staff progression and student conversion are invoked through public,
-- service-role-only RPCs. Their application update triggers call private helpers.
-- The service role therefore needs schema USAGE plus execute on the narrow helper set.
-- Revoke legacy default PUBLIC execute from unrelated trigger helpers before granting
-- schema USAGE so the broader schema namespace does not expose callable leftovers.

revoke execute on function private.assert_balanced_journal()
  from public, anon, authenticated;
revoke execute on function private.protect_posted_journal_line()
  from public, anon, authenticated;

grant usage on schema private to service_role;

grant execute on function private.admission_transition_allowed(text, text)
  to service_role;
grant execute on function private.enforce_admission_transition()
  to service_role;

-- These numbering helpers were already service-role-only at function level. Reassert
-- their intended grants here because they also require private-schema USAGE when
-- called transitively by the admission conversion RPC.
grant execute on function private.reserve_number_sequence_for_period(
  bigint, text, bigint, bigint, date
) to service_role;
grant execute on function private.reserve_number_sequence(bigint, text, bigint)
  to service_role;
grant execute on function private.reserve_formatted_number(
  bigint, text, bigint, bigint, date
) to service_role;
