create or replace function public.tenant_offboarding_preflight_v1(
  p_tenant_id bigint
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_tenant jsonb;
  v_active_hold_count bigint := 0;
  v_unresolved_job_count bigint := 0;
  v_policy_count bigint := 0;
  v_table_count integer := 0;
  v_populated_table_count integer := 0;
  v_total_rows bigint := 0;
  v_row_count bigint := 0;
  v_inventory jsonb := '[]'::jsonb;
  v_job_states jsonb := '{}'::jsonb;
  v_hold_scopes jsonb := '{}'::jsonb;
  v_table record;
begin
  if p_tenant_id is null or p_tenant_id <= 0 then
    raise exception 'valid tenant id required';
  end if;

  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'slug', t.slug,
    'state', t.state,
    'legal_hold_flag', t.legal_hold,
    'deletion_scheduled_at', t.deletion_scheduled_at,
    'created_at', t.created_at,
    'updated_at', t.updated_at
  )
  into v_tenant
  from public.tenants t
  where t.id = p_tenant_id;

  if v_tenant is null then
    raise exception 'tenant not found';
  end if;

  select count(*)::bigint,
         coalesce(jsonb_object_agg(x.scope_type, x.scope_count), '{}'::jsonb)
  into v_active_hold_count, v_hold_scopes
  from (
    select lh.scope_type, count(*)::bigint as scope_count
    from public.legal_holds lh
    where lh.tenant_id = p_tenant_id
      and lh.state = 'active'
      and lh.starts_at <= now()
      and (lh.ends_at is null or lh.ends_at > now())
    group by lh.scope_type
  ) x;

  select coalesce(sum(x.state_count), 0)::bigint,
         coalesce(jsonb_object_agg(x.state, x.state_count), '{}'::jsonb)
  into v_unresolved_job_count, v_job_states
  from (
    select dj.state, count(*)::bigint as state_count
    from public.data_deletion_jobs dj
    where dj.tenant_id = p_tenant_id
      and dj.state not in ('completed', 'cancelled')
    group by dj.state
  ) x;

  select count(*)::bigint
  into v_policy_count
  from public.data_retention_policies rp
  where rp.state = 'active'
    and rp.effective_from <= current_date
    and (rp.effective_to is null or rp.effective_to >= current_date)
    and (rp.tenant_id is null or rp.tenant_id = p_tenant_id);

  for v_table in
    select n.nspname as schema_name, c.relname as table_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and exists (
        select 1
        from pg_catalog.pg_attribute a
        where a.attrelid = c.oid
          and a.attname = 'tenant_id'
          and a.attnum > 0
          and not a.attisdropped
      )
    order by c.relname
  loop
    execute format(
      'select count(*)::bigint from %I.%I where tenant_id = $1',
      v_table.schema_name,
      v_table.table_name
    )
    into v_row_count
    using p_tenant_id;

    v_table_count := v_table_count + 1;
    v_total_rows := v_total_rows + v_row_count;
    if v_row_count > 0 then
      v_populated_table_count := v_populated_table_count + 1;
    end if;

    v_inventory := v_inventory || jsonb_build_array(
      jsonb_build_object(
        'table', v_table.table_name,
        'rows', v_row_count
      )
    );
  end loop;

  return jsonb_build_object(
    'preflight_only', true,
    'destructive_execution_supported', false,
    'tenant', v_tenant,
    'governance', jsonb_build_object(
      'tenant_legal_hold_flag', coalesce((v_tenant->>'legal_hold_flag')::boolean, false),
      'active_legal_holds', v_active_hold_count,
      'active_legal_hold_scopes', v_hold_scopes,
      'unresolved_deletion_jobs', v_unresolved_job_count,
      'unresolved_deletion_job_states', v_job_states,
      'applicable_active_retention_policies', v_policy_count
    ),
    'database_inventory', jsonb_build_object(
      'tenant_scoped_tables', v_table_count,
      'populated_tables', v_populated_table_count,
      'total_rows', v_total_rows,
      'tables', v_inventory
    ),
    'storage_inventory_included', false,
    'storage_note', 'Storage object bytes require separate tenant-path inventory and are not deleted or certified by this preflight.'
  );
end;
$fn$;

revoke all on function public.tenant_offboarding_preflight_v1(bigint) from public, anon, authenticated;
grant execute on function public.tenant_offboarding_preflight_v1(bigint) to service_role;
