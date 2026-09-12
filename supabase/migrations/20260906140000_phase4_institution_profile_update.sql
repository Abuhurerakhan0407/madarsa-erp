begin;

create or replace function public.update_institution_profile_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_display_name text,
  p_timezone text,
  p_primary_locale text,
  p_supported_locales text[],
  p_legal_name text default null,
  p_address jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_before public.institution_profiles%rowtype;
  v_after public.institution_profiles%rowtype;
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_timezone text := btrim(coalesce(p_timezone, ''));
  v_primary_locale text := lower(btrim(coalesce(p_primary_locale, '')));
  v_supported_locales text[];
  v_legal_name text := nullif(btrim(coalesce(p_legal_name, '')), '');
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then
    raise exception 'identity, tenant, and branch are required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('institution-profile:' || p_tenant_id::text, 0)
  );

  v_membership_id := private.resolve_staff_membership(
    p_identity_id,
    p_tenant_id,
    p_branch_id,
    array['settings.tenant.manage']
  );
  if v_membership_id is null then
    raise exception 'institution profile permission denied';
  end if;

  if not exists (
    select 1
    from public.branches b
    where b.tenant_id = p_tenant_id
      and b.id = p_branch_id
      and b.status = 'active'
  ) then
    raise exception 'active tenant branch required';
  end if;

  if length(v_display_name) not between 2 and 160 then
    raise exception 'institution name must be between 2 and 160 characters';
  end if;

  if length(v_timezone) > 64 or not exists (
    select 1 from pg_catalog.pg_timezone_names tz where tz.name = v_timezone
  ) then
    raise exception 'timezone is invalid';
  end if;

  if v_primary_locale not in ('en', 'ur', 'ar') then
    raise exception 'primary locale is invalid';
  end if;

  if p_supported_locales is null or cardinality(p_supported_locales) not between 1 and 3 then
    raise exception 'supported locales are invalid';
  end if;

  select array_agg(locale order by locale)
    into v_supported_locales
  from (
    select distinct lower(btrim(value)) as locale
    from unnest(p_supported_locales) as value
  ) normalized;

  if cardinality(v_supported_locales) <> cardinality(p_supported_locales)
     or exists (
       select 1 from unnest(v_supported_locales) locale where locale not in ('en', 'ur', 'ar')
     ) then
    raise exception 'supported locales are invalid';
  end if;

  if not (v_primary_locale = any(v_supported_locales)) then
    raise exception 'primary locale must be included in supported locales';
  end if;

  if v_legal_name is not null and length(v_legal_name) not between 2 and 160 then
    raise exception 'legal name must be between 2 and 160 characters';
  end if;

  if p_address is not null and jsonb_typeof(p_address) <> 'object' then
    raise exception 'address must be a JSON object';
  end if;

  select * into v_before
  from public.institution_profiles ip
  where ip.tenant_id = p_tenant_id;

  if not found then
    raise exception 'institution profile is required';
  end if;

  update public.institution_profiles
  set display_name = v_display_name,
      legal_name = coalesce(v_legal_name, v_before.legal_name),
      timezone = v_timezone,
      primary_locale = v_primary_locale,
      supported_locales = v_supported_locales,
      address = coalesce(p_address, v_before.address),
      updated_at = now()
  where tenant_id = p_tenant_id
  returning * into v_after;

  update public.tenants
  set name = v_display_name,
      updated_at = now()
  where id = p_tenant_id;

  insert into public.audit_events(
    tenant_id,
    branch_id,
    actor_identity_id,
    actor_membership_id,
    action,
    outcome,
    entity_type,
    entity_id,
    correlation_id,
    before_state,
    after_state,
    metadata
  ) values (
    p_tenant_id,
    p_branch_id,
    p_identity_id,
    v_membership_id,
    'settings.institution_profile.update',
    'succeeded',
    'institution_profile',
    p_tenant_id::text,
    gen_random_uuid(),
    to_jsonb(v_before),
    to_jsonb(v_after),
    jsonb_build_object('source', 'client_v3_phase4_setup')
  );

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'display_name', v_after.display_name,
    'timezone', v_after.timezone,
    'primary_locale', v_after.primary_locale,
    'supported_locales', v_after.supported_locales
  );
end;
$$;

revoke all on function public.update_institution_profile_v1(uuid,bigint,bigint,text,text,text,text[],text,jsonb)
  from public, anon, authenticated;
grant execute on function public.update_institution_profile_v1(uuid,bigint,bigint,text,text,text,text[],text,jsonb)
  to service_role;

commit;
