-- Defensive hardening for reserved number values.
-- PostgreSQL arrays can contain NULL even when the array column itself is NOT NULL.
-- Reject malformed reserved-value arrays and keep allocator membership checks two-valued.

alter table public.number_sequences
  add constraint number_sequences_reserved_values_valid_check
  check (
    array_position(reserved_values, null) is null
    and 0 < all(reserved_values)
  );

create or replace function private.reserve_number_sequence_for_period(
  p_tenant_id bigint,
  p_key text,
  p_branch_id bigint default null,
  p_session_id bigint default null,
  p_reference_date date default current_date
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_sequence_id bigint;
  v_seed bigint;
  v_reserved_values bigint[];
  v_reset_period text;
  v_period_key text;
  v_candidate bigint;
  v_attempt integer;
  v_reference_date date := coalesce(p_reference_date, current_date);
begin
  select ns.id, ns.next_value, ns.reserved_values, ns.reset_period
    into v_sequence_id, v_seed, v_reserved_values, v_reset_period
  from public.number_sequences ns
  where ns.tenant_id = p_tenant_id
    and ns.key = p_key
    and ns.branch_id is not distinct from p_branch_id
    and ns.status = 'published'
    and ns.effective_at is not null
    and ns.effective_at <= now()
  order by ns.version desc
  limit 1;

  if v_sequence_id is null then
    raise exception 'published number sequence not found';
  end if;

  if v_reset_period = 'never' then
    v_period_key := 'never';
  elsif v_reset_period = 'yearly' then
    v_period_key := 'year:' || extract(year from v_reference_date)::integer::text;
  elsif v_reset_period = 'session' then
    if p_session_id is null or not exists (
      select 1 from public.academic_sessions s
      where s.tenant_id = p_tenant_id and s.id = p_session_id
    ) then
      raise exception 'valid academic session required for session-reset sequence';
    end if;
    v_period_key := 'session:' || p_session_id::text;
  else
    raise exception 'unsupported number sequence reset period';
  end if;

  insert into public.number_sequence_counters (
    tenant_id, sequence_id, period_key, next_value
  ) values (
    p_tenant_id, v_sequence_id, v_period_key, v_seed
  ) on conflict (tenant_id, sequence_id, period_key) do nothing;

  for v_attempt in 1..10000 loop
    update public.number_sequence_counters c
       set next_value = c.next_value + 1,
           updated_at = now()
     where c.tenant_id = p_tenant_id
       and c.sequence_id = v_sequence_id
       and c.period_key = v_period_key
    returning c.next_value - 1 into v_candidate;

    if v_candidate is null then
      raise exception 'number sequence counter unavailable';
    end if;

    if not coalesce(v_candidate = any(v_reserved_values), false) then
      return v_candidate;
    end if;
  end loop;

  raise exception 'number sequence reserved-value space exhausted';
end;
$$;

revoke all on function private.reserve_number_sequence_for_period(
  bigint, text, bigint, bigint, date
) from public, anon, authenticated;
grant execute on function private.reserve_number_sequence_for_period(
  bigint, text, bigint, bigint, date
) to service_role;
