-- Minimal commercial fees runtime: fee setup, scoped assignment, concessions, payments and receipts.
insert into public.permissions(code,description) values
 ('finance.fees.read','Read branch fee accounts'),
 ('finance.fees.manage','Manage branch fees and assignments'),
 ('finance.payment.collect','Record branch fee payments')
on conflict(code) do nothing;

-- Least-privilege bootstrap: finance access is inherited only by existing
-- access administrators or established finance operators, never by generic
-- student-read/update roles such as teachers.
insert into public.role_permissions(tenant_id,role_id,permission_code)
select distinct rp.tenant_id,rp.role_id,p.code
from public.role_permissions rp
join public.roles r on r.tenant_id=rp.tenant_id and r.id=rp.role_id
cross join (values('finance.fees.read'),('finance.fees.manage'),('finance.payment.collect')) p(code)
where r.status='active'
  and rp.permission_code in('settings.roles.manage','finance.receipt.reverse')
on conflict do nothing;

create table if not exists public.minimal_fee_items(
 id bigint generated always as identity primary key, tenant_id bigint not null references public.tenants(id) on delete restrict,
 branch_id bigint not null, name text not null check(length(btrim(name)) between 2 and 100),
 amount numeric(12,2) not null check(amount>=0), frequency text not null default 'one_time' check(frequency in('one_time','monthly','term')),
 state text not null default 'active' check(state in('active','inactive')), created_at timestamptz not null default now(),
 unique(tenant_id,id), foreign key(tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict
);
create table if not exists public.minimal_fee_assignments(
 id bigint generated always as identity primary key, tenant_id bigint not null references public.tenants(id) on delete restrict,
 branch_id bigint not null, fee_item_id bigint not null, student_person_id bigint not null, group_id bigint,
 gross_amount numeric(12,2) not null check(gross_amount>=0), concession_amount numeric(12,2) not null default 0 check(concession_amount>=0),
 due_date date not null, state text not null default 'due' check(state in('due','part_paid','paid','waived','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,id),
 unique(tenant_id,fee_item_id,student_person_id,due_date), foreign key(tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
 foreign key(tenant_id,fee_item_id) references public.minimal_fee_items(tenant_id,id) on delete restrict,
 foreign key(tenant_id,student_person_id) references public.student_profiles(tenant_id,person_id) on delete restrict,
 foreign key(tenant_id,group_id) references public.academic_groups(tenant_id,id) on delete restrict,
 constraint minimal_fee_concession_check check(concession_amount<=gross_amount)
);
create table if not exists public.minimal_fee_payments(
 id bigint generated always as identity primary key, tenant_id bigint not null references public.tenants(id) on delete restrict,
 branch_id bigint not null, assignment_id bigint not null, amount numeric(12,2) not null check(amount>0),
 payment_date date not null default current_date, mode text not null check(mode in('cash','bank_transfer','upi','cheque','other')),
 receipt_number text, note text, recorded_by_membership_id bigint not null, created_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,receipt_number), foreign key(tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
 foreign key(tenant_id,assignment_id) references public.minimal_fee_assignments(tenant_id,id) on delete restrict,
 foreign key(tenant_id,recorded_by_membership_id) references public.memberships(tenant_id,id) on delete restrict
);

alter table public.minimal_fee_items enable row level security; alter table public.minimal_fee_items force row level security;
alter table public.minimal_fee_assignments enable row level security; alter table public.minimal_fee_assignments force row level security;
alter table public.minimal_fee_payments enable row level security; alter table public.minimal_fee_payments force row level security;
revoke all on public.minimal_fee_items,public.minimal_fee_assignments,public.minimal_fee_payments from public,anon,authenticated;

create or replace function public.get_minimal_fees_workspace_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_rows jsonb;v_students jsonb;v_groups jsonb;v_summary jsonb;
begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.fees.read') then raise exception 'fee read permission denied'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) into v_items from (
  select id,name,amount,frequency,state from public.minimal_fee_items where tenant_id=p_tenant_id and branch_id=p_branch_id and state='active') x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.due_date desc,x.student_name),'[]'::jsonb) into v_rows from (
  select a.id,a.fee_item_id,f.name fee_name,a.student_person_id,sp.student_number,p.display_name student_name,a.group_id,g.labels group_labels,
   a.gross_amount,a.concession_amount,greatest(a.gross_amount-a.concession_amount-coalesce(pay.paid,0),0) outstanding,
   coalesce(pay.paid,0) paid,a.due_date,a.state,coalesce(pay.payments,'[]'::jsonb) payments
  from public.minimal_fee_assignments a join public.minimal_fee_items f on f.tenant_id=a.tenant_id and f.id=a.fee_item_id
  join public.student_profiles sp on sp.tenant_id=a.tenant_id and sp.person_id=a.student_person_id join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
  left join public.academic_groups g on g.tenant_id=a.tenant_id and g.id=a.group_id
  left join lateral(select sum(mp.amount) paid,jsonb_agg(jsonb_build_object('id',mp.id,'amount',mp.amount,'payment_date',mp.payment_date,'mode',mp.mode,'receipt_number',mp.receipt_number,'note',mp.note) order by mp.payment_date desc,mp.id desc) payments from public.minimal_fee_payments mp where mp.tenant_id=a.tenant_id and mp.assignment_id=a.id) pay on true
  where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.state<>'cancelled') x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.student_name),'[]'::jsonb) into v_students from (
  select distinct e.student_person_id,sp.student_number,p.display_name student_name,e.group_id from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status in('active','paused')) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into v_groups from (select id,labels from public.academic_groups where tenant_id=p_tenant_id and branch_id=p_branch_id and status='active') x;
 select jsonb_build_object('assigned',count(*),'gross',coalesce(sum(gross_amount),0),'concessions',coalesce(sum(concession_amount),0),'paid',coalesce(sum(paid),0),'outstanding',coalesce(sum(outstanding),0)) into v_summary
 from (select a.gross_amount,a.concession_amount,coalesce((select sum(mp.amount) from public.minimal_fee_payments mp where mp.tenant_id=a.tenant_id and mp.assignment_id=a.id),0) paid,greatest(a.gross_amount-a.concession_amount-coalesce((select sum(mp.amount) from public.minimal_fee_payments mp where mp.tenant_id=a.tenant_id and mp.assignment_id=a.id),0),0) outstanding from public.minimal_fee_assignments a where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.state<>'cancelled') q;
 return jsonb_build_object('items',v_items,'rows',v_rows,'students',v_students,'groups',v_groups,'summary',v_summary);
