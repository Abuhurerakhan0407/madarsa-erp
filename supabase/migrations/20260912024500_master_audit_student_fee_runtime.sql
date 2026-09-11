-- Master audit remediation: FUR-AUD-006 operational student-fee runtime.
-- This migration intentionally does not create Furkania fee amounts/policies.
-- It exposes safe operations over the existing finance foundation once approved fee configuration exists.

create table if not exists public.payment_allocation_reversals (
  id bigint generated always as identity primary key,
  tenant_id bigint not null,
  payment_id bigint not null,
  payment_allocation_id bigint not null,
  fee_charge_id bigint not null,
  payment_refund_id bigint not null,
  amount numeric(14,2) not null check (amount > 0),
  reason text not null check (length(btrim(reason)) >= 4),
  created_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, payment_refund_id, payment_allocation_id),
  foreign key (tenant_id) references public.tenants(id) on delete restrict,
  foreign key (tenant_id, payment_id) references public.payments(tenant_id,id) on delete restrict,
  foreign key (tenant_id, payment_allocation_id) references public.payment_allocations(tenant_id,id) on delete restrict,
  foreign key (tenant_id, fee_charge_id) references public.fee_charges(tenant_id,id) on delete restrict,
  foreign key (tenant_id, payment_refund_id) references public.payment_refunds(tenant_id,id) on delete restrict,
  foreign key (tenant_id, created_by_membership_id) references public.memberships(tenant_id,id) on delete restrict
);

alter table public.payment_allocation_reversals enable row level security;

drop policy if exists payment_allocation_reversals_scoped_read on public.payment_allocation_reversals;
create policy payment_allocation_reversals_scoped_read on public.payment_allocation_reversals
for select to authenticated using (
  exists (
    select 1 from public.payments p
    where p.tenant_id=payment_allocation_reversals.tenant_id
      and p.id=payment_allocation_reversals.payment_id
      and (
        private.has_permission(p.tenant_id,'finance.payment.collect',p.branch_id)
        or private.has_permission(p.tenant_id,'finance.payment.reverse',p.branch_id)
        or (p.student_person_id is not null and private.has_relationship(p.tenant_id,p.student_person_id::text,'read'))
      )
  )
);

drop trigger if exists payment_allocation_reversals_append_only on public.payment_allocation_reversals;
create trigger payment_allocation_reversals_append_only
before update or delete on public.payment_allocation_reversals
for each row execute function private.reject_append_only_mutation();

drop trigger if exists payment_allocation_reversals_immutable_tenant on public.payment_allocation_reversals;
create trigger payment_allocation_reversals_immutable_tenant
before update of tenant_id on public.payment_allocation_reversals
for each row execute function private.enforce_immutable_tenant_id();

alter table public.payment_refunds add column if not exists idempotency_key text;
create unique index if not exists payment_refunds_tenant_id_idempotency_key_uidx
  on public.payment_refunds(tenant_id,idempotency_key) where idempotency_key is not null;

create or replace function private.finance_operator_membership_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_permission_code text
) returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare v_membership_id bigint;
begin
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,p_permission_code) then
    return null;
  end if;
  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id
    and m.identity_id=p_identity_id
    and m.status='active'
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id
    ))
  order by m.created_at asc limit 1;
  return v_membership_id;
end;
$$;

revoke all on function private.finance_operator_membership_v1(uuid,bigint,bigint,text) from public,anon,authenticated;
grant execute on function private.finance_operator_membership_v1(uuid,bigint,bigint,text) to service_role;

create or replace function public.get_student_fee_workspace_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_membership bigint;
  v_students jsonb;
  v_charges jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_structures jsonb := '[]'::jsonb;
