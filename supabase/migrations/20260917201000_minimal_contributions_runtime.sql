-- Minimal commercial contributions runtime: donor registry, Donation/Zakat/Sponsorship entries, receipts and totals.
insert into public.permissions(code,description) values
 ('contributions.record.read','Read branch contributions'),
 ('contributions.record.manage','Manage donors and branch contributions')
on conflict(code) do nothing;

insert into public.role_permissions(tenant_id,role_id,permission_code)
select distinct rp.tenant_id,rp.role_id,'contributions.record.read'
from public.role_permissions rp join public.roles r on r.tenant_id=rp.tenant_id and r.id=rp.role_id
where r.status='active' and rp.permission_code='students.profile.read'
on conflict do nothing;
insert into public.role_permissions(tenant_id,role_id,permission_code)
select distinct rp.tenant_id,rp.role_id,'contributions.record.manage'
from public.role_permissions rp join public.roles r on r.tenant_id=rp.tenant_id and r.id=rp.role_id
where r.status='active' and rp.permission_code='students.profile.update'
on conflict do nothing;

create table if not exists public.minimal_contributors(
 id bigint generated always as identity primary key,
 tenant_id bigint not null references public.tenants(id) on delete restrict,
 branch_id bigint not null,
 name text not null check(length(btrim(name)) between 2 and 120),
 phone text,
 email text,
 note text,
 state text not null default 'active' check(state in('active','inactive')),
 created_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict
);

create table if not exists public.minimal_contributions(
 id bigint generated always as identity primary key,
 tenant_id bigint not null references public.tenants(id) on delete restrict,
 branch_id bigint not null,
 contributor_id bigint not null,
 contribution_type text not null check(contribution_type in('donation','zakat','sponsorship')),
 amount numeric(12,2) not null check(amount>0),
 contribution_date date not null default current_date,
 payment_method text not null check(payment_method in('cash','bank_transfer','upi','cheque','other')),
 fund_label text,
 beneficiary_student_person_id bigint,
 receipt_number text,
 note text,
 recorded_by_membership_id bigint not null,
 created_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,receipt_number),
 foreign key(tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
 foreign key(tenant_id,contributor_id) references public.minimal_contributors(tenant_id,id) on delete restrict,
 foreign key(tenant_id,beneficiary_student_person_id) references public.student_profiles(tenant_id,person_id) on delete restrict,
 foreign key(tenant_id,recorded_by_membership_id) references public.memberships(tenant_id,id) on delete restrict
);

alter table public.minimal_contributors enable row level security; alter table public.minimal_contributors force row level security;
alter table public.minimal_contributions enable row level security; alter table public.minimal_contributions force row level security;
revoke all on public.minimal_contributors,public.minimal_contributions from public,anon,authenticated;

create or replace function public.get_minimal_contributions_workspace_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_donors jsonb;v_rows jsonb;v_students jsonb;v_summary jsonb;
begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'contributions.record.read') then raise exception 'contribution read permission denied'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) into v_donors from (
  select id,name,phone,email,note,state from public.minimal_contributors where tenant_id=p_tenant_id and branch_id=p_branch_id and state='active') x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.contribution_date desc,x.id desc),'[]'::jsonb) into v_rows from (
  select c.id,c.contributor_id,d.name contributor_name,c.contribution_type,c.amount,c.contribution_date,c.payment_method,c.fund_label,c.beneficiary_student_person_id,
   sp.student_number,coalesce(p.display_name,'') beneficiary_name,c.receipt_number,c.note
  from public.minimal_contributions c join public.minimal_contributors d on d.tenant_id=c.tenant_id and d.id=c.contributor_id
  left join public.student_profiles sp on sp.tenant_id=c.tenant_id and sp.person_id=c.beneficiary_student_person_id
  left join public.persons p on p.tenant_id=c.tenant_id and p.id=c.beneficiary_student_person_id
  where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.student_name),'[]'::jsonb) into v_students from (
  select distinct e.student_person_id,sp.student_number,p.display_name student_name from public.enrollments e
  join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
  join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status in('active','paused')) x;
 select jsonb_build_object(
  'total',coalesce(sum(amount),0),
  'donation',coalesce(sum(amount) filter(where contribution_type='donation'),0),
  'zakat',coalesce(sum(amount) filter(where contribution_type='zakat'),0),
  'sponsorship',coalesce(sum(amount) filter(where contribution_type='sponsorship'),0),
  'count',count(*)
 ) into v_summary from public.minimal_contributions where tenant_id=p_tenant_id and branch_id=p_branch_id;
 return jsonb_build_object('contributors',v_donors,'rows',v_rows,'students',v_students,'summary',v_summary);
end;$$;

create or replace function public.create_minimal_contributor_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_name text,p_phone text default null,p_email text default null,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$ declare v_id bigint; begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'contributions.record.manage') then raise exception 'contribution management permission denied'; end if;
 if length(btrim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'invalid contributor name'; end if;
 insert into public.minimal_contributors(tenant_id,branch_id,name,phone,email,note) values(p_tenant_id,p_branch_id,btrim(p_name),nullif(btrim(coalesce(p_phone,'')),''),nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_note,'')),'')) returning id into v_id;
 return jsonb_build_object('contributor_id',v_id); end;$$;

create or replace function public.record_minimal_contribution_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_contributor_id bigint,p_type text,p_amount numeric,p_date date,p_method text,p_fund_label text default null,p_student_person_id bigint default null,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$ declare v_membership bigint;v_id bigint;v_receipt text;begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'contributions.record.manage') then raise exception 'contribution management permission denied'; end if;
 if not exists(select 1 from public.minimal_contributors d where d.tenant_id=p_tenant_id and d.branch_id=p_branch_id and d.id=p_contributor_id and d.state='active') then raise exception 'contributor not found'; end if;
 if p_type not in('donation','zakat','sponsorship') or p_amount is null or p_amount<=0 or p_method not in('cash','bank_transfer','upi','cheque','other') then raise exception 'invalid contribution'; end if;
 if p_student_person_id is not null and not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status in('active','paused')) then raise exception 'beneficiary student not active in branch'; end if;
 select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' order by m.created_at limit 1; if v_membership is null then raise exception 'membership not found'; end if;
 insert into public.minimal_contributions(tenant_id,branch_id,contributor_id,contribution_type,amount,contribution_date,payment_method,fund_label,beneficiary_student_person_id,note,recorded_by_membership_id)
 values(p_tenant_id,p_branch_id,p_contributor_id,p_type,p_amount,coalesce(p_date,current_date),p_method,nullif(btrim(coalesce(p_fund_label,'')),''),p_student_person_id,nullif(btrim(coalesce(p_note,'')),''),v_membership) returning id into v_id;
 v_receipt:='CON-'||p_branch_id::text||'-'||lpad(v_id::text,8,'0'); update public.minimal_contributions set receipt_number=v_receipt where tenant_id=p_tenant_id and id=v_id;
 return jsonb_build_object('contribution_id',v_id,'receipt_number',v_receipt); end;$$;

revoke all on function public.get_minimal_contributions_workspace_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.create_minimal_contributor_v1(uuid,bigint,bigint,text,text,text,text) from public,anon,authenticated;
revoke all on function public.record_minimal_contribution_v1(uuid,bigint,bigint,bigint,text,numeric,date,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.get_minimal_contributions_workspace_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.create_minimal_contributor_v1(uuid,bigint,bigint,text,text,text,text) to service_role;
grant execute on function public.record_minimal_contribution_v1(uuid,bigint,bigint,bigint,text,numeric,date,text,text,bigint,text) to service_role;