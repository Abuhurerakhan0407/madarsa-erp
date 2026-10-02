-- Minimal AI assistant is aggregate-only. It can surface sensitive branch,
-- finance and payroll aggregates, so it is not inherited by generic student
-- readers/teachers. Access administrators receive it by default and may grant
-- it explicitly to another trusted custom role from Roles & Access.
insert into public.permissions(code,description)
values ('ai.assistant.use','Use aggregate operational assistant')
on conflict(code) do nothing;

insert into public.role_permissions(tenant_id,role_id,permission_code)
select distinct rp.tenant_id,rp.role_id,'ai.assistant.use'
from public.role_permissions rp
join public.roles r on r.tenant_id=rp.tenant_id and r.id=rp.role_id
where r.status='active'
  and rp.permission_code='settings.roles.manage'
on conflict do nothing;