begin
  v_membership:=private.finance_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.fees.read');
  if v_membership is null then
    v_membership:=private.finance_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.payment.collect');
  end if;
  if v_membership is null then raise exception 'student fee read permission denied'; end if;

  select coalesce(jsonb_agg(x order by x->>'name'),'[]'::jsonb) into v_students
  from (
    select distinct jsonb_build_object(
      'person_id',e.student_person_id,
      'student_number',sp.student_number,
      'name',p.display_name,
      'enrollment_id',e.id,
      'group_id',e.group_id,
      'program_id',e.program_id,
      'level_id',e.level_id
    ) x
    from public.enrollments e
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
      and sp.status in('active','admitted')
    order by x->>'name'
    limit 250
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'key',s.key,'version',s.version,'currency_code',s.currency_code,
    'frequency',s.frequency,'effective_from',s.effective_from,'effective_to',s.effective_to,'state',s.state
  ) order by s.effective_from desc,s.id desc),'[]'::jsonb) into v_structures
  from public.fee_structure_versions s
  where s.tenant_id=p_tenant_id and s.state='published';

  if p_student_person_id is not null then
    if not exists(
      select 1 from public.enrollments e
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active'
    ) then raise exception 'active branch student required'; end if;

    with charge_rows as (
      select c.*,
        coalesce((select sum(a.amount) from public.fee_adjustments a where a.tenant_id=c.tenant_id and a.fee_charge_id=c.id),0) adjustment_amount,
        coalesce((select sum(w.amount) from public.fee_write_offs w where w.tenant_id=c.tenant_id and w.fee_charge_id=c.id),0) write_off_amount,
        coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.tenant_id=c.tenant_id and pa.fee_charge_id=c.id),0) allocated_amount,
        coalesce((select sum(r.amount) from public.payment_allocation_reversals r where r.tenant_id=c.tenant_id and r.fee_charge_id=c.id),0) reversed_allocation_amount,
        fi.key fee_item_key,fi.labels fee_item_labels
      from public.fee_charges c
      join public.fee_items fi on fi.tenant_id=c.tenant_id and fi.id=c.fee_item_id
      where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id and c.student_person_id=p_student_person_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'fee_item_id',fee_item_id,'fee_item_key',fee_item_key,'fee_item_labels',fee_item_labels,
      'period_key',period_key,'charge_date',charge_date,'due_date',due_date,'currency_code',currency_code,
      'gross_amount',gross_amount,'concession_amount',concession_amount,'fine_amount',fine_amount,'net_amount',net_amount,
      'adjustment_amount',adjustment_amount,'write_off_amount',write_off_amount,
      'allocated_amount',allocated_amount,'reversed_allocation_amount',reversed_allocation_amount,
      'outstanding_amount',greatest(0,(net_amount+adjustment_amount-write_off_amount)-(allocated_amount-reversed_allocation_amount)),
      'state',state
    ) order by due_date,id),'[]'::jsonb) into v_charges from charge_rows;

    with payment_rows as (
      select p.*,
        coalesce((select sum(a.amount) from public.payment_allocations a where a.tenant_id=p.tenant_id and a.payment_id=p.id),0) allocated_amount,
        coalesce((select sum(r.amount) from public.payment_allocation_reversals r where r.tenant_id=p.tenant_id and r.payment_id=p.id),0) reversed_amount,
        (select jsonb_build_object('receipt_number',pr.receipt_number,'revision',pr.revision,'state',pr.state,'verification_code',pr.verification_code,'issued_at',pr.issued_at)
         from public.payment_receipts pr where pr.tenant_id=p.tenant_id and pr.payment_id=p.id order by pr.revision desc limit 1) receipt
      from public.payments p
      where p.tenant_id=p_tenant_id and p.branch_id=p_branch_id and p.student_person_id=p_student_person_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'payment_date',payment_date,'currency_code',currency_code,'amount',amount,'mode',mode,
      'provider_reference',provider_reference,'state',state,'allocated_amount',allocated_amount,'reversed_amount',reversed_amount,
      'effective_amount',greatest(0,allocated_amount-reversed_amount),'receipt',receipt,'created_at',created_at
    ) order by created_at desc,id desc),'[]'::jsonb) into v_payments from payment_rows;
  end if;

  return jsonb_build_object(
    'students',v_students,
    'selected_student_person_id',p_student_person_id,
    'published_structures',v_structures,
    'charges',v_charges,
    'payments',v_payments,
    'fee_configuration_ready',jsonb_array_length(v_structures)>0
  );
end;
$$;

