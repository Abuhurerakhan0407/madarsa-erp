begin;

do $phase9$
declare
  v_definition text;
  v_untrusted_marker text := 'raw_user_' || 'meta_data';
begin
  select pg_get_functiondef('public.get_teachers_workspace_v1(uuid,bigint,bigint,text,text)'::regprocedure)
    into v_definition;
  execute replace(v_definition, v_untrusted_marker, 'raw_app_meta_data');

  select pg_get_functiondef('public.get_portal_access_center_v2(uuid,bigint,bigint)'::regprocedure)
    into v_definition;
  execute replace(v_definition, v_untrusted_marker, 'raw_app_meta_data');
end;
$phase9$;

revoke all on function public.get_teachers_workspace_v1(uuid,bigint,bigint,text,text) from public,anon,authenticated;
revoke all on function public.get_portal_access_center_v2(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_teachers_workspace_v1(uuid,bigint,bigint,text,text) to service_role;
grant execute on function public.get_portal_access_center_v2(uuid,bigint,bigint) to service_role;

commit;
