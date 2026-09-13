-- Master audit Phase 0 security hardening.
-- FUR-AUD-002: branch/class scoped reads must not collapse to tenant-wide NULL branch checks.
-- FUR-AUD-003: portal access-state mutations must validate target eligibility in the actor branch.
-- FUR-AUD-004: authorization failures must be side-effect-free for device events.
-- FUR-AUD-005: legacy service-role RPCs must honor active roles/membership validity consistently.

create or replace function private.person_branch_read_allowed_v1(
  p_tenant_id bigint,
  p_person_id bigint
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    exists (
      select 1
      from public.enrollments e
      where e.tenant_id = p_tenant_id
        and e.student_person_id = p_person_id
        and (
          private.has_permission(p_tenant_id, 'people.person.read', e.branch_id)
          or private.has_permission(p_tenant_id, 'students.profile.read', e.branch_id)
        )
    )
    or exists (
      select 1
      from public.hr_employments he
      where he.tenant_id = p_tenant_id
        and he.employee_person_id = p_person_id
        and private.has_permission(p_tenant_id, 'people.person.read', he.branch_id)
    )
    or exists (
      select 1
      from public.person_relationships pr
      join public.enrollments e
        on e.tenant_id = pr.tenant_id
       and e.student_person_id = pr.target_person_id
      where pr.tenant_id = p_tenant_id
        and pr.source_person_id = p_person_id
        and pr.status = 'verified'
        and (
          private.has_permission(p_tenant_id, 'people.person.read', e.branch_id)
          or private.has_permission(p_tenant_id, 'students.profile.read', e.branch_id)
        )
    );
$$;

create or replace function private.student_profile_branch_read_allowed_v1(
  p_tenant_id bigint,
  p_person_id bigint
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.tenant_id = p_tenant_id
      and e.student_person_id = p_person_id
      and private.has_permission(p_tenant_id, 'students.profile.read', e.branch_id)
  );
$$;

create or replace function private.attendance_record_branch_read_allowed_v1(
  p_tenant_id bigint,
  p_attendance_session_id bigint,
  p_enrollment_id bigint
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    exists (
      select 1
      from public.enrollments e
      where e.tenant_id = p_tenant_id
        and e.id = p_enrollment_id
        and (
          private.has_permission(p_tenant_id, 'attendance.student.read', e.branch_id)
          or private.has_permission(p_tenant_id, 'attendance.staff.read', e.branch_id)
        )
    )
    or exists (
      select 1
      from public.attendance_sessions s
      where s.tenant_id = p_tenant_id
        and s.id = p_attendance_session_id
        and (
          private.has_permission(p_tenant_id, 'attendance.student.read', s.branch_id)
          or private.has_permission(p_tenant_id, 'attendance.staff.read', s.branch_id)
        )
    );
$$;

create or replace function private.mark_entry_branch_read_allowed_v1(
  p_tenant_id bigint,
  p_enrollment_id bigint
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.tenant_id = p_tenant_id
      and e.id = p_enrollment_id
      and private.has_permission(p_tenant_id, 'assessment.marks.read', e.branch_id)
  );
$$;

revoke all on function private.person_branch_read_allowed_v1(bigint,bigint) from public, anon;
revoke all on function private.student_profile_branch_read_allowed_v1(bigint,bigint) from public, anon;
revoke all on function private.attendance_record_branch_read_allowed_v1(bigint,bigint,bigint) from public, anon;
revoke all on function private.mark_entry_branch_read_allowed_v1(bigint,bigint) from public, anon;
grant execute on function private.person_branch_read_allowed_v1(bigint,bigint) to authenticated, service_role;
grant execute on function private.student_profile_branch_read_allowed_v1(bigint,bigint) to authenticated, service_role;
grant execute on function private.attendance_record_branch_read_allowed_v1(bigint,bigint,bigint) to authenticated, service_role;
grant execute on function private.mark_entry_branch_read_allowed_v1(bigint,bigint) to authenticated, service_role;

drop policy if exists persons_scoped_read on public.persons;
create policy persons_scoped_read on public.persons
for select to authenticated
using (
  private.person_branch_read_allowed_v1(tenant_id, id)
  or private.has_relationship(tenant_id, id::text, 'read')
);

drop policy if exists student_profiles_scoped_read on public.student_profiles;
create policy student_profiles_scoped_read on public.student_profiles
for select to authenticated
using (
  private.student_profile_branch_read_allowed_v1(tenant_id, person_id)
  or private.has_relationship(tenant_id, person_id::text, 'read')
);

drop policy if exists attendance_records_scoped_read on public.attendance_records;
create policy attendance_records_scoped_read on public.attendance_records
for select to authenticated
using (
  private.attendance_record_branch_read_allowed_v1(tenant_id, attendance_session_id, enrollment_id)
  or private.has_relationship(tenant_id, person_id::text, 'read')
);

drop policy if exists mark_entries_staff_read on public.mark_entries;
create policy mark_entries_staff_read on public.mark_entries
for select to authenticated
using (
  private.mark_entry_branch_read_allowed_v1(tenant_id, enrollment_id)
);

create or replace function public.set_portal_identity_access_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_person_id bigint,
  p_link_type text,
  p_enabled boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'extensions'
as $$
declare
  v_membership bigint;
  v_link_type text := lower(btrim(coalesce(p_link_type,'')));
  v_portal_identity uuid;
begin
  v_membership := public.resolve_portal_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'portal administration permission denied'; end if;
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'portal.credentials.create') then raise exception 'portal credential permission denied'; end if;
  if v_link_type not in ('guardian','employee') then raise exception 'portal link type must be guardian or employee'; end if;

  if v_link_type = 'guardian' then
    if not exists (
      select 1
      from public.guardian_profiles gp
      join public.person_relationships pr
        on pr.tenant_id = gp.tenant_id
       and pr.source_person_id = gp.person_id
       and pr.status = 'verified'
       and pr.portal_visibility in ('limited','standard')
      join public.enrollments e
        on e.tenant_id = pr.tenant_id
       and e.student_person_id = pr.target_person_id
       and e.branch_id = p_branch_id
       and e.status in ('active','paused')
      where gp.tenant_id = p_tenant_id
        and gp.person_id = p_person_id
    ) then
      raise exception 'guardian is not portal-eligible in this branch';
    end if;
  else
    if not exists (
      select 1
      from public.hr_employments he
      where he.tenant_id = p_tenant_id
        and he.branch_id = p_branch_id
        and he.employee_person_id = p_person_id
        and he.state in ('active','on_leave')
    ) then
      raise exception 'employee is not portal-eligible in this branch';
    end if;
  end if;

  select l.identity_id into v_portal_identity
  from public.identity_person_links l
  where l.tenant_id = p_tenant_id
    and l.person_id = p_person_id
    and l.link_type = v_link_type
  order by (l.status='verified') desc, l.updated_at desc, l.id desc
  limit 1;
  if v_portal_identity is null then raise exception 'portal identity link not found'; end if;

  if p_enabled and exists (
    select 1 from public.identity_person_links l
    where l.tenant_id = p_tenant_id
      and l.identity_id = v_portal_identity
      and l.status = 'verified'
      and l.person_id <> p_person_id
  ) then
    raise exception 'identity is already linked to another person in this institution';
  end if;

  update public.identity_person_links
  set status = case when p_enabled then 'verified' else 'revoked' end,
      verified_at = case when p_enabled then now() else verified_at end,
      verified_by_membership_id = case when p_enabled then v_membership else verified_by_membership_id end,
      updated_at = now()
  where tenant_id = p_tenant_id
    and person_id = p_person_id
    and link_type = v_link_type
    and identity_id = v_portal_identity;

  if v_link_type = 'guardian' then
    update public.guardian_profiles
    set portal_invitation_status = case when p_enabled then 'active' else 'revoked' end,
        updated_at = now()
    where tenant_id = p_tenant_id and person_id = p_person_id;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,case when p_enabled then 'portal.identity.enable' else 'portal.identity.disable' end,'succeeded','person',p_person_id::text,gen_random_uuid(),jsonb_build_object('link_type',v_link_type,'enabled',p_enabled));

  return jsonb_build_object('person_id',p_person_id,'link_type',v_link_type,'enabled',p_enabled);
