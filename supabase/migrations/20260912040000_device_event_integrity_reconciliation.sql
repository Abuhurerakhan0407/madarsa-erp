-- Master audit remediation: FUR-AUD-009 / FUR-AUD-011 and retry safety from FUR-AUD-010.
-- Conflicting replays are explicit, staff rescans reconcile rather than poison events,
-- and Furkania student-device application stays blocked until shift semantics are confirmed.

create or replace function public.receive_attendance_device_event_v1(
  p_external_device_key text,
  p_ingest_token text,
  p_external_event_id text,
  p_external_subject_key text,
  p_modality text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_device public.attendance_devices%rowtype;
  v_mapping public.attendance_device_subject_mappings%rowtype;
  v_event public.attendance_device_events%rowtype;
  v_modality text:=lower(btrim(coalesce(p_modality,'')));
  v_type text:=lower(btrim(coalesce(p_event_type,'')));
  v_event_key text:=btrim(coalesce(p_external_event_id,''));
  v_subject_key text:=btrim(coalesce(p_external_subject_key,''));
  v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);
  v_digest text;
begin
  select * into v_device from public.attendance_devices d
  where lower(d.external_device_key)=lower(btrim(coalesce(p_external_device_key,''))) and d.state='active' limit 1;
  if v_device.id is null or p_ingest_token is null or v_device.token_hash<>encode(digest(p_ingest_token,'sha256'),'hex') then raise exception 'device authentication failed'; end if;
  if length(v_event_key) not between 4 and 160 then raise exception 'valid external event id required'; end if;
  if length(v_subject_key) not between 1 and 120 then raise exception 'external subject key required'; end if;
  if v_modality not in('biometric','nfc') then raise exception 'invalid event modality'; end if;
  if v_type not in('presence','check_in','check_out') then raise exception 'invalid device event type'; end if;
  if v_device.modality<>'hybrid' and v_device.modality<>v_modality then raise exception 'event modality does not match device'; end if;
  if p_occurred_at is null or p_occurred_at>now()+interval '10 minutes' or p_occurred_at<now()-interval '90 days' then raise exception 'device event timestamp is outside the accepted window'; end if;
  if jsonb_typeof(v_metadata)<>'object' then raise exception 'device event metadata must be an object'; end if;
  if octet_length(v_metadata::text)>8192 then raise exception 'device event metadata is too large'; end if;
  if v_metadata ?| array['template','biometric_template','fingerprint','fingerprint_image','face_image','image','raw_image','raw_template'] then raise exception 'raw biometric material must not be sent to ERP'; end if;

  v_digest:=encode(digest(jsonb_build_object(
    'external_subject_key',v_subject_key,
    'modality',v_modality,
    'event_type',v_type,
    'occurred_at',p_occurred_at,
    'metadata',v_metadata
  )::text,'sha256'),'hex');

  select * into v_mapping from public.attendance_device_subject_mappings m
  where m.tenant_id=v_device.tenant_id and m.branch_id=v_device.branch_id and m.device_id=v_device.id
    and m.external_subject_key=v_subject_key and m.state='active' limit 1;

  insert into public.attendance_device_events(
    tenant_id,branch_id,device_id,external_event_id,external_subject_key,modality,event_type,occurred_at,state,
    mapping_id,subject_type,student_person_id,employment_id,payload_digest,metadata
  ) values(
    v_device.tenant_id,v_device.branch_id,v_device.id,v_event_key,v_subject_key,v_modality,v_type,p_occurred_at,
    case when v_mapping.id is null then 'received' else 'matched' end,
    v_mapping.id,v_mapping.subject_type,v_mapping.student_person_id,v_mapping.employment_id,v_digest,v_metadata
  ) on conflict(tenant_id,device_id,external_event_id) do nothing
  returning * into v_event;

  if v_event.id is null then
    select * into v_event from public.attendance_device_events e
    where e.tenant_id=v_device.tenant_id and e.device_id=v_device.id and e.external_event_id=v_event_key
    for update;
    if v_event.payload_digest<>v_digest then raise exception 'conflicting device event replay'; end if;
    update public.attendance_devices set last_seen_at=greatest(coalesce(last_seen_at,p_occurred_at),p_occurred_at),updated_at=now()
    where tenant_id=v_device.tenant_id and id=v_device.id;
    return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'matched',v_event.mapping_id is not null,'received_at',v_event.received_at,'unchanged',true);
  end if;

  update public.attendance_devices set last_seen_at=greatest(coalesce(last_seen_at,p_occurred_at),p_occurred_at),updated_at=now()
  where tenant_id=v_device.tenant_id and id=v_device.id;
  return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'matched',v_event.mapping_id is not null,'received_at',v_event.received_at,'unchanged',false);
end;
$$;

