create or replace function public.resolve_access_admin_membership_v1(p_identity_id uuid,p_tenant_id bigint)
returns bigint language plpgsql stable set search_path to pg_catalog,extensions as $fn$
declare v_membership bigint;begin
 select m.id into v_membership from public.memberships m
 where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
   and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
   and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='settings.roles.manage')
 order by m.created_at limit 1;
 return v_membership;
end;$fn$;

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
 select coalesce(jsonb_agg(row_to_json(x) order by x.id),'[]'::jsonb) into v_memberships from(
  select m.id,m.identity_id,m.status,m.all_branches,m.starts_at,m.ends_at,
   coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'key',r.key,'name',r.name,'is_system',r.is_system) order by r.name) from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id),'[]'::jsonb) roles,
   coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'code',b.code,'name',b.name) order by b.name) from public.membership_branch_scopes s join public.branches b on b.tenant_id=s.tenant_id and b.id=s.branch_id where s.tenant_id=m.tenant_id and s.membership_id=m.id),'[]'::jsonb) branch_scopes,
   (m.id=v_admin) is_current_admin
  from public.memberships m where m.tenant_id=p_tenant_id
 )x;
 return jsonb_build_object('branches',v_branches,'permissions',v_permissions,'roles',v_roles,'memberships',v_memberships,'admin_membership_id',v_admin);
end;$fn$;

