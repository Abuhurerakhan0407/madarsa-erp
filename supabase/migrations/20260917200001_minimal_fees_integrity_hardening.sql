-- Keep concessions consistent with payments already received.
create or replace function public.set_minimal_fee_concession_v1(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_assignment_id bigint,p_concession numeric
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_a public.minimal_fee_assignments%rowtype;v_paid numeric;v_due numeric;
begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.fees.manage') then raise exception 'fee management permission denied'; end if;
 select * into v_a from public.minimal_fee_assignments where tenant_id=p_tenant_id and branch_id=p_branch_id and id=p_assignment_id and state<>'cancelled' for update;
 if not found then raise exception 'fee assignment not found'; end if;
 select coalesce(sum(amount),0) into v_paid from public.minimal_fee_payments where tenant_id=p_tenant_id and assignment_id=p_assignment_id;
 if p_concession is null or p_concession<0 or p_concession>v_a.gross_amount-v_paid then raise exception 'concession cannot exceed unpaid fee amount'; end if;
 v_due:=v_a.gross_amount-p_concession;
 update public.minimal_fee_assignments set concession_amount=p_concession,
  state=case when v_due=0 then 'waived' when v_paid>=v_due then 'paid' when v_paid>0 then 'part_paid' else 'due' end,
  updated_at=now()
 where tenant_id=p_tenant_id and id=p_assignment_id;
 return jsonb_build_object('assignment_id',p_assignment_id,'concession',p_concession,'paid',v_paid,'outstanding',greatest(v_due-v_paid,0));
end;$$;
revoke all on function public.set_minimal_fee_concession_v1(uuid,bigint,bigint,bigint,numeric) from public,anon,authenticated;
grant execute on function public.set_minimal_fee_concession_v1(uuid,bigint,bigint,bigint,numeric) to service_role;
