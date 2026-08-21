-- Governed student numbering.
-- Published number definitions stay immutable. Runtime counters live separately so
-- reservation never mutates configuration and reset periods can be represented safely.

alter table public.number_sequences
  add column version integer not null default 1 check (version > 0);

alter table public.number_sequences
  drop constraint number_sequences_tenant_id_branch_id_key_key;

alter table public.number_sequences
  add constraint number_sequences_tenant_id_branch_id_key_version_key
  unique nulls not distinct (tenant_id, branch_id, key, version);

create unique index number_sequences_one_published_idx
  on public.number_sequences (tenant_id, branch_id, key) nulls not distinct
  where status = 'published';

create table public.number_sequence_counters (
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  sequence_id bigint not null,
  period_key text not null check (length(btrim(period_key)) between 3 and 160),
  next_value bigint not null check (next_value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, sequence_id, period_key),
  foreign key (tenant_id, sequence_id)
    references public.number_sequences(tenant_id, id) on delete restrict
);

alter table public.number_sequence_counters enable row level security;
revoke all on table public.number_sequence_counters from public, anon, authenticated;
grant select, insert, update on table public.number_sequence_counters to service_role;

create policy number_sequence_counters_browser_deny
  on public.number_sequence_counters
  for all to anon, authenticated
  using (false)
  with check (false);

create or replace function private.protect_number_sequence_configuration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    if tg_op = 'UPDATE'
       and new.status = 'retired'
       and (to_jsonb(new) - 'status' - 'updated_at') =
           (to_jsonb(old) - 'status' - 'updated_at') then
      return new;
    end if;

    raise exception 'published number sequence is immutable; publish a new version';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_number_sequence_configuration()
  from public, anon, authenticated;

drop trigger number_sequences_protect_published on public.number_sequences;
create trigger number_sequences_protect_published
  before update or delete on public.number_sequences
  for each row execute function private.protect_number_sequence_configuration();

