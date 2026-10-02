-- Minimal commercial payroll: salary setup, monthly run, adjustments, finalize, paid state and payslip data.
insert into public.permissions(code,description) values
 ('payroll.read','Read branch payroll'),('payroll.manage','Manage branch payroll')
on conflict(code) do nothing;
insert into public.role_permissions(tenant_id,role_id,permission_code)
select distinct rp.tenant_id,rp.role_id,'payroll.read' from public.role_permissions rp join public.roles r on r.tenant_id=rp.tenant_id and r.id=rp.role_id where r.status='active' and rp.permission_code='hr.employee.read' on conflict do nothing;
insert into public.role_permissions(tenant_id,role_id,permission_code)
select distinct rp.tenant_id,rp.role_id,'payroll.manage' from public.role_permissions rp join public.roles r on r.tenant_id=rp.tenant_id and r.id=rp.role_id where r.status='active' and rp.permission_code='hr.employee.manage' on conflict do nothing;

create table if not exists public.minimal_salary_setups(
 id bigint generated always as identity primary key,tenant_id bigint not null references public.tenants(id) on delete restrict,branch_id bigint not null,employment_id bigint not null,
 base_salary numeric(12,2) not null check(base_salary>=0),default_allowance numeric(12,2) not null default 0 check(default_allowance>=0),default_deduction numeric(12,2) not null default 0 check(default_deduction>=0),
 effective_from date not null,state text not null default 'active' check(state in('active','inactive')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,id),
 foreign key(tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,foreign key(tenant_id,employment_id) references public.hr_employments(tenant_id,id) on delete restrict
);
create index if not exists minimal_salary_setup_lookup on public.minimal_salary_setups(tenant_id,branch_id,employment_id,effective_from desc) where state='active';

create table if not exists public.minimal_payroll_runs(
 id bigint generated always as identity primary key,tenant_id bigint not null references public.tenants(id) on delete restrict,branch_id bigint not null,month_key text not null check(month_key~'^[0-9]{4}-(0[1-9]|1[0-2])$'),
 state text not null default 'draft' check(state in('draft','finalized','paid')),finalized_at timestamptz,paid_at timestamptz,created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,branch_id,month_key),
 foreign key(tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict
);
create table if not exists public.minimal_payroll_lines(
 id bigint generated always as identity primary key,tenant_id bigint not null references public.tenants(id) on delete restrict,run_id bigint not null,employment_id bigint not null,
 base_salary numeric(12,2) not null check(base_salary>=0),allowance numeric(12,2) not null default 0 check(allowance>=0),deduction numeric(12,2) not null default 0 check(deduction>=0),
 net_salary numeric(12,2) generated always as (greatest(base_salary+allowance-deduction,0)) stored,note text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,run_id,employment_id),
 foreign key(tenant_id,run_id) references public.minimal_payroll_runs(tenant_id,id) on delete cascade,foreign key(tenant_id,employment_id) references public.hr_employments(tenant_id,id) on delete restrict
);
alter table public.minimal_salary_setups enable row level security;alter table public.minimal_salary_setups force row level security;
alter table public.minimal_payroll_runs enable row level security;alter table public.minimal_payroll_runs force row level security;
alter table public.minimal_payroll_lines enable row level security;alter table public.minimal_payroll_lines force row level security;
revoke all on public.minimal_salary_setups,public.minimal_payroll_runs,public.minimal_payroll_lines from public,anon,authenticated;

