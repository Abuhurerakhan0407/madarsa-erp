-- Fix guardian/employee portal claim execution context.
-- The claim RPC is callable only by service_role, but it validates auth.users.
-- SECURITY DEFINER lets the postgres-owned function perform that validation
-- while preserving its existing locked search_path and restricted EXECUTE grants.
alter function public.claim_portal_access_code_v1(uuid, text)
  security definer;

alter function public.claim_portal_access_code_v1(uuid, text)
  set search_path = pg_catalog, extensions;
