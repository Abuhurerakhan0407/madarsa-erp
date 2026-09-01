-- Preserve webhook idempotency integrity without mutating the original provider-event record.
-- Exact duplicate deliveries remain normal duplicates. A signed delivery that reuses an
-- existing provider event id with a different raw-payload digest is recorded separately
-- and acknowledged as quarantined so the provider does not enter a retry storm.

create table if not exists public.subscription_provider_event_conflicts (
  id bigint generated always as identity primary key,
  original_event_id bigint not null references public.subscription_provider_events(id) on delete restrict,
  provider text not null check (provider = 'razorpay'),
  provider_event_id text not null check (length(provider_event_id) between 8 and 200),
  event_type text not null check (length(event_type) >= 4),
  provider_occurred_at timestamptz not null,
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  received_at timestamptz not null default now(),
  unique (original_event_id, payload_digest)
);

alter table public.subscription_provider_event_conflicts enable row level security;
revoke all on table public.subscription_provider_event_conflicts from public, anon, authenticated;

create or replace function public.record_subscription_provider_event_v1(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_provider_occurred_at timestamptz,
  p_provider_subscription_id text,
  p_payload_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.subscription_provider_events%rowtype;
  v_subscription public.tenant_subscriptions%rowtype;
  v_processing_state text;
  v_reason text;
  v_event_id bigint;
  v_supported boolean;
begin
  if btrim(coalesce(p_provider, '')) <> 'razorpay' then
    raise exception 'unsupported provider';
  end if;

  if length(btrim(coalesce(p_provider_event_id, ''))) < 8
    or length(btrim(coalesce(p_provider_event_id, ''))) > 200 then
    raise exception 'invalid provider event id';
  end if;

  if length(btrim(coalesce(p_event_type, ''))) < 4 then
    raise exception 'invalid event type';
  end if;

  if p_provider_occurred_at is null then
    raise exception 'provider occurred at is required';
  end if;

  if coalesce(p_payload_digest, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid payload digest';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_provider_event_id, 0));

  select *
    into v_existing
    from public.subscription_provider_events
   where provider = p_provider
     and provider_event_id = p_provider_event_id;

  if found then
    if v_existing.payload_digest = p_payload_digest then
      return jsonb_build_object(
        'event_id', v_existing.id,
        'processing_state', v_existing.processing_state,
        'duplicate', true,
        'integrity_conflict', false
      );
    end if;

    insert into public.subscription_provider_event_conflicts (
      original_event_id,
      provider,
      provider_event_id,
      event_type,
      provider_occurred_at,
      payload_digest
    ) values (
      v_existing.id,
      p_provider,
      p_provider_event_id,
      p_event_type,
      p_provider_occurred_at,
      p_payload_digest
    )
    on conflict (original_event_id, payload_digest) do nothing;

    return jsonb_build_object(
      'event_id', v_existing.id,
      'processing_state', 'quarantined',
      'duplicate', true,
      'integrity_conflict', true
    );
  end if;

  v_supported := p_event_type = any(array[
    'subscription.authenticated',
    'subscription.activated',
    'subscription.charged',
    'subscription.completed',
    'subscription.updated',
    'subscription.pending',
    'subscription.halted',
    'subscription.paused',
    'subscription.resumed',
    'subscription.cancelled'
  ]::text[]);

  if nullif(btrim(coalesce(p_provider_subscription_id, '')), '') is not null then
    select *
      into v_subscription
      from public.tenant_subscriptions
     where provider = p_provider
       and provider_subscription_id = p_provider_subscription_id;
  end if;

  if v_subscription.id is null then
    v_processing_state := 'quarantined';
    v_reason := 'unknown_subscription';
  elsif not v_supported then
    v_processing_state := 'quarantined';
    v_reason := 'unsupported_event';
  elsif v_subscription.last_provider_event_at is not null
    and p_provider_occurred_at < v_subscription.last_provider_event_at then
    v_processing_state := 'ignored_stale';
    v_reason := 'older_than_last_provider_event';
  else
    v_processing_state := 'received';
    v_reason := 'verified_awaiting_reconciliation';
  end if;

  insert into public.subscription_provider_events (
    provider,
    provider_event_id,
    tenant_id,
    subscription_id,
    event_type,
    provider_occurred_at,
    payload_digest,
    signature_verified,
    processing_state,
    processing_result,
    processed_at
  ) values (
    p_provider,
    p_provider_event_id,
    v_subscription.tenant_id,
    v_subscription.id,
    p_event_type,
    p_provider_occurred_at,
    p_payload_digest,
    true,
    v_processing_state,
    jsonb_build_object('reason', v_reason),
    case when v_processing_state in ('ignored_stale', 'quarantined') then now() else null end
  )
  returning id into v_event_id;

  if v_processing_state = 'received' then
    update public.tenant_subscriptions
       set last_provider_event_at = case
         when last_provider_event_at is null then p_provider_occurred_at
         else greatest(last_provider_event_at, p_provider_occurred_at)
       end,
       updated_at = now()
     where id = v_subscription.id
       and tenant_id = v_subscription.tenant_id;
  end if;

  return jsonb_build_object(
    'event_id', v_event_id,
    'processing_state', v_processing_state,
    'duplicate', false,
    'integrity_conflict', false
  );
end;
$$;

revoke all on function public.record_subscription_provider_event_v1(text, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.record_subscription_provider_event_v1(text, text, text, timestamptz, text, text) to service_role;
