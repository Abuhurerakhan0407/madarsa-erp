-- Guardian-safe fee balance and receipt read for the commercial parent portal.
create or replace function public.get_portal_guardian_fees_v1(
  p_identity_id uuid,
  p_tenant_id bigint
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb := '[]'::jsonb;
begin
  if p_identity_id is null or p_tenant_id is null then
    raise exception 'identity and tenant are required';
  end if;

  if not exists (
    select 1
    from public.identity_person_links l
    where l.tenant_id = p_tenant_id
      and l.identity_id = p_identity_id
      and l.link_type = 'guardian'
      and l.status = 'verified'
  ) then
    return jsonb_build_object('rows', '[]'::jsonb);
  end if;

  with linked_students as (
    select distinct
      sp.person_id as student_person_id,
      sp.student_number,
      child.display_name as student_name,
      e.branch_id
    from public.identity_person_links l
    join public.person_relationships rel
      on rel.tenant_id = l.tenant_id
     and rel.source_person_id = l.person_id
     and rel.status = 'verified'
     and rel.portal_visibility in ('limited','standard')
    join public.student_profiles sp
      on sp.tenant_id = rel.tenant_id
     and sp.person_id = rel.target_person_id
     and sp.status in ('active','admitted')
    join public.persons child
      on child.tenant_id = sp.tenant_id
     and child.id = sp.person_id
    join public.enrollments e
      on e.tenant_id = sp.tenant_id
     and e.student_person_id = sp.person_id
     and e.status in ('active','paused')
    where l.tenant_id = p_tenant_id
      and l.identity_id = p_identity_id
      and l.link_type = 'guardian'
      and l.status = 'verified'
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.student_name, x.due_date desc, x.assignment_id desc), '[]'::jsonb)
  into v_rows
  from (
    select
      a.id as assignment_id,
      ls.student_person_id,
      ls.student_number,
      ls.student_name,
      a.branch_id,
      b.name as branch_name,
      f.name as fee_name,
      a.gross_amount,
      a.concession_amount,
      coalesce(pay.paid, 0) as paid,
      greatest(a.gross_amount - a.concession_amount - coalesce(pay.paid, 0), 0) as outstanding,
      a.due_date,
      a.state,
      coalesce(pay.payments, '[]'::jsonb) as payments
    from linked_students ls
    join public.minimal_fee_assignments a
      on a.tenant_id = p_tenant_id
     and a.student_person_id = ls.student_person_id
     and a.branch_id = ls.branch_id
     and a.state <> 'cancelled'
    join public.minimal_fee_items f
      on f.tenant_id = a.tenant_id
     and f.id = a.fee_item_id
     and f.branch_id = a.branch_id
    join public.branches b
      on b.tenant_id = a.tenant_id
     and b.id = a.branch_id
     and b.status = 'active'
    left join lateral (
      select
        sum(mp.amount) as paid,
        jsonb_agg(
          jsonb_build_object(
            'id', mp.id,
            'amount', mp.amount,
            'payment_date', mp.payment_date,
            'mode', mp.mode,
            'receipt_number', mp.receipt_number,
            'note', mp.note
          )
          order by mp.payment_date desc, mp.id desc
        ) as payments
      from public.minimal_fee_payments mp
      where mp.tenant_id = a.tenant_id
        and mp.branch_id = a.branch_id
        and mp.assignment_id = a.id
    ) pay on true
  ) x;

  return jsonb_build_object('rows', v_rows);
end;
$function$;

revoke all on function public.get_portal_guardian_fees_v1(uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.get_portal_guardian_fees_v1(uuid,bigint)
  to service_role;