create or replace function public.post_student_fee_charge_v1(
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
declare
  v_membership bigint;
  v_assignment public.fee_assignments%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_structure public.fee_structure_versions%rowtype;
  v_item public.fee_structure_items%rowtype;
  v_existing public.fee_charges%rowtype;
  v_charge public.fee_charges%rowtype;
begin
  v_membership:=private.finance_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.fees.manage');
  if v_membership is null then raise exception 'student fee management permission denied'; end if;
  if p_student_person_id is null or p_fee_assignment_id is null or p_fee_item_id is null then raise exception 'student, fee assignment, and fee item are required'; end if;
  if nullif(btrim(coalesce(p_period_key,'')),'') is null or length(p_period_key)>80 then raise exception 'valid fee period key required'; end if;
  if p_charge_date is null or p_due_date is null or p_due_date<p_charge_date then raise exception 'valid charge and due dates required'; end if;
  if p_concession_amount is null or p_concession_amount<0 then raise exception 'concession amount cannot be negative'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 128 then raise exception 'valid fee charge request key required'; end if;

  select * into v_existing from public.fee_charges c where c.tenant_id=p_tenant_id and c.idempotency_key=p_idempotency_key limit 1;
  if v_existing.id is not null then
    if v_existing.branch_id<>p_branch_id or v_existing.student_person_id<>p_student_person_id or v_existing.fee_assignment_id<>p_fee_assignment_id or v_existing.fee_item_id<>p_fee_item_id or v_existing.period_key<>p_period_key then
      raise exception 'fee charge request key conflicts with another request';
    end if;
    return jsonb_build_object('charge_id',v_existing.id,'state',v_existing.state,'net_amount',v_existing.net_amount,'unchanged',true);
  end if;

  select * into v_enrollment from public.enrollments e
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active'
  order by e.starts_on desc,e.id desc limit 1;
  if v_enrollment.id is null then raise exception 'active branch enrollment required'; end if;

  select * into v_assignment from public.fee_assignments a
  where a.tenant_id=p_tenant_id and a.id=p_fee_assignment_id and a.state='active'
    and a.starts_on<=p_charge_date and (a.ends_on is null or a.ends_on>=p_charge_date)
    and (a.branch_id is null or a.branch_id=p_branch_id)
    and (a.student_person_id is null or a.student_person_id=p_student_person_id)
    and (a.enrollment_id is null or a.enrollment_id=v_enrollment.id)
    and (a.session_id is null or a.session_id=v_enrollment.session_id)
    and (a.program_id is null or a.program_id=v_enrollment.program_id)
    and (a.level_id is null or a.level_id=v_enrollment.level_id)
    and (a.group_id is null or a.group_id=v_enrollment.group_id)
  limit 1;
  if v_assignment.id is null then raise exception 'fee assignment does not apply to this student'; end if;

  select * into v_structure from public.fee_structure_versions s
  where s.tenant_id=p_tenant_id and s.id=v_assignment.fee_structure_version_id and s.state='published'
    and s.effective_from<=p_charge_date and (s.effective_to is null or s.effective_to>=p_charge_date);
  if v_structure.id is null then raise exception 'published fee structure is required'; end if;

  select * into v_item from public.fee_structure_items i
  where i.tenant_id=p_tenant_id and i.fee_structure_version_id=v_structure.id and i.fee_item_id=p_fee_item_id;
  if v_item.id is null then raise exception 'fee item is not part of the assigned structure'; end if;
  if p_concession_amount>v_item.amount then raise exception 'concession cannot exceed the configured fee amount'; end if;

  insert into public.fee_charges(
    tenant_id,branch_id,enrollment_id,student_person_id,fee_assignment_id,fee_item_id,period_key,
    charge_date,due_date,currency_code,gross_amount,concession_amount,fine_amount,state,idempotency_key
  ) values(
    p_tenant_id,p_branch_id,v_enrollment.id,p_student_person_id,v_assignment.id,p_fee_item_id,btrim(p_period_key),
    p_charge_date,p_due_date,v_structure.currency_code,v_item.amount,p_concession_amount,0,'posted',p_idempotency_key
  ) returning * into v_charge;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'finance.fee.charge.post','succeeded','fee_charge',v_charge.id::text,gen_random_uuid(),
    jsonb_build_object('student_person_id',p_student_person_id,'period_key',p_period_key,'gross_amount',v_charge.gross_amount,'concession_amount',v_charge.concession_amount,'net_amount',v_charge.net_amount,'currency_code',v_charge.currency_code));

  return jsonb_build_object('charge_id',v_charge.id,'state',v_charge.state,'net_amount',v_charge.net_amount,'currency_code',v_charge.currency_code,'unchanged',false);
