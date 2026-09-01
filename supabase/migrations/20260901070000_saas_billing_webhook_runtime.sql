-- Governed Razorpay subscription webhook ingestion.
-- Signature verification happens in the server route over the raw request body.
-- This database function is service-role only and never accepts browser tenant ids.

create or replace function public.ingest_razorpay_subscription_event_v1(
  p_provider_event_id text,
  p_event_type text,
  p_provider_occurred_at timestamptz,
  p_payload_digest text,
  p_provider_subscription_id text default null,
  p_provider_status text default null,
  p_current_period_starts_at timestamptz default null,
  p_current_period_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id bigint;
  v_existing public.subscription_provider_events%rowtype;
  v_subscription public.tenant_subscriptions%rowtype;
  v_target_state text;
  v_processing_state text;
  v_result jsonb;
begin
  if p_provider_event_id is null or length(btrim(p_provider_event_id)) < 6 or length(p_provider_event_id) > 200 then
    raise exception 'invalid_provider_event_id';
  end if;
  if p_event_type is null or length(btrim(p_event_type)) < 3 or length(p_event_type) > 120 then
    raise exception 'invalid_event_type';
  end if;
  if p_provider_occurred_at is null then
    raise exception 'invalid_provider_occurred_at';
  end if;
  if p_payload_digest is null or p_payload_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_payload_digest';
  end if;
  if p_provider_subscription_id is not null and length(p_provider_subscription_id) > 200 then
    raise exception 'invalid_provider_subscription_id';
  end if;
  if p_provider_status is not null and length(p_provider_status) > 80 then
    raise exception 'invalid_provider_status';
  end if;
  if p_current_period_starts_at is not null and p_current_period_ends_at is not null
     and p_current_period_ends_at <= p_current_period_starts_at then
    raise exception 'invalid_provider_period';
  end if;

  select * into v_existing
  from public.subscription_provider_events
  where provider = 'razorpay' and provider_event_id = p_provider_event_id;

  if found then
    return jsonb_build_object(
      'status', 'duplicate',
      'event_id', v_existing.id,
      'processing_state', v_existing.processing_state,
      'subscription_id', v_existing.subscription_id
    );
  end if;

  if p_provider_subscription_id is not null then
    select * into v_subscription
    from public.tenant_subscriptions
    where provider = 'razorpay'
      and provider_subscription_id = p_provider_subscription_id
    for update;
  end if;

  v_target_state := case p_event_type
    when 'subscription.activated' then 'active'
    when 'subscription.charged' then 'active'
    when 'subscription.resumed' then 'active'
    when 'subscription.paused' then 'suspended'
    when 'subscription.halted' then 'restricted'
    when 'subscription.cancelled' then 'closed'
    when 'subscription.completed' then 'expired'
    else null
  end;

  if v_target_state is null then
    v_processing_state := 'quarantined';
    v_result := jsonb_build_object('reason', 'unsupported_event_type', 'provider_status', p_provider_status);
  elsif v_subscription.id is null then
    v_processing_state := 'quarantined';
    v_result := jsonb_build_object('reason', 'subscription_not_resolved', 'provider_status', p_provider_status);
  elsif v_subscription.last_provider_event_at is not null
        and p_provider_occurred_at < v_subscription.last_provider_event_at then
    v_processing_state := 'ignored_stale';
    v_result := jsonb_build_object(
      'reason', 'older_than_last_provider_event',
      'provider_status', p_provider_status,
      'last_provider_event_at', v_subscription.last_provider_event_at
    );
  else
    update public.tenant_subscriptions
       set normalized_state = v_target_state,
           current_period_starts_at = coalesce(p_current_period_starts_at, current_period_starts_at),
           current_period_ends_at = coalesce(p_current_period_ends_at, current_period_ends_at),
           last_provider_event_at = p_provider_occurred_at,
           state_version = state_version + 1,
           updated_at = now()
     where id = v_subscription.id;

    v_processing_state := 'processed';
    v_result := jsonb_build_object(
      'normalized_state', v_target_state,
      'provider_status', p_provider_status,
      'previous_state', v_subscription.normalized_state
    );
  end if;

  insert into public.subscription_provider_events(
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
    'razorpay',
    p_provider_event_id,
    v_subscription.tenant_id,
    v_subscription.id,
    p_event_type,
    p_provider_occurred_at,
    p_payload_digest,
    true,
    v_processing_state,
    v_result,
    case when v_processing_state in ('processed','ignored_stale','quarantined') then now() else null end
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select * into v_existing
    from public.subscription_provider_events
    where provider = 'razorpay' and provider_event_id = p_provider_event_id;
    return jsonb_build_object(
      'status', 'duplicate',
      'event_id', v_existing.id,
      'processing_state', v_existing.processing_state,
      'subscription_id', v_existing.subscription_id
    );
  end if;

  return jsonb_build_object(
    'status', v_processing_state,
    'event_id', v_event_id,
    'subscription_id', v_subscription.id,
    'tenant_id', v_subscription.tenant_id,
    'result', v_result
  );
end;
$$;

revoke all on function public.ingest_razorpay_subscription_event_v1(text,text,timestamptz,text,text,text,timestamptz,timestamptz) from public;
revoke all on function public.ingest_razorpay_subscription_event_v1(text,text,timestamptz,text,text,text,timestamptz,timestamptz) from anon;
revoke all on function public.ingest_razorpay_subscription_event_v1(text,text,timestamptz,text,text,text,timestamptz,timestamptz) from authenticated;
grant execute on function public.ingest_razorpay_subscription_event_v1(text,text,timestamptz,text,text,text,timestamptz,timestamptz) to service_role;