create or replace function public.get_minimal_payroll_workspace_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_month_key text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_employees jsonb;v_runs jsonb;v_lines jsonb;v_month text;v_run bigint;v_summary jsonb;
begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'payroll.read') then raise exception 'payroll read permission denied';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.display_name),'[]'::jsonb) into v_employees from(
  select e.id employment_id,e.employee_number,p.display_name,e.payroll_eligible,e.state,
   s.id salary_setup_id,s.base_salary,s.default_allowance,s.default_deduction,s.effective_from
  from public.hr_employments e join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id
  left join lateral(select ss.id,ss.base_salary,ss.default_allowance,ss.default_deduction,ss.effective_from from public.minimal_salary_setups ss where ss.tenant_id=e.tenant_id and ss.branch_id=e.branch_id and ss.employment_id=e.id and ss.state='active' order by ss.effective_from desc,ss.id desc limit 1)s on true
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.state in('active','on_leave'))x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.month_key desc),'[]'::jsonb) into v_runs from(select id,month_key,state,finalized_at,paid_at from public.minimal_payroll_runs where tenant_id=p_tenant_id and branch_id=p_branch_id order by month_key desc limit 24)x;
 v_month:=nullif(btrim(coalesce(p_month_key,'')),'');
 if v_month is null then select month_key,id into v_month,v_run from public.minimal_payroll_runs where tenant_id=p_tenant_id and branch_id=p_branch_id order by month_key desc limit 1;else select id into v_run from public.minimal_payroll_runs where tenant_id=p_tenant_id and branch_id=p_branch_id and month_key=v_month;end if;
 if v_run is null then v_lines:='[]'::jsonb;v_summary:=jsonb_build_object('employees',0,'gross',0,'allowance',0,'deduction',0,'net',0);else
  select coalesce(jsonb_agg(to_jsonb(x) order by x.display_name),'[]'::jsonb) into v_lines from(
   select l.id,l.run_id,l.employment_id,e.employee_number,p.display_name,l.base_salary,l.allowance,l.deduction,l.net_salary,l.note,r.state run_state
   from public.minimal_payroll_lines l join public.minimal_payroll_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id join public.hr_employments e on e.tenant_id=l.tenant_id and e.id=l.employment_id join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id
   where l.tenant_id=p_tenant_id and l.run_id=v_run)x;
  select jsonb_build_object('employees',count(*),'gross',coalesce(sum(base_salary),0),'allowance',coalesce(sum(allowance),0),'deduction',coalesce(sum(deduction),0),'net',coalesce(sum(net_salary),0)) into v_summary from public.minimal_payroll_lines where tenant_id=p_tenant_id and run_id=v_run;
 end if;
 return jsonb_build_object('employees',v_employees,'runs',v_runs,'selected_month',v_month,'selected_run_id',v_run,'lines',v_lines,'summary',v_summary);
end;$$;

create or replace function public.set_minimal_salary_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_employment_id bigint,p_base numeric,p_allowance numeric,p_deduction numeric,p_effective_from date) returns jsonb
language plpgsql security definer set search_path='' as $$declare v_id bigint;begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'payroll.manage') then raise exception 'payroll management permission denied';end if;
 if not exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.id=p_employment_id and e.state in('active','on_leave')) then raise exception 'employee not found in branch';end if;
 if p_base is null or p_base<0 or coalesce(p_allowance,0)<0 or coalesce(p_deduction,0)<0 then raise exception 'invalid salary amounts';end if;
 update public.minimal_salary_setups set state='inactive',updated_at=now() where tenant_id=p_tenant_id and branch_id=p_branch_id and employment_id=p_employment_id and state='active';
 insert into public.minimal_salary_setups(tenant_id,branch_id,employment_id,base_salary,default_allowance,default_deduction,effective_from) values(p_tenant_id,p_branch_id,p_employment_id,p_base,coalesce(p_allowance,0),coalesce(p_deduction,0),coalesce(p_effective_from,current_date)) returning id into v_id;
 return jsonb_build_object('salary_setup_id',v_id);end;$$;

create or replace function public.prepare_minimal_payroll_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_month_key text) returns jsonb
language plpgsql security definer set search_path='' as $$declare v_run bigint;v_start date;v_count int;begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'payroll.manage') then raise exception 'payroll management permission denied';end if;
 if p_month_key!~'^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'invalid payroll month';end if;v_start:=(p_month_key||'-01')::date;
 insert into public.minimal_payroll_runs(tenant_id,branch_id,month_key) values(p_tenant_id,p_branch_id,p_month_key) on conflict(tenant_id,branch_id,month_key) do nothing;
 select id into v_run from public.minimal_payroll_runs where tenant_id=p_tenant_id and branch_id=p_branch_id and month_key=p_month_key for update;if (select state from public.minimal_payroll_runs where tenant_id=p_tenant_id and id=v_run)<>'draft' then raise exception 'payroll run is already finalized';end if;
 insert into public.minimal_payroll_lines(tenant_id,run_id,employment_id,base_salary,allowance,deduction)
 select p_tenant_id,v_run,e.id,s.base_salary,s.default_allowance,s.default_deduction from public.hr_employments e
 join lateral(select ss.base_salary,ss.default_allowance,ss.default_deduction from public.minimal_salary_setups ss where ss.tenant_id=e.tenant_id and ss.branch_id=e.branch_id and ss.employment_id=e.id and ss.state='active' and ss.effective_from<=v_start order by ss.effective_from desc,ss.id desc limit 1)s on true
 where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.payroll_eligible and e.state in('active','on_leave') on conflict(tenant_id,run_id,employment_id) do nothing;get diagnostics v_count=row_count;
 return jsonb_build_object('run_id',v_run,'added',v_count);end;$$;

