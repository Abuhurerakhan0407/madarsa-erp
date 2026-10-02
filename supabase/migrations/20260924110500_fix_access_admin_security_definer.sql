-- Access administration reads auth.users to display account emails.
-- The RPC is only executable by service_role, but SECURITY INVOKER makes the
-- service_role query auth.users directly and fail with permission denied.
-- Execute as the postgres owner while preserving the restricted EXECUTE grant
-- and the locked search_path.

alter function public.get_access_administration_center_v1(uuid, bigint)
  security definer;

alter function public.get_access_administration_center_v1(uuid, bigint)
  set search_path = pg_catalog, extensions;
