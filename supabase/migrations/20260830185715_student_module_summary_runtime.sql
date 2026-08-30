create or replace function public.get_student_module_summary(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_person_id bigint
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_can_attendance boolean:=false; v_can_finance boolean:=false; v_can_quran boolean:=false; v_can_results boolean:=false;
  v_attendance jsonb:=null; v_finance jsonb:=null; v_quran_count bigint:=null; v_result_count bigint:=null;
  v_invoiced numeric:=0; v_paid_gross numeric:=0; v_refunded numeric:=0; v_currency text:='INR';
begin
  select m.id into v_membership_id from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='students.profile.read')
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'student profile permission denied'; end if;
  if not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_person_id and e.status<>'cancelled') then raise exception 'student is not available in the active branch'; end if;

  select bool_or(rp.permission_code='attendance.student.read'),bool_or(rp.permission_code='finance.fees.read'),bool_or(rp.permission_code='learning.recitation.read'),bool_or(rp.permission_code='assessment.marks.read')
  into v_can_attendance,v_can_finance,v_can_quran,v_can_results
  from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
  where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code in ('attendance.student.read','finance.fees.read','learning.recitation.read','assessment.marks.read');
  v_can_attendance:=coalesce(v_can_attendance,false); v_can_finance:=coalesce(v_can_finance,false); v_can_quran:=coalesce(v_can_quran,false); v_can_results:=coalesce(v_can_results,false);

  if v_can_attendance then
    select jsonb_build_object('present',count(*) filter(where ar.status_category='present'),'absent',count(*) filter(where ar.status_category='absent'),'late',count(*) filter(where ar.status_category='late'),'excused',count(*) filter(where ar.status_category in ('excused','leave')),'total',count(*) filter(where ar.status_category<>'unmarked')) into v_attendance
    from public.attendance_records ar join public.enrollments e on e.tenant_id=ar.tenant_id and e.id=ar.enrollment_id
    where ar.tenant_id=p_tenant_id and ar.person_id=p_person_id and e.branch_id=p_branch_id and e.status<>'cancelled';
  end if;

  if v_can_finance then
    select coalesce(sum(fi.total_amount),0),coalesce(min(fi.currency_code),'INR') into v_invoiced,v_currency from public.fee_invoices fi where fi.tenant_id=p_tenant_id and fi.branch_id=p_branch_id and fi.student_person_id=p_person_id and fi.state not in ('cancelled','reversed');
    select coalesce(sum(p.amount),0) into v_paid_gross from public.payments p where p.tenant_id=p_tenant_id and p.branch_id=p_branch_id and p.student_person_id=p_person_id and p.state in ('verified','posted','refunded');
    select coalesce(sum(pr.amount),0) into v_refunded from public.payment_refunds pr join public.payments p on p.tenant_id=pr.tenant_id and p.id=pr.payment_id where pr.tenant_id=p_tenant_id and p.branch_id=p_branch_id and p.student_person_id=p_person_id and pr.state='completed';
    v_finance:=jsonb_build_object('invoiced',v_invoiced,'paid',greatest(v_paid_gross-v_refunded,0),'outstanding',greatest(v_invoiced-(v_paid_gross-v_refunded),0),'currency',v_currency);
  end if;

  if v_can_quran then select count(*) into v_quran_count from public.recitation_attempts ra join public.recitation_sessions rs on rs.tenant_id=ra.tenant_id and rs.id=ra.recitation_session_id where ra.tenant_id=p_tenant_id and ra.student_person_id=p_person_id and rs.branch_id=p_branch_id; end if;
  if v_can_results then select count(*) into v_result_count from public.result_snapshots r join public.enrollments e on e.tenant_id=r.tenant_id and e.id=r.enrollment_id where r.tenant_id=p_tenant_id and r.student_person_id=p_person_id and e.branch_id=p_branch_id and r.state in ('approved','published'); end if;

  return jsonb_build_object('attendance',v_attendance,'finance',v_finance,'quran_attempts',v_quran_count,'result_count',v_result_count);
end;
$function$;
revoke all on function public.get_student_module_summary(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_student_module_summary(uuid,bigint,bigint,bigint) to service_role;
