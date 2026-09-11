-- Master audit remediation: FUR-AUD-010.
-- Automatic device processing is bound to an explicit real active membership.
-- No synthetic service user is created and no attendance permission is bypassed.

create table if not exists public.attendance_device_processor_configs (
  tenant_id bigint not null,
  branch_id bigint not null,
  student_processor_membership_id bigint,
  staff_processor_membership_id bigint,
  state text not null default 'active' check (state in('active','disabled')),
  configured_by_membership_id bigint not null,
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(tenant_id,branch_id),
  foreign key(tenant_id) references public.tenants(id) on delete restrict,
  foreign key(tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
  foreign key(tenant_id,student_processor_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  foreign key(tenant_id,staff_processor_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  foreign key(tenant_id,configured_by_membership_id) references public.memberships(tenant_id,id) on delete restrict
);

alter table public.attendance_device_processor_configs enable row level security;

create or replace function public.configure_attendance_device_processor_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_membership bigint;
  v_student boolean;
  v_staff boolean;
begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'active branch membership required'; end if;
  v_student:=public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'attendance.student.mark');
  v_staff:=public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage');
  if not v_student and not v_staff then raise exception 'attendance device processing permission denied'; end if;

  insert into public.attendance_device_processor_configs(
    tenant_id,branch_id,student_processor_membership_id,staff_processor_membership_id,state,configured_by_membership_id
  ) values(
    p_tenant_id,p_branch_id,case when v_student then v_membership else null end,case when v_staff then v_membership else null end,'active',v_membership
  ) on conflict(tenant_id,branch_id) do update set
    student_processor_membership_id=case when v_student then excluded.student_processor_membership_id else attendance_device_processor_configs.student_processor_membership_id end,
    staff_processor_membership_id=case when v_staff then excluded.staff_processor_membership_id else attendance_device_processor_configs.staff_processor_membership_id end,
    state='active',configured_by_membership_id=excluded.configured_by_membership_id,configured_at=now(),updated_at=now();

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'attendance.device.processor.configure','succeeded','branch',p_branch_id::text,gen_random_uuid(),jsonb_build_object('student_processor',v_student,'staff_processor',v_staff));
  return jsonb_build_object('branch_id',p_branch_id,'student_processor_configured',v_student,'staff_processor_configured',v_staff);
end;
$$;

create or replace function public.process_attendance_device_event_auto_v1(p_event_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_event public.attendance_device_events%rowtype;
  v_config public.attendance_device_processor_configs%rowtype;
  v_membership_id bigint;
  v_identity_id uuid;
  v_permission text;
  v_result jsonb;
begin
  select * into v_event from public.attendance_device_events e where e.id=p_event_id;
  if v_event.id is null then raise exception 'device event not found'; end if;
  if v_event.state='applied' then return jsonb_build_object('event_id',v_event.id,'state','applied','unchanged',true); end if;
  if v_event.mapping_id is null or v_event.state<>'matched' then return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'processing','waiting_for_active_mapping'); end if;

  select * into v_config from public.attendance_device_processor_configs c
  where c.tenant_id=v_event.tenant_id and c.branch_id=v_event.branch_id and c.state='active';
  if v_config.tenant_id is null then return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'processing','waiting_for_processor_configuration'); end if;

  if v_event.subject_type='student' then v_membership_id:=v_config.student_processor_membership_id;v_permission:='attendance.student.mark';
  elsif v_event.subject_type='staff' then v_membership_id:=v_config.staff_processor_membership_id;v_permission:='hr.employee.manage';
  else return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'processing','waiting_for_valid_subject_mapping'); end if;
  if v_membership_id is null then return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'processing','waiting_for_processor_permission'); end if;

  select m.identity_id into v_identity_id from public.memberships m
  where m.tenant_id=v_event.tenant_id and m.id=v_membership_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=v_event.branch_id));
  if v_identity_id is null or not public.operator_has_permission_v1(v_identity_id,v_event.tenant_id,v_event.branch_id,v_permission) then
    return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'processing','processor_authorization_expired');
  end if;

  begin
    v_result:=public.apply_attendance_device_event_v1(v_identity_id,v_event.tenant_id,v_event.branch_id,v_event.id);
    return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('processing','automatic');
  exception when others then
    return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'processing','retryable','error',left(sqlerrm,500));
  end;
end;
$$;

create or replace function public.process_pending_attendance_device_events_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_limit integer default 25
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_allowed boolean;v_event record;v_results jsonb:='[]'::jsonb;v_limit integer:=least(100,greatest(1,coalesce(p_limit,25)));
begin
  v_allowed:=public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'attendance.student.mark') or public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage');
  if not v_allowed then raise exception 'attendance device processing permission denied'; end if;
  for v_event in
    select e.id from public.attendance_device_events e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.state='matched'
    order by e.occurred_at,e.id limit v_limit
  loop
    v_results:=v_results||jsonb_build_array(public.process_attendance_device_event_auto_v1(v_event.id));
  end loop;
  return jsonb_build_object('processed',jsonb_array_length(v_results),'results',v_results);
end;
$$;

revoke all on function public.configure_attendance_device_processor_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.process_attendance_device_event_auto_v1(bigint) from public,anon,authenticated;
revoke all on function public.process_pending_attendance_device_events_v1(uuid,bigint,bigint,integer) from public,anon,authenticated;
grant execute on function public.configure_attendance_device_processor_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.process_attendance_device_event_auto_v1(bigint) to service_role;
grant execute on function public.process_pending_attendance_device_events_v1(uuid,bigint,bigint,integer) to service_role;
