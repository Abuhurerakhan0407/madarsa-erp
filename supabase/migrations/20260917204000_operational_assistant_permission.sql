-- Minimal AI assistant is aggregate-only and limited to staff who can already read student operations.
insert into public.permissions(code,description) values ('ai.assistant.use','Use aggregate operational assistant') on conflict(code) do nothing;
insert into public.role_permissions(tenant_id,role_id,permission_code)
select distinct rp.tenant_id,rp.role_id,'ai.assistant.use'
from public.role_permissions rp join public.roles r on r.tenant_id=rp.tenant_id and r.id=rp.role_id
where r.status='active' and rp.permission_code='students.profile.read'
on conflict do nothing;