create or replace function public.adjust_minimal_payroll_line_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_line_id bigint,p_allowance numeric,p_deduction numeric,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$declare v_run bigint;begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'payroll.manage') then raise exception 'payroll management permission denied';end if;
 select l.run_id into v_run from public.minimal_payroll_lines l join public.minimal_payroll_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id where l.tenant_id=p_tenant_id and l.id=p_line_id and r.branch_id=p_branch_id and r.state='draft' for update of l;if v_run is null then raise exception 'editable payroll line not found';end if;
 if coalesce(p_allowance,0)<0 or coalesce(p_deduction,0)<0 then raise exception 'invalid payroll adjustment';end if;
 update public.minimal_payroll_lines set allowance=coalesce(p_allowance,0),deduction=coalesce(p_deduction,0),note=nullif(btrim(coalesce(p_note,'')),''),updated_at=now() where tenant_id=p_tenant_id and id=p_line_id;return jsonb_build_object('line_id',p_line_id);end;$$;

create or replace function public.set_minimal_payroll_state_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_run_id bigint,p_state text) returns jsonb
language plpgsql security definer set search_path='' as $$declare v_current text;begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'payroll.manage') then raise exception 'payroll management permission denied';end if;
 select state into v_current from public.minimal_payroll_runs where tenant_id=p_tenant_id and branch_id=p_branch_id and id=p_run_id for update;if v_current is null then raise exception 'payroll run not found';end if;
 if p_state='finalized' and v_current='draft' then update public.minimal_payroll_runs set state='finalized',finalized_at=now() where tenant_id=p_tenant_id and id=p_run_id;
 elsif p_state='paid' and v_current='finalized' then update public.minimal_payroll_runs set state='paid',paid_at=now() where tenant_id=p_tenant_id and id=p_run_id;
 else raise exception 'invalid payroll state transition';end if;return jsonb_build_object('run_id',p_run_id,'state',p_state);end;$$;

create or replace function public.get_minimal_payslip_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_line_id bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare v_result jsonb;begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'payroll.read') then raise exception 'payroll read permission denied';end if;
 select to_jsonb(x) into v_result from(select l.id line_id,r.month_key,r.state run_state,e.employee_number,p.display_name,l.base_salary,l.allowance,l.deduction,l.net_salary,l.note from public.minimal_payroll_lines l join public.minimal_payroll_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id join public.hr_employments e on e.tenant_id=l.tenant_id and e.id=l.employment_id join public.persons p on p.tenant_id=e.tenant_id and p.id=e.employee_person_id where l.tenant_id=p_tenant_id and r.branch_id=p_branch_id and l.id=p_line_id)x;if v_result is null then raise exception 'payslip not found';end if;return v_result;end;$$;

revoke all on function public.get_minimal_payroll_workspace_v1(uuid,bigint,bigint,text) from public,anon,authenticated;
revoke all on function public.set_minimal_salary_v1(uuid,bigint,bigint,bigint,numeric,numeric,numeric,date) from public,anon,authenticated;
revoke all on function public.prepare_minimal_payroll_v1(uuid,bigint,bigint,text) from public,anon,authenticated;
revoke all on function public.adjust_minimal_payroll_line_v1(uuid,bigint,bigint,bigint,numeric,numeric,text) from public,anon,authenticated;
revoke all on function public.set_minimal_payroll_state_v1(uuid,bigint,bigint,bigint,text) from public,anon,authenticated;
revoke all on function public.get_minimal_payslip_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_minimal_payroll_workspace_v1(uuid,bigint,bigint,text) to service_role;
grant execute on function public.set_minimal_salary_v1(uuid,bigint,bigint,bigint,numeric,numeric,numeric,date) to service_role;
grant execute on function public.prepare_minimal_payroll_v1(uuid,bigint,bigint,text) to service_role;
grant execute on function public.adjust_minimal_payroll_line_v1(uuid,bigint,bigint,bigint,numeric,numeric,text) to service_role;
grant execute on function public.set_minimal_payroll_state_v1(uuid,bigint,bigint,bigint,text) to service_role;
grant execute on function public.get_minimal_payslip_v1(uuid,bigint,bigint,bigint) to service_role;