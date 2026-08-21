-- Secure applicant status tracking. The browser never executes this RPC directly.
-- The trusted app server hashes the supplied private tracking key and source identifier,
-- then invokes with service_role. Only non-PII status metadata is returned.

create or replace function public.track_public_admission(
  p_tracking_id uuid,
  p_tracking_secret_hash text,
  p_source_hash text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_tenant_id bigint;
  v_tenant_name text;
  v_state text;
  v_submitted_at timestamptz;
  v_program_labels jsonb;
  v_session_labels jsonb;
  v_stored_hash text;
  v_recent_attempts integer;
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_tracking_id is null then
    raise exception 'tracking reference required';
  end if;
  if p_tracking_secret_hash is null or p_tracking_secret_hash !~ '^[0-9a-f]{64}$'
     or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid security hash';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public-admission-track:' || p_source_hash, 0)
  );

  select count(*)::integer
    into v_recent_attempts
  from public.security_rate_limit_events e
  where e.action_key = 'public_admission_track'
    and e.source_hash = p_source_hash
    and e.occurred_at >= now() - interval '15 minutes';

  if v_recent_attempts >= 20 then
    insert into public.security_rate_limit_events (
      tenant_id, action_key, source_hash, decision, limit_snapshot, correlation_id
    ) values (
      null,
      'public_admission_track',
      p_source_hash,
      'throttled',
      jsonb_build_object('limit', 20, 'window_minutes', 15, 'observed', v_recent_attempts),
      v_correlation_id
    );

    return jsonb_build_object('matched', false, 'rate_limited', true);
  end if;

  select a.tenant_id,
         t.name,
         a.state,
         a.submitted_at,
         p.labels,
         s.labels,
         a.tracking_secret_hash
    into v_tenant_id,
         v_tenant_name,
         v_state,
         v_submitted_at,
         v_program_labels,
         v_session_labels,
         v_stored_hash
  from public.applications a
  join public.tenants t on t.id = a.tenant_id
  join public.programs p on p.tenant_id = a.tenant_id and p.id = a.program_id
  join public.academic_sessions s on s.tenant_id = a.tenant_id and s.id = a.session_id
  where a.tracking_id = p_tracking_id
    and t.state in ('onboarding','trial','active','grace')
  limit 1;

  if v_tenant_id is null or v_stored_hash is distinct from p_tracking_secret_hash then
    insert into public.security_rate_limit_events (
      tenant_id, action_key, source_hash, decision, limit_snapshot, correlation_id
    ) values (
      v_tenant_id,
      'public_admission_track',
      p_source_hash,
      'blocked',
      jsonb_build_object('limit', 20, 'window_minutes', 15, 'observed', v_recent_attempts),
      v_correlation_id
    );

    return jsonb_build_object('matched', false, 'rate_limited', false);
  end if;

  insert into public.security_rate_limit_events (
    tenant_id, action_key, source_hash, decision, limit_snapshot, correlation_id
  ) values (
    v_tenant_id,
    'public_admission_track',
    p_source_hash,
    'allowed',
    jsonb_build_object('limit', 20, 'window_minutes', 15, 'observed', v_recent_attempts),
    v_correlation_id
  );

  return jsonb_build_object(
    'matched', true,
    'rate_limited', false,
    'state', v_state,
    'submitted_at', v_submitted_at,
    'tenant_name', v_tenant_name,
    'program_labels', v_program_labels,
    'session_labels', v_session_labels
  );
end;
$$;

revoke all on function public.track_public_admission(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.track_public_admission(uuid, text, text)
  to service_role;