create or replace function public.setup_student_number_sequence(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_pattern text,
  p_start_value bigint,
  p_padding integer,
  p_reset_period text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_existing_id bigint;
  v_existing_version integer;
  v_existing_pattern text;
  v_existing_start bigint;
  v_existing_padding integer;
  v_existing_reset text;
  v_version integer;
  v_sequence_id bigint;
  v_scrubbed text;
  v_seq_count integer;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then
    raise exception 'identity, tenant, and branch are required';
  end if;

  p_pattern := btrim(coalesce(p_pattern, ''));
  if length(p_pattern) not between 3 and 160
     or p_pattern !~ '^[A-Za-z0-9_./{}-]+$' then
    raise exception 'invalid student number pattern';
  end if;

  v_seq_count := (length(p_pattern) - length(replace(p_pattern, '{SEQ}', ''))) / 5;
  if v_seq_count <> 1 then
    raise exception 'student number pattern must contain {SEQ} exactly once';
  end if;

  v_scrubbed := replace(p_pattern, '{SEQ}', '');
  v_scrubbed := replace(v_scrubbed, '{BRANCH}', '');
  v_scrubbed := replace(v_scrubbed, '{SESSION}', '');
  v_scrubbed := replace(v_scrubbed, '{YYYY}', '');
  v_scrubbed := replace(v_scrubbed, '{YY}', '');
  if v_scrubbed ~ '[{}]' then
    raise exception 'student number pattern contains an unsupported token';
  end if;

  if position('{BRANCH}' in p_pattern) = 0 then
    raise exception 'branch-scoped student number pattern requires {BRANCH}';
  end if;

  if p_reset_period not in ('never', 'yearly', 'session') then
    raise exception 'invalid student number reset period';
  end if;
  if p_reset_period = 'yearly'
     and position('{YYYY}' in p_pattern) = 0
     and position('{YY}' in p_pattern) = 0 then
    raise exception 'yearly reset requires {YYYY} or {YY}';
  end if;
  if p_reset_period = 'session' and position('{SESSION}' in p_pattern) = 0 then
    raise exception 'session reset requires {SESSION}';
  end if;

  if p_start_value is null or p_start_value < 1 or p_start_value > 999999999999 then
    raise exception 'invalid student number starting value';
  end if;
  if p_padding is null or p_padding < 1 or p_padding > 12 then
    raise exception 'invalid student number padding';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'student-numbering:' || p_tenant_id::text || ':' || p_branch_id::text,
      0
    )
  );

  select m.id
    into v_membership_id
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.identity_id = p_identity_id
    and m.status = 'active'
    and (m.ends_at is null or m.ends_at > now())
    and exists (
      select 1
      from public.membership_roles mr
      join public.role_permissions rp
        on rp.tenant_id = mr.tenant_id
       and rp.role_id = mr.role_id
      where mr.tenant_id = m.tenant_id
        and mr.membership_id = m.id
        and rp.permission_code in (
          'settings.configuration.manage',
          'settings.configuration.publish'
        )
      group by mr.membership_id
      having count(distinct rp.permission_code) = 2
    )
  order by m.created_at asc
  limit 1;

  if v_membership_id is null then
    raise exception 'student numbering permission denied';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.tenant_id = p_tenant_id
      and b.id = p_branch_id
      and b.status = 'active'
  ) then
    raise exception 'active tenant branch required';
  end if;

  if exists (
    select 1
    from public.number_sequences ns
    where ns.tenant_id = p_tenant_id
      and ns.branch_id is not distinct from p_branch_id
      and ns.key = 'student_default'
      and ns.entity_type <> 'student'
  ) then
    raise exception 'student number sequence key is already used by another entity';
  end if;

  select ns.id, ns.version, ns.pattern, ns.next_value, ns.padding, ns.reset_period
    into v_existing_id,
         v_existing_version,
         v_existing_pattern,
         v_existing_start,
         v_existing_padding,
         v_existing_reset
  from public.number_sequences ns
  where ns.tenant_id = p_tenant_id
    and ns.branch_id is not distinct from p_branch_id
    and ns.key = 'student_default'
    and ns.entity_type = 'student'
    and ns.status = 'published'
  order by ns.version desc
  limit 1;

  if v_existing_id is not null
     and v_existing_pattern = p_pattern
     and v_existing_start = p_start_value
     and v_existing_padding = p_padding
     and v_existing_reset = p_reset_period then
    return jsonb_build_object(
      'created', false,
      'sequence_id', v_existing_id,
      'version', v_existing_version,
      'pattern', v_existing_pattern,
      'reset_period', v_existing_reset
    );
  end if;

  if v_existing_id is not null then
    update public.number_sequences
       set status = 'retired',
           updated_at = now()
     where tenant_id = p_tenant_id
       and id = v_existing_id;
  end if;

  select coalesce(max(ns.version), 0) + 1
    into v_version
  from public.number_sequences ns
  where ns.tenant_id = p_tenant_id
    and ns.branch_id is not distinct from p_branch_id
    and ns.key = 'student_default';

  insert into public.number_sequences (
    tenant_id, branch_id, key, entity_type, version, pattern, next_value,
    padding, reset_period, reserved_values, status, effective_at, published_at,
    created_by_membership_id, published_by_membership_id
  ) values (
    p_tenant_id,
    p_branch_id,
    'student_default',
    'student',
    v_version,
    p_pattern,
    p_start_value,
    p_padding::smallint,
    p_reset_period,
    array[]::bigint[],
    'published',
    now(),
    now(),
    v_membership_id,
    v_membership_id
  ) returning id into v_sequence_id;

  insert into public.audit_events (
    tenant_id, branch_id, actor_identity_id, actor_membership_id,
    action, outcome, entity_type, entity_id, correlation_id, after_state, metadata
  ) values (
    p_tenant_id,
    p_branch_id,
    p_identity_id,
    v_membership_id,
    'configuration.student_numbering.published',
    'succeeded',
    'number_sequence',
    v_sequence_id::text,
    v_correlation_id,
    jsonb_build_object(
      'key', 'student_default',
      'entity_type', 'student',
      'version', v_version,
      'pattern', p_pattern,
      'start_value', p_start_value,
      'padding', p_padding,
      'reset_period', p_reset_period,
      'status', 'published'
    ),
    jsonb_build_object(
      'superseded_sequence_id', v_existing_id,
      'branch_id', p_branch_id
    )
  );

  return jsonb_build_object(
    'created', true,
    'sequence_id', v_sequence_id,
    'version', v_version,
    'pattern', p_pattern,
    'reset_period', p_reset_period
  );