end;$$;

create or replace function public.create_minimal_fee_item_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_name text,p_amount numeric,p_frequency text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare v_id bigint; begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.fees.manage') then raise exception 'fee management permission denied'; end if;
 if length(btrim(coalesce(p_name,''))) not between 2 and 100 or p_amount is null or p_amount<0 or p_frequency not in('one_time','monthly','term') then raise exception 'invalid fee item'; end if;
 insert into public.minimal_fee_items(tenant_id,branch_id,name,amount,frequency) values(p_tenant_id,p_branch_id,btrim(p_name),p_amount,p_frequency) returning id into v_id;
 return jsonb_build_object('fee_item_id',v_id); end;$$;

create or replace function public.assign_minimal_fee_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_fee_item_id bigint,p_student_person_id bigint,p_group_id bigint,p_due_date date,p_amount numeric default null) returns jsonb
language plpgsql security definer set search_path='' as $$ declare v_item public.minimal_fee_items%rowtype;v_count int:=0; begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.fees.manage') then raise exception 'fee management permission denied'; end if;
 if (p_student_person_id is null)=(p_group_id is null) then raise exception 'choose exactly one student or class'; end if;
 select * into v_item from public.minimal_fee_items where tenant_id=p_tenant_id and branch_id=p_branch_id and id=p_fee_item_id and state='active'; if not found then raise exception 'fee item not found'; end if;
 if p_student_person_id is not null then
  if not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status in('active','paused')) then raise exception 'student not active in branch'; end if;
  insert into public.minimal_fee_assignments(tenant_id,branch_id,fee_item_id,student_person_id,group_id,gross_amount,due_date) values(p_tenant_id,p_branch_id,p_fee_item_id,p_student_person_id,null,coalesce(p_amount,v_item.amount),p_due_date) on conflict do nothing; get diagnostics v_count=row_count;
 else
  insert into public.minimal_fee_assignments(tenant_id,branch_id,fee_item_id,student_person_id,group_id,gross_amount,due_date)
  select p_tenant_id,p_branch_id,p_fee_item_id,e.student_person_id,p_group_id,coalesce(p_amount,v_item.amount),p_due_date from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.group_id=p_group_id and e.status in('active','paused') on conflict do nothing; get diagnostics v_count=row_count;
 end if;
 return jsonb_build_object('assigned',v_count); end;$$;

