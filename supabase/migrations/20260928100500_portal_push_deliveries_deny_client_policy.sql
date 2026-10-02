begin;

drop policy if exists portal_push_deliveries_deny_clients
  on public.portal_push_deliveries;

create policy portal_push_deliveries_deny_clients
  on public.portal_push_deliveries
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

commit;