end;
$$;

create or replace function public.collect_student_fee_payment_v1(
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
declare
  v_membership bigint;
  v_payment public.payments%rowtype;
  v_existing public.payments%rowtype;
  v_charge record;
  v_remaining numeric(14,2);
  v_apply numeric(14,2);
  v_sequence integer:=0;
  v_receipt public.payment_receipts%rowtype;
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_mode text:=lower(btrim(coalesce(p_mode,'')));
  v_total_outstanding numeric(14,2):=0;
begin
  v_membership:=private.finance_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.payment.collect');
  if v_membership is null then raise exception 'student payment collection permission denied'; end if;
  if p_student_person_id is null or not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active') then raise exception 'active branch student required'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'payment amount must be positive'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'valid payment currency required'; end if;
  if v_mode not in('cash','bank_transfer','cheque','upi','credit','sponsorship','custom') then raise exception 'payment mode is not supported by operator collection'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 128 then raise exception 'valid payment request key required'; end if;

  select * into v_existing from public.payments p where p.tenant_id=p_tenant_id and p.idempotency_key=p_idempotency_key limit 1;
  if v_existing.id is not null then
    if v_existing.branch_id<>p_branch_id or v_existing.student_person_id is distinct from p_student_person_id or v_existing.amount<>p_amount or v_existing.currency_code<>v_currency or v_existing.mode<>v_mode then
      raise exception 'payment request key conflicts with another request';
    end if;
    select * into v_receipt from public.payment_receipts r where r.tenant_id=p_tenant_id and r.payment_id=v_existing.id order by r.revision desc limit 1;
    return jsonb_build_object('payment_id',v_existing.id,'state',v_existing.state,'receipt_number',v_receipt.receipt_number,'verification_code',v_receipt.verification_code,'unchanged',true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(format('student_fee_payment:%s:%s:%s',p_tenant_id,p_branch_id,p_student_person_id),0));

  select coalesce(sum(x.outstanding),0) into v_total_outstanding
  from (
    select greatest(0,(c.net_amount
      +coalesce((select sum(a.amount) from public.fee_adjustments a where a.tenant_id=c.tenant_id and a.fee_charge_id=c.id),0)
      -coalesce((select sum(w.amount) from public.fee_write_offs w where w.tenant_id=c.tenant_id and w.fee_charge_id=c.id),0))
      -(coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.tenant_id=c.tenant_id and pa.fee_charge_id=c.id),0)
        -coalesce((select sum(r.amount) from public.payment_allocation_reversals r where r.tenant_id=c.tenant_id and r.fee_charge_id=c.id),0))) outstanding
    from public.fee_charges c
    where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id and c.student_person_id=p_student_person_id
      and c.currency_code=v_currency and c.state not in('waived','written_off','reversed')
  ) x;
  if v_total_outstanding<=0 then raise exception 'student has no outstanding charges in this currency'; end if;
  if p_amount>v_total_outstanding then raise exception 'payment cannot exceed outstanding charges'; end if;

  insert into public.payments(
    tenant_id,branch_id,student_person_id,payment_date,currency_code,amount,mode,provider_reference,
    state,verification_source,verified_at,idempotency_key,received_by_membership_id
  ) values(
    p_tenant_id,p_branch_id,p_student_person_id,public.institution_local_date(p_tenant_id),v_currency,p_amount,v_mode,nullif(btrim(coalesce(p_provider_reference,'')),''),
    'verified','operator_verified',now(),p_idempotency_key,v_membership
  ) returning * into v_payment;

  v_remaining:=p_amount;
  for v_charge in
    select c.id,c.due_date,
      greatest(0,(c.net_amount
        +coalesce((select sum(a.amount) from public.fee_adjustments a where a.tenant_id=c.tenant_id and a.fee_charge_id=c.id),0)
        -coalesce((select sum(w.amount) from public.fee_write_offs w where w.tenant_id=c.tenant_id and w.fee_charge_id=c.id),0))
        -(coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.tenant_id=c.tenant_id and pa.fee_charge_id=c.id),0)
          -coalesce((select sum(r.amount) from public.payment_allocation_reversals r where r.tenant_id=c.tenant_id and r.fee_charge_id=c.id),0))) outstanding
    from public.fee_charges c
    where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id and c.student_person_id=p_student_person_id
      and c.currency_code=v_currency and c.state not in('waived','written_off','reversed')
    order by c.due_date,c.charge_date,c.id
    for update
  loop
    exit when v_remaining<=0;
    if v_charge.outstanding<=0 then continue; end if;
    v_apply:=least(v_remaining,v_charge.outstanding);
    v_sequence:=v_sequence+1;
    insert into public.payment_allocations(tenant_id,payment_id,fee_charge_id,amount,sequence,allocation_rule_snapshot)
    values(p_tenant_id,v_payment.id,v_charge.id,v_apply,v_sequence,jsonb_build_object('rule','oldest_due_first_v1','outstanding_before',v_charge.outstanding));
    v_remaining:=v_remaining-v_apply;
    update public.fee_charges set state=case when v_apply>=v_charge.outstanding then 'paid' else 'part_paid' end where tenant_id=p_tenant_id and id=v_charge.id;
  end loop;
  if v_remaining<>0 then raise exception 'payment allocation did not consume the full amount'; end if;

  insert into public.payment_receipts(tenant_id,payment_id,receipt_number,revision,amount,verification_code,state)
  values(p_tenant_id,v_payment.id,format('FEE-%s-%s',p_tenant_id,v_payment.id),1,v_payment.amount,gen_random_uuid()::text,'issued')
  returning * into v_receipt;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'finance.payment.collect','succeeded','payment',v_payment.id::text,gen_random_uuid(),
    jsonb_build_object('student_person_id',p_student_person_id,'amount',v_payment.amount,'currency_code',v_payment.currency_code,'mode',v_payment.mode,'receipt_number',v_receipt.receipt_number));

  return jsonb_build_object('payment_id',v_payment.id,'state',v_payment.state,'receipt_number',v_receipt.receipt_number,'verification_code',v_receipt.verification_code,'unchanged',false);