create or replace function public.set_minimal_fee_concession_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_assignment_id bigint,p_concession numeric) returns jsonb
language plpgsql security definer set search_path='' as $$ declare v_a public.minimal_fee_assignments%rowtype; begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.fees.manage') then raise exception 'fee management permission denied'; end if;
 select * into v_a from public.minimal_fee_assignments where tenant_id=p_tenant_id and branch_id=p_branch_id and id=p_assignment_id for update; if not found then raise exception 'fee assignment not found'; end if;
 if p_concession is null or p_concession<0 or p_concession>v_a.gross_amount then raise exception 'invalid concession'; end if;
 update public.minimal_fee_assignments set concession_amount=p_concession,state=case when p_concession=gross_amount then 'waived' else state end,updated_at=now() where tenant_id=p_tenant_id and id=p_assignment_id;
 return jsonb_build_object('assignment_id',p_assignment_id,'concession',p_concession); end;$$;

create or replace function public.record_minimal_fee_payment_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_assignment_id bigint,p_amount numeric,p_payment_date date,p_mode text,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$ declare v_a public.minimal_fee_assignments%rowtype;v_membership bigint;v_paid numeric;v_id bigint;v_receipt text;v_out numeric; begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'finance.payment.collect') then raise exception 'payment collection permission denied'; end if;
 select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' order by m.created_at limit 1; if v_membership is null then raise exception 'membership not found'; end if;
 select * into v_a from public.minimal_fee_assignments where tenant_id=p_tenant_id and branch_id=p_branch_id and id=p_assignment_id and state not in('cancelled','waived') for update; if not found then raise exception 'fee assignment not found'; end if;
 select coalesce(sum(amount),0) into v_paid from public.minimal_fee_payments where tenant_id=p_tenant_id and assignment_id=p_assignment_id; v_out:=greatest(v_a.gross_amount-v_a.concession_amount-v_paid,0);
 if p_amount is null or p_amount<=0 or p_amount>v_out then raise exception 'payment exceeds outstanding amount'; end if; if p_mode not in('cash','bank_transfer','upi','cheque','other') then raise exception 'invalid payment mode'; end if;
 insert into public.minimal_fee_payments(tenant_id,branch_id,assignment_id,amount,payment_date,mode,note,recorded_by_membership_id) values(p_tenant_id,p_branch_id,p_assignment_id,p_amount,coalesce(p_payment_date,current_date),p_mode,nullif(btrim(coalesce(p_note,'')),''),v_membership) returning id into v_id;
 v_receipt:='FEE-'||p_branch_id::text||'-'||lpad(v_id::text,8,'0'); update public.minimal_fee_payments set receipt_number=v_receipt where tenant_id=p_tenant_id and id=v_id;
 v_paid:=v_paid+p_amount; update public.minimal_fee_assignments set state=case when v_paid>=gross_amount-concession_amount then 'paid' else 'part_paid' end,updated_at=now() where tenant_id=p_tenant_id and id=p_assignment_id;
 return jsonb_build_object('payment_id',v_id,'receipt_number',v_receipt,'outstanding',greatest(v_out-p_amount,0)); end;$$;

revoke all on function public.get_minimal_fees_workspace_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.create_minimal_fee_item_v1(uuid,bigint,bigint,text,numeric,text) from public,anon,authenticated;
revoke all on function public.assign_minimal_fee_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,numeric) from public,anon,authenticated;
revoke all on function public.set_minimal_fee_concession_v1(uuid,bigint,bigint,bigint,numeric) from public,anon,authenticated;
revoke all on function public.record_minimal_fee_payment_v1(uuid,bigint,bigint,bigint,numeric,date,text,text) from public,anon,authenticated;
grant execute on function public.get_minimal_fees_workspace_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.create_minimal_fee_item_v1(uuid,bigint,bigint,text,numeric,text) to service_role;
grant execute on function public.assign_minimal_fee_v1(uuid,bigint,bigint,bigint,bigint,bigint,date,numeric) to service_role;
grant execute on function public.set_minimal_fee_concession_v1(uuid,bigint,bigint,bigint,numeric) to service_role;
grant execute on function public.record_minimal_fee_payment_v1(uuid,bigint,bigint,bigint,numeric,date,text,text) to service_role;