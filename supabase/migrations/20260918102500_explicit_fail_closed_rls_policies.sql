-- Make intentionally private RLS tables explicitly fail closed for browser roles.
-- This preserves the existing deny-by-default behavior while documenting intent
-- and removing ambiguous RLS-enabled-without-policy advisor findings.
-- service_role remains unaffected because it bypasses RLS in Supabase.

do $migration$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and not exists (
        select 1
        from pg_policy p
        where p.polrelid = c.oid
      )
    order by c.relname
  loop
    execute format(
      'create policy %I on %I.%I as permissive for all to anon, authenticated using (false) with check (false)',
      'deny_browser_by_default',
      r.schema_name,
      r.table_name
    );
  end loop;
end
$migration$;