end;
$$;

create or replace function public.reverse_student_fee_payment_v1(
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
declare
  v_membership bigint;
  v_payment public.payments%rowtype;
  v_refund public.payment_refunds%rowtype;
  v_existing_refund public.payment_refunds%rowtype;
  v_allocation record;
  v_unreversed numeric(14,2);
  v_receipt public.payment_receipts%rowtype;
  v_revision integer;
  v_reason text:=btrim(coalesce(p_reason,''));
begin
  v_membership:=private.finance_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.payment.reverse');
  if v_membership is null then raise exception 'student payment reversal permission denied'; end if;
  if length(v_reason)<4 then raise exception 'payment reversal reason is required'; end if;
  if nullif(btrim(coalesce(p_refund_method,'')),'') is null then raise exception 'refund method is required'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 128 then raise exception 'valid reversal request key required'; end if;

  select * into v_existing_refund from public.payment_refunds r where r.tenant_id=p_tenant_id and r.idempotency_key=p_idempotency_key limit 1;
  if v_existing_refund.id is not null then
    if v_existing_refund.payment_id<>p_payment_id then raise exception 'reversal request key conflicts with another payment'; end if;
    return jsonb_build_object('payment_id',p_payment_id,'refund_id',v_existing_refund.id,'state',v_existing_refund.state,'unchanged',true);
  end if;

  select * into v_payment from public.payments p
  where p.tenant_id=p_tenant_id and p.branch_id=p_branch_id and p.id=p_payment_id
  for update;
  if v_payment.id is null then raise exception 'payment not found in active branch'; end if;
  if v_payment.state='reversed' then raise exception 'payment is already reversed'; end if;
  if v_payment.state not in('verified','posted') then raise exception 'only verified or posted payments can be reversed'; end if;
  if v_payment.journal_id is not null then raise exception 'posted accounting payment requires journal reversal workflow'; end if;

  insert into public.payment_refunds(tenant_id,payment_id,amount,method,beneficiary_snapshot,state,reason,idempotency_key)
  values(p_tenant_id,v_payment.id,v_payment.amount,btrim(p_refund_method),jsonb_build_object('student_person_id',v_payment.student_person_id),'completed',v_reason,p_idempotency_key)
  returning * into v_refund;

  for v_allocation in
    select a.id,a.fee_charge_id,a.amount,
      a.amount-coalesce((select sum(r.amount) from public.payment_allocation_reversals r where r.tenant_id=a.tenant_id and r.payment_allocation_id=a.id),0) unreversed
    from public.payment_allocations a
    where a.tenant_id=p_tenant_id and a.payment_id=v_payment.id
    order by a.sequence desc,a.id desc
    for update
  loop
    v_unreversed:=greatest(0,v_allocation.unreversed);
    if v_unreversed>0 then
      insert into public.payment_allocation_reversals(tenant_id,payment_id,payment_allocation_id,fee_charge_id,payment_refund_id,amount,reason,created_by_membership_id)
      values(p_tenant_id,v_payment.id,v_allocation.id,v_allocation.fee_charge_id,v_refund.id,v_unreversed,v_reason,v_membership);
    end if;
  end loop;

  update public.payments set state='reversed' where tenant_id=p_tenant_id and id=v_payment.id;

  for v_allocation in
    select distinct a.fee_charge_id
    from public.payment_allocations a where a.tenant_id=p_tenant_id and a.payment_id=v_payment.id
  loop
    update public.fee_charges c set state=case
      when greatest(0,(c.net_amount
        +coalesce((select sum(x.amount) from public.fee_adjustments x where x.tenant_id=c.tenant_id and x.fee_charge_id=c.id),0)
        -coalesce((select sum(w.amount) from public.fee_write_offs w where w.tenant_id=c.tenant_id and w.fee_charge_id=c.id),0))
        -(coalesce((select sum(a.amount) from public.payment_allocations a where a.tenant_id=c.tenant_id and a.fee_charge_id=c.id),0)
          -coalesce((select sum(r.amount) from public.payment_allocation_reversals r where r.tenant_id=c.tenant_id and r.fee_charge_id=c.id),0)))=0
        then 'paid'
      when (coalesce((select sum(a.amount) from public.payment_allocations a where a.tenant_id=c.tenant_id and a.fee_charge_id=c.id),0)
          -coalesce((select sum(r.amount) from public.payment_allocation_reversals r where r.tenant_id=c.tenant_id and r.fee_charge_id=c.id),0))>0
        then 'part_paid'
      else 'posted' end
    where c.tenant_id=p_tenant_id and c.id=v_allocation.fee_charge_id and c.state not in('waived','written_off','reversed');
  end loop;

  select * into v_receipt from public.payment_receipts r where r.tenant_id=p_tenant_id and r.payment_id=v_payment.id order by r.revision desc limit 1;
  if v_receipt.id is not null then
    v_revision:=v_receipt.revision+1;
    insert into public.payment_receipts(tenant_id,payment_id,receipt_number,revision,amount,verification_code,state)
    values(p_tenant_id,v_payment.id,v_receipt.receipt_number,v_revision,v_payment.amount,gen_random_uuid()::text,'reversed');
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'finance.payment.reverse','succeeded','payment',v_payment.id::text,gen_random_uuid(),
    jsonb_build_object('refund_id',v_refund.id,'amount',v_refund.amount,'reason',v_reason,'method',v_refund.method));

  return jsonb_build_object('payment_id',v_payment.id,'refund_id',v_refund.id,'state','reversed','unchanged',false);
end;
$$;

revoke all on function public.get_student_fee_workspace_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.post_student_fee_charge_v1(uuid,bigint,bigint,bigint,bigint,bigint,text,date,date,numeric,text) from public,anon,authenticated;
revoke all on function public.collect_student_fee_payment_v1(uuid,bigint,bigint,bigint,numeric,text,text,text,text) from public,anon,authenticated;
revoke all on function public.reverse_student_fee_payment_v1(uuid,bigint,bigint,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.get_student_fee_workspace_v1(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.post_student_fee_charge_v1(uuid,bigint,bigint,bigint,bigint,bigint,text,date,date,numeric,text) to service_role;
grant execute on function public.collect_student_fee_payment_v1(uuid,bigint,bigint,bigint,numeric,text,text,text,text) to service_role;
grant execute on function public.reverse_student_fee_payment_v1(uuid,bigint,bigint,bigint,text,text,text) to service_role;