create or replace function public.create_custom_role_v1(p_identity_id uuid,p_tenant_id bigint,p_key text,p_name text)
returns jsonb language plpgsql set search_path to pg_catalog,extensions as $fn$
declare v_admin bigint;v_id bigint;v_key text:=lower(btrim(coalesce(p_key,'')));v_name text:=btrim(coalesce(p_name,''));begin
 v_admin:=public.resolve_access_admin_membership_v1(p_identity_id,p_tenant_id);if v_admin is null then raise exception 'access administration permission denied';end if;
 if v_key !~ '^[a-z][a-z0-9_]{1,63}$' then raise exception 'valid role key required';end if;
 if length(v_name)<2 or length(v_name)>120 then raise exception 'role name must be 2 to 120 characters';end if;
 insert into public.roles(tenant_id,key,name,status,is_system) values(p_tenant_id,v_key,v_name,'active',false) returning id into v_id;
 insert into public.audit_events(tenant_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
 values(p_tenant_id,p_identity_id,v_admin,'settings.role.create','succeeded','role',v_id::text,gen_random_uuid(),jsonb_build_object('key',v_key,'name',v_name,'is_system',false));
 return jsonb_build_object('role_id',v_id,'key',v_key,'state','active');
end;$fn$;

create or replace function public.set_custom_role_permissions_v1(p_identity_id uuid,p_tenant_id bigint,p_role_id bigint,p_permission_codes text[])
returns jsonb language plpgsql set search_path to pg_catalog,extensions as $fn$
declare v_admin bigint;v_count integer;v_unknown integer;begin
 v_admin:=public.resolve_access_admin_membership_v1(p_identity_id,p_tenant_id);if v_admin is null then raise exception 'access administration permission denied';end if;
 if not exists(select 1 from public.roles r where r.tenant_id=p_tenant_id and r.id=p_role_id and not r.is_system) then raise exception 'custom role required';end if;
 select count(distinct x)::int into v_count from unnest(coalesce(p_permission_codes,array[]::text[]))x where nullif(btrim(x),'') is not null;
 if v_count>150 then raise exception 'too many permissions';end if;
 select count(*)::int into v_unknown from(select distinct x code from unnest(coalesce(p_permission_codes,array[]::text[]))x where nullif(btrim(x),'') is not null)q left join public.permissions p on p.code=q.code where p.code is null;
 if v_unknown>0 then raise exception 'unknown permission code supplied';end if;
 delete from public.role_permissions where tenant_id=p_tenant_id and role_id=p_role_id;
 insert into public.role_permissions(tenant_id,role_id,permission_code) select p_tenant_id,p_role_id,x from(select distinct x from unnest(coalesce(p_permission_codes,array[]::text[]))x where nullif(btrim(x),'') is not null)q;
 insert into public.audit_events(tenant_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
 values(p_tenant_id,p_identity_id,v_admin,'settings.role.permissions.set','succeeded','role',p_role_id::text,gen_random_uuid(),jsonb_build_object('permission_count',v_count));
 return jsonb_build_object('role_id',p_role_id,'permission_count',v_count);
end;$fn$;

create or replace function public.set_membership_custom_role_v1(p_identity_id uuid,p_tenant_id bigint,p_membership_id bigint,p_role_id bigint,p_assigned boolean)
returns jsonb language plpgsql set search_path to pg_catalog,extensions as $fn$
declare v_admin bigint;begin
 v_admin:=public.resolve_access_admin_membership_v1(p_identity_id,p_tenant_id);if v_admin is null then raise exception 'access administration permission denied';end if;
 if not exists(select 1 from public.memberships m where m.tenant_id=p_tenant_id and m.id=p_membership_id) then raise exception 'membership not found';end if;
 if not exists(select 1 from public.roles r where r.tenant_id=p_tenant_id and r.id=p_role_id and not r.is_system and r.status='active') then raise exception 'active custom role required';end if;
 if p_assigned then insert into public.membership_roles(tenant_id,membership_id,role_id) values(p_tenant_id,p_membership_id,p_role_id) on conflict do nothing; else delete from public.membership_roles where tenant_id=p_tenant_id and membership_id=p_membership_id and role_id=p_role_id;end if;
 insert into public.audit_events(tenant_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
 values(p_tenant_id,p_identity_id,v_admin,'settings.membership.custom_role.set','succeeded','membership',p_membership_id::text,gen_random_uuid(),jsonb_build_object('role_id',p_role_id,'assigned',p_assigned));
 return jsonb_build_object('membership_id',p_membership_id,'role_id',p_role_id,'assigned',p_assigned);
end;$fn$;

create or replace function public.set_membership_branch_scope_v1(p_identity_id uuid,p_tenant_id bigint,p_membership_id bigint,p_all_branches boolean,p_branch_ids bigint[])
returns jsonb language plpgsql set search_path to pg_catalog,extensions as $fn$
declare v_admin bigint;v_target_identity uuid;v_count integer;v_invalid integer;begin
 v_admin:=public.resolve_access_admin_membership_v1(p_identity_id,p_tenant_id);if v_admin is null then raise exception 'access administration permission denied';end if;
 select m.identity_id into v_target_identity from public.memberships m where m.tenant_id=p_tenant_id and m.id=p_membership_id;
 if v_target_identity is null then raise exception 'membership not found';end if;
 if v_target_identity=p_identity_id then raise exception 'current administrator branch scope cannot be changed here';end if;
 select count(distinct x)::int into v_count from unnest(coalesce(p_branch_ids,array[]::bigint[]))x where x is not null;
 if not p_all_branches and v_count<1 then raise exception 'at least one branch scope is required';end if;
 select count(*)::int into v_invalid from(select distinct x from unnest(coalesce(p_branch_ids,array[]::bigint[]))x where x is not null)q left join public.branches b on b.tenant_id=p_tenant_id and b.id=q.x and b.status='active' where b.id is null;
 if v_invalid>0 then raise exception 'invalid or inactive branch scope';end if;
 update public.memberships set all_branches=p_all_branches,updated_at=now() where tenant_id=p_tenant_id and id=p_membership_id;
 delete from public.membership_branch_scopes where tenant_id=p_tenant_id and membership_id=p_membership_id;
 if not p_all_branches then insert into public.membership_branch_scopes(tenant_id,membership_id,branch_id) select p_tenant_id,p_membership_id,x from(select distinct x from unnest(p_branch_ids)x where x is not null)q;end if;
 insert into public.audit_events(tenant_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
 values(p_tenant_id,p_identity_id,v_admin,'settings.membership.branch_scope.set','succeeded','membership',p_membership_id::text,gen_random_uuid(),jsonb_build_object('all_branches',p_all_branches,'branch_count',case when p_all_branches then null else v_count end));
 return jsonb_build_object('membership_id',p_membership_id,'all_branches',p_all_branches,'branch_count',case when p_all_branches then null else v_count end);
end;$fn$;

revoke all on function public.resolve_access_admin_membership_v1(uuid,bigint) from public,anon,authenticated;
revoke all on function public.get_access_administration_center_v1(uuid,bigint) from public,anon,authenticated;
revoke all on function public.create_custom_role_v1(uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.set_custom_role_permissions_v1(uuid,bigint,bigint,text[]) from public,anon,authenticated;
revoke all on function public.set_membership_custom_role_v1(uuid,bigint,bigint,bigint,boolean) from public,anon,authenticated;
revoke all on function public.set_membership_branch_scope_v1(uuid,bigint,bigint,boolean,bigint[]) from public,anon,authenticated;
grant execute on function public.resolve_access_admin_membership_v1(uuid,bigint) to service_role;
grant execute on function public.get_access_administration_center_v1(uuid,bigint) to service_role;
grant execute on function public.create_custom_role_v1(uuid,bigint,text,text) to service_role;
grant execute on function public.set_custom_role_permissions_v1(uuid,bigint,bigint,text[]) to service_role;
grant execute on function public.set_membership_custom_role_v1(uuid,bigint,bigint,bigint,boolean) to service_role;
grant execute on function public.set_membership_branch_scope_v1(uuid,bigint,bigint,boolean,bigint[]) to service_role;