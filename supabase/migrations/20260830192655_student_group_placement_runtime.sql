create or replace function public.update_student_group_placement(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint,
  p_group_id bigint default null,
  p_reason text default null
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_enrollment public.enrollments%rowtype;
  v_group_session_id bigint;
  v_group_program_id bigint;
  v_group_branch_id bigint;
  v_group_status text;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_student_person_id is null then
    raise exception 'identity, tenant, branch, and student are required';
  end if;
  if v_reason is not null and length(v_reason)>500 then raise exception 'placement reason is too long'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='academics.enrollment.manage'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'enrollment management permission denied'; end if;

  select e.* into v_enrollment
  from public.enrollments e
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active'
  order by e.created_at desc limit 1 for update;
  if v_enrollment.id is null then raise exception 'active enrollment is not available in this branch'; end if;

  if p_group_id is not null then
    select g.session_id,g.program_id,g.branch_id,g.status into v_group_session_id,v_group_program_id,v_group_branch_id,v_group_status
    from public.academic_groups g where g.tenant_id=p_tenant_id and g.id=p_group_id;
    if v_group_status is null or v_group_status<>'active' or v_group_branch_id<>p_branch_id or v_group_session_id<>v_enrollment.session_id or v_group_program_id<>v_enrollment.program_id then
      raise exception 'selected class or group is not valid for the active enrollment';
    end if;
  end if;

  if v_enrollment.group_id is not distinct from p_group_id then
    return jsonb_build_object('updated',false,'unchanged',true,'enrollment_id',v_enrollment.id,'group_id',v_enrollment.group_id);
  end if;

  update public.enrollments set group_id=p_group_id,version=version+1,updated_at=now()
  where tenant_id=p_tenant_id and id=v_enrollment.id;

  insert into public.enrollment_events(tenant_id,enrollment_id,event_type,from_state,to_state,reason,actor_membership_id,correlation_id)
  values(p_tenant_id,v_enrollment.id,'group_changed',
    jsonb_build_object('status',v_enrollment.status,'session_id',v_enrollment.session_id,'program_id',v_enrollment.program_id,'group_id',v_enrollment.group_id,'version',v_enrollment.version),
    jsonb_build_object('status',v_enrollment.status,'session_id',v_enrollment.session_id,'program_id',v_enrollment.program_id,'group_id',p_group_id,'version',v_enrollment.version+1),
    v_reason,v_membership_id,v_correlation_id);

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state,metadata)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'academics.enrollment.group_change','succeeded','enrollment',v_enrollment.id::text,v_correlation_id,
    jsonb_build_object('student_person_id',p_student_person_id,'group_id',v_enrollment.group_id,'version',v_enrollment.version),
    jsonb_build_object('student_person_id',p_student_person_id,'group_id',p_group_id,'version',v_enrollment.version+1),
    jsonb_build_object('reason',v_reason));

  return jsonb_build_object('updated',true,'unchanged',false,'enrollment_id',v_enrollment.id,'group_id',p_group_id,'version',v_enrollment.version+1);
end;
$function$;

revoke all on function public.update_student_group_placement(uuid,bigint,bigint,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.update_student_group_placement(uuid,bigint,bigint,bigint,bigint,text) to service_role;