end;
$$;

create or replace function public.apply_attendance_device_event_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_event_id bigint
) returns jsonb
language plpgsql
set search_path to ''
as $$
declare
  v_membership bigint;
  v_event public.attendance_device_events%rowtype;
  v_local_date date;
  v_timezone text;
  v_session jsonb;
  v_result jsonb;
  v_current record;
  v_record_id bigint;
  v_request_key text;
  v_required_permission text;
begin
  select * into v_event
  from public.attendance_device_events e
  where e.tenant_id = p_tenant_id and e.branch_id = p_branch_id and e.id = p_event_id;
  if v_event.id is null then raise exception 'device event not found'; end if;

  if v_event.subject_type = 'student' then
    v_required_permission := 'attendance.student.mark';
  elsif v_event.subject_type = 'staff' then
    v_required_permission := 'hr.employee.manage';
  else
    raise exception 'device event subject type is invalid';
  end if;

  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,v_required_permission) then
    raise exception 'device event apply permission denied';
  end if;

  select m.id into v_membership
  from public.memberships m
  where m.tenant_id = p_tenant_id
    and m.identity_id = p_identity_id
    and m.status = 'active'
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
    and (m.all_branches or exists (
      select 1 from public.membership_branch_scopes s
      where s.tenant_id = m.tenant_id and s.membership_id = m.id and s.branch_id = p_branch_id
    ))
  order by m.created_at
  limit 1;
  if v_membership is null then raise exception 'active membership required'; end if;

  select * into v_event
  from public.attendance_device_events e
  where e.tenant_id = p_tenant_id and e.branch_id = p_branch_id and e.id = p_event_id
  for update;
  if v_event.id is null then raise exception 'device event not found'; end if;
  if v_event.state = 'applied' then
    return jsonb_build_object('event_id',v_event.id,'state','applied','unchanged',true,'attendance_record_id',v_event.attendance_record_id,'hr_attendance_record_id',v_event.hr_attendance_record_id);
  end if;
  if v_event.mapping_id is null or v_event.state not in ('matched','received') then raise exception 'device event requires an active subject mapping'; end if;
  if v_event.subject_type = 'student' and v_required_permission <> 'attendance.student.mark' then raise exception 'device event subject changed during authorization'; end if;
  if v_event.subject_type = 'staff' and v_required_permission <> 'hr.employee.manage' then raise exception 'device event subject changed during authorization'; end if;

  select coalesce(nullif(btrim(ip.timezone),''),'UTC') into v_timezone
  from public.institution_profiles ip where ip.tenant_id = p_tenant_id limit 1;
  v_timezone := coalesce(v_timezone,'UTC');
  v_local_date := (v_event.occurred_at at time zone v_timezone)::date;
  v_request_key := 'attendance-device-event:' || v_event.id::text;

  begin
    if v_event.subject_type = 'student' then
      v_session := public.ensure_student_daily_attendance(p_identity_id,p_tenant_id,p_branch_id,v_local_date);
      v_result := public.mark_student_attendance(p_identity_id,p_tenant_id,p_branch_id,(v_session->>'session_id')::bigint,v_event.student_person_id,'present',v_event.modality,v_request_key,'Device attendance event');
      v_record_id := (v_result->>'record_id')::bigint;
      update public.attendance_device_events
      set state='applied',attendance_record_id=v_record_id,applied_at=now(),applied_by_membership_id=v_membership,error_reason=null
      where tenant_id=p_tenant_id and id=v_event.id;
    elsif v_event.subject_type = 'staff' then
      select * into v_current
      from public.hr_effective_attendance_v1 a
      where a.tenant_id=p_tenant_id and a.employment_id=v_event.employment_id and a.attendance_date=v_local_date
      limit 1;
      if v_event.event_type='check_out' and v_current.id is not null then
        v_result := public.record_hr_attendance_v1(p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,coalesce(v_current.status,'present'),v_current.check_in_at,v_event.occurred_at,'device',v_request_key,'Device check-out reconciliation');
      else
        v_result := public.record_hr_attendance_v1(p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,'present',case when v_event.event_type in ('check_in','presence') then v_event.occurred_at else null end,null,'device',v_request_key,null);
      end if;
      v_record_id := (v_result->>'attendance_record_id')::bigint;
      update public.attendance_device_events
      set state='applied',hr_attendance_record_id=v_record_id,applied_at=now(),applied_by_membership_id=v_membership,error_reason=null
      where tenant_id=p_tenant_id and id=v_event.id;
    else
      raise exception 'device event subject type is invalid';
    end if;
  exception when others then
    if sqlerrm ilike '%permission denied%' or sqlerrm ilike '%active membership required%' then
      raise;
    end if;
    update public.attendance_device_events
    set state='rejected',error_reason=left(sqlerrm,500),applied_by_membership_id=v_membership
    where tenant_id=p_tenant_id and id=v_event.id;
    return jsonb_build_object('event_id',v_event.id,'state','rejected','error',left(sqlerrm,500));
  end;

  return jsonb_build_object('event_id',v_event.id,'state','applied','subject_type',v_event.subject_type,'attendance_record_id',case when v_event.subject_type='student' then v_record_id else null end,'hr_attendance_record_id',case when v_event.subject_type='staff' then v_record_id else null end);
