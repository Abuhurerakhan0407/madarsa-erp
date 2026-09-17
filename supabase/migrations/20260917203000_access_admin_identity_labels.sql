-- Client-facing access center: show account names/emails instead of raw identity IDs alone.
create or replace function public.get_access_administration_center_v1(p_identity_id uuid,p_tenant_id bigint)
returns jsonb language plpgsql stable set search_path to pg_catalog,extensions as $fn$
declare v_admin bigint;v_branches jsonb;v_permissions jsonb;v_roles jsonb;v_memberships jsonb;begin
 v_admin:=public.resolve_access_admin_membership_v1(p_identity_id,p_tenant_id);if v_admin is null then raise exception 'access administration permission denied';end if;
 select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.id),'[]'::jsonb) into v_branches from(select b.id,b.code,b.name,b.status from public.branches b where b.tenant_id=p_tenant_id)x;
 select coalesce(jsonb_agg(row_to_json(x) order by x.code),'[]'::jsonb) into v_permissions from(select p.code,p.description from public.permissions p)x;
 select coalesce(jsonb_agg(row_to_json(x) order by x.is_system desc,x.name,x.id),'[]'::jsonb) into v_roles from(
  select r.id,r.key,r.name,r.status,r.is_system,coalesce((select jsonb_agg(rp.permission_code order by rp.permission_code) from public.role_permissions rp where rp.tenant_id=r.tenant_id and rp.role_id=r.id),'[]'::jsonb) permissions,
   (select count(*)::int from public.membership_roles mr where mr.tenant_id=r.tenant_id and mr.role_id=r.id) member_count
  from public.roles r where r.tenant_id=p_tenant_id
 )x;
 select coalesce(jsonb_agg(row_to_json(x) order by x.display_name nulls last,x.email nulls last,x.id),'[]'::jsonb) into v_memberships from(
  select m.id,m.identity_id,m.status,m.all_branches,m.starts_at,m.ends_at,
   nullif(btrim(coalesce(pr.display_name,'')),'') display_name,
   nullif(btrim(coalesce(u.email,'')),'') email,
   coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'key',r.key,'name',r.name,'is_system',r.is_system) order by r.name) from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id),'[]'::jsonb) roles,
   coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'code',b.code,'name',b.name) order by b.name) from public.membership_branch_scopes s join public.branches b on b.tenant_id=s.tenant_id and b.id=s.branch_id where s.tenant_id=m.tenant_id and s.membership_id=m.id),'[]'::jsonb) branch_scopes,
   (m.id=v_admin) is_current_admin
  from public.memberships m
  left join public.profiles pr on pr.identity_id=m.identity_id
  left join auth.users u on u.id=m.identity_id
  where m.tenant_id=p_tenant_id
 )x;
 return jsonb_build_object('branches',v_branches,'permissions',v_permissions,'roles',v_roles,'memberships',v_memberships,'admin_membership_id',v_admin);
end;$fn$;
revoke all on function public.get_access_administration_center_v1(uuid,bigint) from public,anon,authenticated;
grant execute on function public.get_access_administration_center_v1(uuid,bigint) to service_role;
