begin;

alter table public.tenants
  add column if not exists client_profile text not null default 'full-product';

alter table public.tenants
  drop constraint if exists tenants_client_profile_check;

alter table public.tenants
  add constraint tenants_client_profile_check
  check (client_profile in ('full-product', 'client-v2'));

update public.tenants
set client_profile = 'client-v2',
    updated_at = now()
where slug = 'abu-school'
  and client_profile is distinct from 'client-v2';

comment on column public.tenants.client_profile is
  'Product capability profile. full-product preserves the reusable platform; client-v2 hides client-excluded modules without deleting implementation.';

commit;
