begin;

-- Commercial-only modules must never inherit access merely because a role can read
-- or edit students/staff. Keep default access limited to institution owners and
-- explicitly privileged access administrators. Other office roles can be granted
-- these permissions deliberately from Roles & Access after launch.
with commercial_permissions(code) as (
  values
    ('finance.fees.read'::text),
    ('finance.fees.manage'),
    ('finance.payment.collect'),
    ('contributions.read'),
    ('contributions.manage'),
    ('payroll.read'),
    ('payroll.manage'),
    ('ai.assistant.use')
)
delete from public.role_permissions rp
using public.roles r, commercial_permissions cp
where rp.tenant_id=r.tenant_id
  and rp.role_id=r.id
  and rp.permission_code=cp.code
  and r.key<>'institution_owner'
  and not exists (
    select 1
    from public.role_permissions admin_rp
    where admin_rp.tenant_id=r.tenant_id
      and admin_rp.role_id=r.id
      and admin_rp.permission_code='settings.roles.manage'
  );

-- Owner roles must receive permissions introduced after tenant bootstrap.
insert into public.role_permissions(tenant_id,role_id,permission_code)
select r.tenant_id,r.id,p.code
from public.roles r
cross join (
  values
    ('finance.fees.read'::text),
    ('finance.fees.manage'),
    ('finance.payment.collect'),
    ('contributions.read'),
    ('contributions.manage'),
    ('payroll.read'),
    ('payroll.manage'),
    ('ai.assistant.use')
) p(code)
where r.status='active'
  and r.key='institution_owner'
on conflict do nothing;

-- Existing explicit access administrators are a trusted office audience. This does
-- not grant anything to teacher-only roles merely because they can read students.
insert into public.role_permissions(tenant_id,role_id,permission_code)
select distinct r.tenant_id,r.id,p.code
from public.roles r
join public.role_permissions admin_rp
  on admin_rp.tenant_id=r.tenant_id
 and admin_rp.role_id=r.id
 and admin_rp.permission_code='settings.roles.manage'
cross join (
  values
    ('finance.fees.read'::text),
    ('finance.fees.manage'),
    ('finance.payment.collect'),
    ('contributions.read'),
    ('contributions.manage'),
    ('payroll.read'),
    ('payroll.manage'),
    ('ai.assistant.use')
) p(code)
where r.status='active'
on conflict do nothing;

commit;
