create or replace function public.get_portal_home_v3(p_identity_id uuid,p_tenant_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_home jsonb;
  v_overview jsonb;
  v_schedule jsonb;
begin
  v_home:=public.get_portal_home_v2(p_identity_id,p_tenant_id);
  v_overview:=coalesce(v_home->'overview','{}'::jsonb);
  v_schedule:=public.get_guardian_resolved_schedule_v1(p_identity_id,p_tenant_id);
  return v_home||jsonb_build_object('overview',v_overview||jsonb_build_object('today_schedule',coalesce(v_schedule,'[]'::jsonb)));
end;
$$;
revoke all on function public.get_portal_home_v3(uuid,bigint) from public,anon,authenticated;
grant execute on function public.get_portal_home_v3(uuid,bigint) to service_role;

create or replace function public.record_portal_credential_audit_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_person_id bigint,
  p_link_type text,
  p_credential_action text,
  p_outcome text
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_membership bigint;
  v_link_type text:=lower(btrim(coalesce(p_link_type,'')));
  v_action text:=lower(btrim(coalesce(p_credential_action,'')));
  v_outcome text:=lower(btrim(coalesce(p_outcome,'')));
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'portal administration permission denied';end if;
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'portal.credentials.create') then raise exception 'portal credential permission denied';end if;
  if v_link_type not in('guardian','employee') then raise exception 'portal link type must be guardian or employee';end if;
  if v_action not in('create','reset') then raise exception 'portal credential action must be create or reset';end if;
  if v_outcome not in('allowed','succeeded','failed') then raise exception 'portal credential audit outcome is invalid';end if;
  if not exists(select 1 from public.persons p where p.tenant_id=p_tenant_id and p.id=p_person_id) then raise exception 'portal person not found';end if;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership,
    case when v_action='create' then 'portal.credentials.create' else 'portal.credentials.reset' end,
    v_outcome,'person',p_person_id::text,gen_random_uuid(),jsonb_build_object('link_type',v_link_type,'credential_action',v_action)
  );
  return jsonb_build_object('recorded',true,'action',v_action,'outcome',v_outcome);
end;
$$;
revoke all on function public.record_portal_credential_audit_v1(uuid,bigint,bigint,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.record_portal_credential_audit_v1(uuid,bigint,bigint,bigint,text,text,text) to service_role;