end;
$$;

create or replace function public.record_hr_attendance_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_employment_id bigint,
  p_attendance_date date,
  p_status text,
  p_check_in_at timestamptz default null,
  p_check_out_at timestamptz default null,
  p_source text default 'manual',
  p_request_key text default null,
  p_reason text default null
) returns jsonb
language plpgsql
set search_path to ''
as $$
declare
  v_membership bigint;
  v_record public.hr_attendance_records%rowtype;
  v_effective record;
  v_correction bigint;
  v_local_date date := public.institution_local_date(p_tenant_id);
  v_status text := lower(btrim(coalesce(p_status,'')));
  v_source text := lower(btrim(coalesce(p_source,'')));
begin
  if v_status not in ('present','absent','late','leave','holiday','weekend','unmarked') then raise exception 'invalid staff attendance status'; end if;
  if v_source not in ('manual','device','import','leave','system') then raise exception 'invalid staff attendance source'; end if;
  if p_attendance_date is null or p_attendance_date > v_local_date then raise exception 'future staff attendance is not allowed'; end if;
  if p_check_out_at is not null and p_check_in_at is not null and p_check_out_at < p_check_in_at then raise exception 'check-out cannot be before check-in'; end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'valid attendance request key required'; end if;

  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage') then raise exception 'staff attendance permission denied'; end if;
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'staff attendance permission denied'; end if;

  if not exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.id=p_employment_id and e.branch_id=p_branch_id and e.state in ('active','on_leave','suspended')) then raise exception 'employment not found in active branch'; end if;
  select * into v_record from public.hr_attendance_records a where a.tenant_id=p_tenant_id and a.employment_id=p_employment_id and a.attendance_date=p_attendance_date for update;
  if not found then
    insert into public.hr_attendance_records(tenant_id,employment_id,attendance_date,status,check_in_at,check_out_at,source,source_reference,approved_by_membership_id,idempotency_key)
    values(p_tenant_id,p_employment_id,p_attendance_date,v_status,p_check_in_at,p_check_out_at,v_source,null,v_membership,p_request_key)
    returning * into v_record;
    insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
    values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hr.attendance.mark','succeeded','hr_attendance_record',v_record.id::text,gen_random_uuid(),jsonb_build_object('employment_id',p_employment_id,'date',p_attendance_date,'status',v_status,'source',v_source));
    return jsonb_build_object('attendance_record_id',v_record.id,'corrected',false,'status',v_status);
  end if;
  select * into v_effective from public.hr_effective_attendance_v1 ea where ea.tenant_id=p_tenant_id and ea.id=v_record.id;
  if v_effective.status=v_status and v_effective.check_in_at is not distinct from p_check_in_at and v_effective.check_out_at is not distinct from p_check_out_at and v_effective.source=v_source then
    return jsonb_build_object('attendance_record_id',v_record.id,'corrected',v_effective.latest_correction_id is not null,'unchanged',true,'status',v_status);
  end if;
  if length(btrim(coalesce(p_reason,'')))<4 then raise exception 'attendance correction reason is required'; end if;
  insert into public.hr_attendance_corrections(tenant_id,attendance_record_id,corrected_status,corrected_times,reason,approved_by_membership_id)
  values(p_tenant_id,v_record.id,v_status,jsonb_build_object('check_in_at',p_check_in_at,'check_out_at',p_check_out_at,'source',v_source),btrim(p_reason),v_membership)
  returning id into v_correction;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'hr.attendance.correct','succeeded','hr_attendance_correction',v_correction::text,gen_random_uuid(),jsonb_build_object('attendance_record_id',v_record.id,'employment_id',p_employment_id,'date',p_attendance_date,'status',v_status,'reason',btrim(p_reason)));
  return jsonb_build_object('attendance_record_id',v_record.id,'correction_id',v_correction,'corrected',true,'status',v_status);