create or replace function public.apply_attendance_device_event_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_event_id bigint
) returns jsonb
language plpgsql
security definer
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
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_status text;
begin
  select * into v_event from public.attendance_device_events e
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.id=p_event_id;
  if v_event.id is null then raise exception 'device event not found'; end if;
  if v_event.subject_type='student' then v_required_permission:='attendance.student.mark';
  elsif v_event.subject_type='staff' then v_required_permission:='hr.employee.manage';
  else raise exception 'device event subject type is invalid'; end if;

  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,v_required_permission) then raise exception 'device event apply permission denied'; end if;
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'active membership required'; end if;

  -- Furkania has three named shifts but exact times/session attendance semantics are intentionally unresolved.
  -- Do not collapse a student device scan into one daily record until that client policy is confirmed.
  if v_event.subject_type='student' and exists(select 1 from public.tenants t where t.id=p_tenant_id and t.slug='madrasa-e-furkania') then
    raise exception 'Furkania student device attendance requires confirmed shift attendance policy';
  end if;

  select * into v_event from public.attendance_device_events e
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.id=p_event_id for update;
  if v_event.state='applied' then return jsonb_build_object('event_id',v_event.id,'state','applied','unchanged',true,'attendance_record_id',v_event.attendance_record_id,'hr_attendance_record_id',v_event.hr_attendance_record_id); end if;
  if v_event.mapping_id is null or v_event.state not in('matched','received') then raise exception 'device event requires an active subject mapping'; end if;
  if (v_event.subject_type='student' and v_required_permission<>'attendance.student.mark') or (v_event.subject_type='staff' and v_required_permission<>'hr.employee.manage') then raise exception 'device event subject changed during authorization'; end if;

  select coalesce(nullif(btrim(ip.timezone),''),'UTC') into v_timezone from public.institution_profiles ip where ip.tenant_id=p_tenant_id limit 1;
  v_timezone:=coalesce(v_timezone,'UTC');v_local_date:=(v_event.occurred_at at time zone v_timezone)::date;v_request_key:='attendance-device-event:'||v_event.id::text;

  begin
    if v_event.subject_type='student' then
      v_session:=public.ensure_student_daily_attendance(p_identity_id,p_tenant_id,p_branch_id,v_local_date);
      v_result:=public.mark_student_attendance(p_identity_id,p_tenant_id,p_branch_id,(v_session->>'session_id')::bigint,v_event.student_person_id,'present',v_event.modality,v_request_key,'Device attendance event');
      v_record_id:=(v_result->>'record_id')::bigint;
      update public.attendance_device_events set state='applied',attendance_record_id=v_record_id,applied_at=now(),applied_by_membership_id=v_membership,error_reason=null where tenant_id=p_tenant_id and id=v_event.id;
    else
      select * into v_current from public.hr_effective_attendance_v1 a where a.tenant_id=p_tenant_id and a.employment_id=v_event.employment_id and a.attendance_date=v_local_date limit 1;
      v_status:=coalesce(v_current.status,'present');
      v_check_in:=v_current.check_in_at;v_check_out:=v_current.check_out_at;
      if v_event.event_type='check_out' then
        v_check_out:=case when v_check_out is null then v_event.occurred_at else greatest(v_check_out,v_event.occurred_at) end;
      else
        v_check_in:=case when v_check_in is null then v_event.occurred_at else least(v_check_in,v_event.occurred_at) end;
      end if;
      v_result:=public.record_hr_attendance_v1(
        p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,v_status,v_check_in,v_check_out,'device',v_request_key,
        case when v_current.id is null then null else 'Automated device scan reconciliation' end
      );
      v_record_id:=(v_result->>'attendance_record_id')::bigint;
      update public.attendance_device_events set state='applied',hr_attendance_record_id=v_record_id,applied_at=now(),applied_by_membership_id=v_membership,error_reason=null where tenant_id=p_tenant_id and id=v_event.id;
    end if;
  exception when others then
    -- Keep a valid matched event retryable. Operational/transient failures must not poison it.
    update public.attendance_device_events set error_reason=left(sqlerrm,500),applied_by_membership_id=v_membership
    where tenant_id=p_tenant_id and id=v_event.id and state in('matched','received');
    return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'error',left(sqlerrm,500),'retryable',true);
  end;
  return jsonb_build_object('event_id',v_event.id,'state','applied','subject_type',v_event.subject_type,'attendance_record_id',case when v_event.subject_type='student' then v_record_id else null end,'hr_attendance_record_id',case when v_event.subject_type='staff' then v_record_id else null end,'unchanged',false);
end;
$$;

revoke all on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.apply_attendance_device_event_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb) to service_role;
grant execute on function public.apply_attendance_device_event_v1(uuid,bigint,bigint,bigint) to service_role;
