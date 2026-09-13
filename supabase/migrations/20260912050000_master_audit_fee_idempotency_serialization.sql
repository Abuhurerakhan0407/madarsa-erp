-- Master audit remediation: serialize fee mutation retries at the database boundary.
-- The underlying finance functions already enforce tenant/branch/permission checks.
-- These wrappers close the race between an idempotency lookup and the write itself.

create or replace function public.post_student_fee_charge_serialized_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint,
  p_fee_assignment_id bigint,
  p_fee_item_id bigint,
  p_period_key text,
  p_charge_date date,
  p_due_date date,
  p_concession_amount numeric,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 128 then
    raise exception 'valid fee charge request key required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(format('fee_charge_request:%s:%s',p_tenant_id,p_idempotency_key),0));
  return public.post_student_fee_charge_v1(
    p_identity_id,p_tenant_id,p_branch_id,p_student_person_id,p_fee_assignment_id,p_fee_item_id,
    p_period_key,p_charge_date,p_due_date,p_concession_amount,p_idempotency_key
  );
end;
$$;

create or replace function public.collect_student_fee_payment_serialized_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint,
  p_amount numeric,
  p_currency_code text,
  p_mode text,
  p_provider_reference text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 128 then
    raise exception 'valid payment request key required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(format('student_fee_payment_request:%s:%s',p_tenant_id,p_idempotency_key),0));
  return public.collect_student_fee_payment_v1(
    p_identity_id,p_tenant_id,p_branch_id,p_student_person_id,p_amount,p_currency_code,p_mode,
    p_provider_reference,p_idempotency_key
  );
end;
$$;

create or replace function public.reverse_student_fee_payment_serialized_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_payment_id bigint,
  p_reason text,
  p_refund_method text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 128 then
    raise exception 'valid reversal request key required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(format('student_fee_reversal_request:%s:%s',p_tenant_id,p_idempotency_key),0));
  return public.reverse_student_fee_payment_v1(
    p_identity_id,p_tenant_id,p_branch_id,p_payment_id,p_reason,p_refund_method,p_idempotency_key
  );
end;
$$;

revoke all on function public.post_student_fee_charge_serialized_v1(uuid,bigint,bigint,bigint,bigint,bigint,text,date,date,numeric,text) from public,anon,authenticated;
revoke all on function public.collect_student_fee_payment_serialized_v1(uuid,bigint,bigint,bigint,numeric,text,text,text,text) from public,anon,authenticated;
revoke all on function public.reverse_student_fee_payment_serialized_v1(uuid,bigint,bigint,bigint,text,text,text) from public,anon,authenticated;

grant execute on function public.post_student_fee_charge_serialized_v1(uuid,bigint,bigint,bigint,bigint,bigint,text,date,date,numeric,text) to service_role;
grant execute on function public.collect_student_fee_payment_serialized_v1(uuid,bigint,bigint,bigint,numeric,text,text,text,text) to service_role;
grant execute on function public.reverse_student_fee_payment_serialized_v1(uuid,bigint,bigint,bigint,text,text,text) to service_role;

-- Force application callers through the serialization boundary. The wrappers execute
-- as the migration owner and can still call these implementation functions.
revoke execute on function public.post_student_fee_charge_v1(uuid,bigint,bigint,bigint,bigint,bigint,text,date,date,numeric,text) from service_role;
revoke execute on function public.collect_student_fee_payment_v1(uuid,bigint,bigint,bigint,numeric,text,text,text,text) from service_role;
revoke execute on function public.reverse_student_fee_payment_v1(uuid,bigint,bigint,bigint,text,text,text) from service_role;