end;
$$;

revoke all on function public.setup_student_number_sequence(
  uuid, bigint, bigint, text, bigint, integer, text
) from public, anon, authenticated;
grant execute on function public.setup_student_number_sequence(
  uuid, bigint, bigint, text, bigint, integer, text
) to service_role;

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

    if not (v_candidate = any(v_reserved_values)) then
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

create or replace function private.reserve_number_sequence(
  p_tenant_id bigint,
  p_key text,
  p_branch_id bigint default null
)
returns bigint
language plpgsql
set search_path = ''
as $$
begin
  return private.reserve_number_sequence_for_period(
    p_tenant_id, p_key, p_branch_id, null, current_date
  );
end;
$$;

revoke all on function private.reserve_number_sequence(bigint, text, bigint)
  from public, anon, authenticated;
grant execute on function private.reserve_number_sequence(bigint, text, bigint)
  to service_role;

create or replace function private.reserve_formatted_number(
  p_tenant_id bigint,
  p_key text,
  p_branch_id bigint default null,
  p_session_id bigint default null,
  p_reference_date date default current_date
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_pattern text;
  v_padding integer;
  v_entity_type text;
  v_branch_code text;
  v_session_key text;
  v_reference_date date := coalesce(p_reference_date, current_date);
  v_value bigint;
  v_sequence_text text;
  v_rendered text;
  v_attempt integer;
begin
  select ns.pattern, ns.padding, ns.entity_type
    into v_pattern, v_padding, v_entity_type
  from public.number_sequences ns
  where ns.tenant_id = p_tenant_id
    and ns.key = p_key
    and ns.branch_id is not distinct from p_branch_id
    and ns.status = 'published'
    and ns.effective_at is not null
    and ns.effective_at <= now()
  order by ns.version desc
  limit 1;

  if v_pattern is null then
    raise exception 'published number sequence not found';
  end if;

  if position('{BRANCH}' in v_pattern) > 0 then
    select b.code into v_branch_code
    from public.branches b
    where b.tenant_id = p_tenant_id and b.id = p_branch_id and b.status = 'active';
    if v_branch_code is null then
      raise exception 'active branch required to render number sequence';
    end if;
  end if;

  if position('{SESSION}' in v_pattern) > 0 then
    select s.key into v_session_key
    from public.academic_sessions s
    where s.tenant_id = p_tenant_id and s.id = p_session_id;
    if v_session_key is null then
      raise exception 'academic session required to render number sequence';
    end if;
  end if;

  for v_attempt in 1..10000 loop
    v_value := private.reserve_number_sequence_for_period(
      p_tenant_id, p_key, p_branch_id, p_session_id, v_reference_date
    );
    v_sequence_text := v_value::text;
    if length(v_sequence_text) < v_padding then
      v_sequence_text := lpad(v_sequence_text, v_padding, '0');
    end if;

    v_rendered := replace(v_pattern, '{SEQ}', v_sequence_text);
    v_rendered := replace(v_rendered, '{YYYY}', to_char(v_reference_date, 'YYYY'));
    v_rendered := replace(v_rendered, '{YY}', to_char(v_reference_date, 'YY'));
    v_rendered := replace(v_rendered, '{BRANCH}', coalesce(v_branch_code, ''));
    v_rendered := replace(v_rendered, '{SESSION}', coalesce(v_session_key, ''));

    if length(v_rendered) > 160 then
      raise exception 'rendered number exceeds maximum length';
    end if;

    if v_entity_type <> 'student' or not exists (
      select 1 from public.student_profiles sp
      where sp.tenant_id = p_tenant_id and sp.student_number = v_rendered
    ) then
      return v_rendered;
    end if;
  end loop;

  raise exception 'unable to reserve a unique formatted number';
end;
$$;

revoke all on function private.reserve_formatted_number(
  bigint, text, bigint, bigint, date
) from public, anon, authenticated;
grant execute on function private.reserve_formatted_number(
  bigint, text, bigint, bigint, date
) to service_role;
