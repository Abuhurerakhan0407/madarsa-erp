create or replace function public.check_parent_portal_login_rate_limit_v2(
  p_source_key text,
  p_username text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog','extensions'
as $$
declare
  v_now timestamptz := now();
  v_source_hash text;
  v_actor_hash text;
  v_source_count integer;
  v_actor_count integer := 0;
  v_ip_limit constant integer := 60;
  v_username_limit constant integer := 8;
  v_window constant interval := interval '10 minutes';
  v_throttled boolean;
begin
  if p_source_key is null or length(p_source_key) > 256 then
    raise exception 'invalid login source key';
  end if;
  if p_username is not null and length(p_username) > 128 then
    raise exception 'invalid login username key';
  end if;

  v_source_hash := encode(digest(coalesce(p_source_key,'unknown'),'sha256'),'hex');
  v_actor_hash := case
    when p_username is null then null
    else encode(digest(lower(btrim(p_username)),'sha256'),'hex')
  end;

  perform pg_advisory_xact_lock(hashtextextended('parent-login-ip-v2:' || v_source_hash,0));
  if v_actor_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('parent-login-user-v2:' || v_actor_hash,0));
  end if;

  select count(*)::integer into v_source_count
  from public.security_rate_limit_events e
  where e.action_key = 'parent.portal.login.failure'
    and e.source_hash = v_source_hash
    and e.occurred_at >= v_now - v_window;

  if v_actor_hash is not null then
    select count(*)::integer into v_actor_count
    from public.security_rate_limit_events e
    where e.action_key = 'parent.portal.login.failure'
      and e.actor_hash = v_actor_hash
      and e.occurred_at >= v_now - v_window;
  end if;

  v_throttled := v_source_count >= v_ip_limit
    or (v_actor_hash is not null and v_actor_count >= v_username_limit);

  return jsonb_build_object(
    'allowed', not v_throttled,
    'retry_after_seconds', case when v_throttled then 600 else 0 end
  );
end;
$$;

create or replace function public.record_parent_portal_login_failure_v2(
  p_source_key text,
  p_username text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog','extensions'
as $$
declare
  v_check jsonb;
  v_source_hash text;
  v_actor_hash text;
begin
  v_check := public.check_parent_portal_login_rate_limit_v2(p_source_key, p_username);
  if coalesce((v_check->>'allowed')::boolean, false) = false then
    return v_check;
  end if;

  v_source_hash := encode(digest(coalesce(p_source_key,'unknown'),'sha256'),'hex');
  v_actor_hash := case
    when p_username is null then null
    else encode(digest(lower(btrim(p_username)),'sha256'),'hex')
  end;

  insert into public.security_rate_limit_events(
    tenant_id,
    action_key,
    actor_hash,
    source_hash,
    decision,
    limit_snapshot,
    correlation_id
  ) values (
    null,
    'parent.portal.login.failure',
    v_actor_hash,
    v_source_hash,
    'allowed',
    jsonb_build_object(
      'window_seconds',600,
      'ip_attempts',60,
      'username_attempts',8
    ),
    gen_random_uuid()
  );

  return v_check;
end;
$$;

revoke all on function public.check_parent_portal_login_rate_limit_v2(text,text)
  from public,anon,authenticated;
revoke all on function public.record_parent_portal_login_failure_v2(text,text)
  from public,anon,authenticated;
grant execute on function public.check_parent_portal_login_rate_limit_v2(text,text)
  to service_role;
grant execute on function public.record_parent_portal_login_failure_v2(text,text)
  to service_role;
