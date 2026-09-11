-- Charge options for the operational fee workspace.
-- Amounts come only from published fee structures already configured for the tenant.

create or replace function public.get_student_fee_charge_options_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_membership bigint;
  v_options jsonb;
begin
  v_membership:=private.finance_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.fees.manage');
  if v_membership is null then return '[]'::jsonb; end if;
  if p_student_person_id is null then return '[]'::jsonb; end if;

  with active_enrollment as (
    select e.* from public.enrollments e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active'
    order by e.starts_on desc,e.id desc limit 1
  ), applicable as (
    select distinct
      a.id assignment_id,
      a.fee_structure_version_id,
      s.key structure_key,
      s.version structure_version,
      s.currency_code,
      s.frequency,
      i.fee_item_id,
      i.amount,
      i.sequence,
      fi.key fee_item_key,
      fi.labels fee_item_labels
    from active_enrollment e
    join public.fee_assignments a on a.tenant_id=e.tenant_id
      and a.state='active'
      and a.starts_on<=public.institution_local_date(p_tenant_id)
      and (a.ends_on is null or a.ends_on>=public.institution_local_date(p_tenant_id))
      and (a.branch_id is null or a.branch_id=p_branch_id)
      and (a.student_person_id is null or a.student_person_id=p_student_person_id)
      and (a.enrollment_id is null or a.enrollment_id=e.id)
      and (a.session_id is null or a.session_id=e.session_id)
      and (a.program_id is null or a.program_id=e.program_id)
      and (a.level_id is null or a.level_id=e.level_id)
      and (a.group_id is null or a.group_id=e.group_id)
    join public.fee_structure_versions s on s.tenant_id=a.tenant_id and s.id=a.fee_structure_version_id
      and s.state='published'
      and s.effective_from<=public.institution_local_date(p_tenant_id)
      and (s.effective_to is null or s.effective_to>=public.institution_local_date(p_tenant_id))
    join public.fee_structure_items i on i.tenant_id=s.tenant_id and i.fee_structure_version_id=s.id
    join public.fee_items fi on fi.tenant_id=i.tenant_id and fi.id=i.fee_item_id and fi.state='active'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',assignment_id,'structure_key',structure_key,'structure_version',structure_version,
    'currency_code',currency_code,'frequency',frequency,'fee_item_id',fee_item_id,'fee_item_key',fee_item_key,
    'fee_item_labels',fee_item_labels,'amount',amount,'sequence',sequence
  ) order by structure_key,sequence,fee_item_id),'[]'::jsonb) into v_options
  from applicable;

  return v_options;
end;
$$;

revoke all on function public.get_student_fee_charge_options_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_student_fee_charge_options_v1(uuid,bigint,bigint,bigint) to service_role;