end;
$$;

create or replace function public.queue_guardian_whatsapp_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint,
  p_template_id bigint,
  p_variables jsonb,
  p_request_key text
) returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'extensions'
as $$
declare
  v_membership bigint;v_guardian bigint;v_guardian_identity uuid;v_contact public.person_contacts%rowtype;v_student record;v_template public.notification_templates%rowtype;v_policy public.notification_policies%rowtype;v_config public.notification_channel_configs%rowtype;v_event bigint;v_resolution bigint;v_dispatch bigint;v_state text;v_reason text;v_consent text;v_locale text;v_payload jsonb;v_existing public.notification_dispatches%rowtype;
begin
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'valid WhatsApp request key required'; end if;
  if p_variables is null or jsonb_typeof(p_variables)<>'object' or octet_length(p_variables::text)>8192 then raise exception 'WhatsApp variables must be a small object'; end if;

  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'notification.message.send') then raise exception 'WhatsApp send permission denied'; end if;
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'WhatsApp send permission denied'; end if;

  select * into v_existing from public.notification_dispatches d where d.tenant_id=p_tenant_id and d.idempotency_key=p_request_key limit 1;
  if v_existing.id is not null then return jsonb_build_object('dispatch_id',v_existing.id,'state',v_existing.state,'unchanged',true); end if;
  select e.student_person_id,sp.student_number,p.display_name into v_student
  from public.enrollments e
  join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
  join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active' and sp.status in('active','admitted')
  order by e.id desc limit 1;
  if v_student.student_person_id is null then raise exception 'active branch student required'; end if;
  select pr.source_person_id into v_guardian from public.person_relationships pr where pr.tenant_id=p_tenant_id and pr.target_person_id=p_student_person_id and pr.status='verified' and pr.is_primary=true order by pr.id limit 1;
  if v_guardian is null then raise exception 'primary verified guardian required'; end if;
  select * into v_contact from public.person_contacts pc where pc.tenant_id=p_tenant_id and pc.person_id=v_guardian and pc.type='phone' and pc.is_primary=true order by pc.id limit 1;
  if v_contact.id is null or nullif(btrim(coalesce(v_contact.normalized_value,v_contact.value)), '') is null then raise exception 'guardian phone required'; end if;
  select ipl.identity_id into v_guardian_identity from public.identity_person_links ipl where ipl.tenant_id=p_tenant_id and ipl.person_id=v_guardian and ipl.status='verified' order by ipl.id limit 1;
  select * into v_template from public.notification_templates t where t.tenant_id=p_tenant_id and t.id=p_template_id and t.channel='whatsapp' and t.state='published';
  if v_template.id is null then raise exception 'published WhatsApp template required'; end if;
  select * into v_policy from public.notification_policies p where p.tenant_id=p_tenant_id and p.id=v_template.policy_id and p.state='published';
  if v_policy.id is null then raise exception 'published WhatsApp policy required'; end if;
  select * into v_config from public.notification_channel_configs c where c.tenant_id=p_tenant_id and c.channel='whatsapp';
  v_consent:=coalesce(v_contact.consent#>>'{whatsapp,status}','not_recorded');
  v_locale:=coalesce((select p.preferred_locale from public.persons p where p.tenant_id=p_tenant_id and p.id=v_guardian),v_template.locale,'en');
  v_payload:=jsonb_build_object('branch_id',p_branch_id,'student_person_id',p_student_person_id,'student_number',v_student.student_number,'student_name',v_student.display_name,'guardian_person_id',v_guardian,'template_id',v_template.id,'variables',p_variables);
  insert into public.domain_notification_events(tenant_id,event_key,aggregate_type,aggregate_id,payload,payload_digest,occurred_at,idempotency_key)
  values(p_tenant_id,v_policy.event_key,'student',p_student_person_id::text,v_payload,encode(digest(v_payload::text,'sha256'),'hex'),now(),p_request_key)
  returning id into v_event;
  insert into public.notification_recipient_resolutions(tenant_id,event_id,recipient_identity_id,related_person_id,relationship_evidence,locale,channels,consent_snapshot)
  values(p_tenant_id,v_event,v_guardian_identity,v_guardian,jsonb_build_object('relationship','primary_guardian','student_person_id',p_student_person_id),v_locale,array['whatsapp']::text[],jsonb_build_object('whatsapp',coalesce(v_contact.consent->'whatsapp','{}'::jsonb)))
  returning id into v_resolution;
  if v_consent<>'opted_in' then v_state:='blocked';v_reason:='WhatsApp opt-in is not recorded';
  elsif v_config.id is null or v_config.state<>'active' or v_config.encrypted_config_reference is null or v_config.sender_reference is null then v_state:='blocked';v_reason:='WhatsApp provider is not fully configured';
  elsif v_template.provider_template_reference is null then v_state:='blocked';v_reason:='Provider-approved WhatsApp template reference is missing';
  else v_state:='queued';v_reason:=null;end if;
  insert into public.notification_dispatches(tenant_id,event_id,recipient_resolution_id,template_id,channel,destination_hash,rendered_digest,state,last_error,idempotency_key)
  values(p_tenant_id,v_event,v_resolution,v_template.id,'whatsapp',encode(digest(coalesce(v_contact.normalized_value,v_contact.value),'sha256'),'hex'),encode(digest(v_template.body_template||':'||p_variables::text,'sha256'),'hex'),v_state,case when v_reason is null then null else jsonb_build_object('reason',v_reason) end,p_request_key)
  returning id into v_dispatch;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'notification.whatsapp.queue','succeeded','notification_dispatch',v_dispatch::text,gen_random_uuid(),jsonb_build_object('student_person_id',p_student_person_id,'guardian_person_id',v_guardian,'template_id',v_template.id,'state',v_state,'blocked_reason',v_reason));
  return jsonb_build_object('dispatch_id',v_dispatch,'event_id',v_event,'state',v_state,'blocked_reason',v_reason,'unchanged',false);
end;
$$;
