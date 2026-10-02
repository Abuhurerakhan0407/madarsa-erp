-- Prevent impossible negative-net salary inputs and empty payroll finalization.
create or replace function public.set_minimal_salary_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_employment_id bigint,p_base numeric,p_allowance numeric,p_deduction numeric,p_effective_from date) returns jsonb
language plpgsql security definer set search_path='' as $$declare v_id bigint;v_allowance numeric:=coalesce(p_allowance,0);v_deduction numeric:=coalesce(p_deduction,0);begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'payroll.manage') then raise exception 'payroll management permission denied';end if;
 if not exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.id=p_employment_id and e.state in('active','on_leave')) then raise exception 'employee not found in branch';end if;
 if p_base is null or p_base<0 or v_allowance<0 or v_deduction<0 or v_deduction>p_base+v_allowance then raise exception 'invalid salary amounts';end if;
 update public.minimal_salary_setups set state='inactive',updated_at=now() where tenant_id=p_tenant_id and branch_id=p_branch_id and employment_id=p_employment_id and state='active';
 insert into public.minimal_salary_setups(tenant_id,branch_id,employment_id,base_salary,default_allowance,default_deduction,effective_from) values(p_tenant_id,p_branch_id,p_employment_id,p_base,v_allowance,v_deduction,coalesce(p_effective_from,current_date)) returning id into v_id;
 return jsonb_build_object('salary_setup_id',v_id);end;$$;

create or replace function public.adjust_minimal_payroll_line_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_line_id bigint,p_allowance numeric,p_deduction numeric,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$declare v_run bigint;v_base numeric;v_allowance numeric:=coalesce(p_allowance,0);v_deduction numeric:=coalesce(p_deduction,0);begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'payroll.manage') then raise exception 'payroll management permission denied';end if;
 select l.run_id,l.base_salary into v_run,v_base from public.minimal_payroll_lines l join public.minimal_payroll_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id where l.tenant_id=p_tenant_id and l.id=p_line_id and r.branch_id=p_branch_id and r.state='draft' for update of l;if v_run is null then raise exception 'editable payroll line not found';end if;
 if v_allowance<0 or v_deduction<0 or v_deduction>v_base+v_allowance then raise exception 'invalid payroll adjustment';end if;
 update public.minimal_payroll_lines set allowance=v_allowance,deduction=v_deduction,note=nullif(btrim(coalesce(p_note,'')),''),updated_at=now() where tenant_id=p_tenant_id and id=p_line_id;return jsonb_build_object('line_id',p_line_id);end;$$;

create or replace function public.set_minimal_payroll_state_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_run_id bigint,p_state text) returns jsonb
language plpgsql security definer set search_path='' as $$declare v_current text;v_count bigint;begin
 if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'payroll.manage') then raise exception 'payroll management permission denied';end if;
 select state into v_current from public.minimal_payroll_runs where tenant_id=p_tenant_id and branch_id=p_branch_id and id=p_run_id for update;if v_current is null then raise exception 'payroll run not found';end if;
 if p_state='finalized' and v_current='draft' then
  select count(*) into v_count from public.minimal_payroll_lines where tenant_id=p_tenant_id and run_id=p_run_id;if v_count=0 then raise exception 'cannot finalize an empty payroll run';end if;
  update public.minimal_payroll_runs set state='finalized',finalized_at=now() where tenant_id=p_tenant_id and id=p_run_id;
 elsif p_state='paid' and v_current='finalized' then update public.minimal_payroll_runs set state='paid',paid_at=now() where tenant_id=p_tenant_id and id=p_run_id;
 else raise exception 'invalid payroll state transition';end if;return jsonb_build_object('run_id',p_run_id,'state',p_state);end;$$;

revoke all on function public.set_minimal_salary_v1(uuid,bigint,bigint,bigint,numeric,numeric,numeric,date) from public,anon,authenticated;
revoke all on function public.adjust_minimal_payroll_line_v1(uuid,bigint,bigint,bigint,numeric,numeric,text) from public,anon,authenticated;
revoke all on function public.set_minimal_payroll_state_v1(uuid,bigint,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.set_minimal_salary_v1(uuid,bigint,bigint,bigint,numeric,numeric,numeric,date) to service_role;
grant execute on function public.adjust_minimal_payroll_line_v1(uuid,bigint,bigint,bigint,numeric,numeric,text) to service_role;
grant execute on function public.set_minimal_payroll_state_v1(uuid,bigint,bigint,bigint,text) to service_role;
