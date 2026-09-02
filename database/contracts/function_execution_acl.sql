-- Madarsa ERP application-function execution ACL recovery contract.
--
-- Supabase's logical schema dump restores function definitions but does not preserve the
-- application EXECUTE ACL matrix used by this project. A fresh PostgreSQL function normally
-- grants EXECUTE to PUBLIC, which would widen access after a disaster restore.
--
-- This contract reconstructs the current reviewed boundary on an initialized Supabase target:
--   * every public application RPC: service_role only;
--   * five private authorization/storage helpers: authenticated only;
--   * seven private server helpers: service_role only;
--   * every other private function: no application-role EXECUTE grant;
--   * PUBLIC and anon: no EXECUTE on public/private application functions.
--
-- The recovery drill compares the complete public/private function ACL matrix back to production
-- after this contract is applied. Any production drift therefore fails closed and requires review.

do $madarsa_acl$
declare
  r record;
begin
  for r in
    select format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid)
    ) as function_identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      r.function_identity
    );
  end loop;

  -- The public schema is an internal server-RPC surface. Browser sessions do not execute it
  -- directly; server routes use the Supabase service role after their own auth/permission checks.
  for r in
    select format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid)
    ) as function_identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('grant execute on function %s to service_role', r.function_identity);
  end loop;
end
$madarsa_acl$;

-- Private helpers intentionally callable from authenticated RLS/storage-policy evaluation.
grant execute on function private.has_any_tenant_membership() to authenticated;
grant execute on function private.has_permission(bigint, text, bigint) to authenticated;
grant execute on function private.has_relationship(bigint, text, text) to authenticated;
grant execute on function private.has_tenant_membership(bigint) to authenticated;
grant execute on function private.storage_tenant_id(text) to authenticated;

-- Private helpers intentionally callable only by trusted server/service-role code.
grant execute on function private.admission_transition_allowed(text, text) to service_role;
grant execute on function private.convert_admission(bigint, bigint, text, text, bigint) to service_role;
grant execute on function private.enforce_admission_transition() to service_role;
grant execute on function private.reserve_formatted_number(bigint, text, bigint, bigint, date) to service_role;
grant execute on function private.reserve_number_sequence_for_period(bigint, text, bigint, bigint, date) to service_role;
grant execute on function private.reserve_number_sequence(bigint, text, bigint) to service_role;
grant execute on function private.resolve_staff_membership(uuid, bigint, bigint, text[]) to service_role;
