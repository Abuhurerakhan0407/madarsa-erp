begin;

alter table public.client_v2_notification_settings
  add column if not exists biometric_arrival_enabled boolean not null default true;

insert into public.client_v2_notification_settings(tenant_id)
select t.id from public.tenants t
on conflict(tenant_id) do nothing;

create or replace function public.emit_biometric_arrival_notification_v1(
  p_tenant_id bigint,
  p_branch_id bigint,
  p_person_id bigint,
  p_device_event_id bigint,
  p_occurred_at timestamptz
) returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_enabled boolean := true;
  v_ids uuid[];
  v_timezone text := 'UTC';
  v_local_date date;
  v_local_time text;
begin
  if p_tenant_id is null or p_branch_id is null or p_person_id is null
     or p_device_event_id is null or p_occurred_at is null then
    return null;
  end if;

  select coalesce(s.biometric_arrival_enabled,true)
  into v_enabled
  from public.client_v2_notification_settings s
  where s.tenant_id=p_tenant_id;

  if not coalesce(v_enabled,true) then return null; end if;

  select coalesce(nullif(btrim(ip.timezone),''),'UTC')
  into v_timezone
  from public.institution_profiles ip
  where ip.tenant_id=p_tenant_id
  limit 1;
  v_timezone:=coalesce(v_timezone,'UTC');
  v_local_date:=(p_occurred_at at time zone v_timezone)::date;

  if exists(
    select 1
    from public.attendance_device_events e
    where e.tenant_id=p_tenant_id
      and e.branch_id=p_branch_id
      and e.student_person_id=p_person_id
      and e.modality='biometric'
      and e.state='applied'
      and e.id<>p_device_event_id
      and e.event_type in('presence','check_in')
      and (e.occurred_at at time zone v_timezone)::date=v_local_date
      and e.occurred_at<=p_occurred_at
  ) then
    return null;
  end if;

  v_ids:=private.client_v2_guardian_identities_for_students_v1(
    p_tenant_id,
    array[p_person_id]
  );
  if coalesce(array_length(v_ids,1),0)=0 then return null; end if;

  v_local_time:=to_char(p_occurred_at at time zone v_timezone,'HH12:MI AM');

  return private.emit_client_v2_in_app_v1(
    p_tenant_id,
    'attendance.biometric_arrival',
    'attendance_device_event',
    p_device_event_id::text,
    jsonb_build_object(
      'priority','normal',
      'source_module','Attendance',
      'title',jsonb_build_object(
        'en','Student arrived',
        'ur','طالب علم پہنچ گیا'
      ),
      'body',jsonb_build_object(
        'en','Your child arrived at '||v_local_time||'.',
        'ur','آپ کا بچہ '||v_local_time||' پر پہنچ گیا۔'
      ),
      'link','/portal',
      'branch_id',p_branch_id,
      'student_person_id',p_person_id,
      'occurred_at',p_occurred_at,
      'attendance_date',v_local_date
    ),
    v_ids
  );
end;
$fn$;

revoke all on function public.emit_biometric_arrival_notification_v1(bigint,bigint,bigint,bigint,timestamptz)
  from public,anon,authenticated;
grant execute on function public.emit_biometric_arrival_notification_v1(bigint,bigint,bigint,bigint,timestamptz)
  to service_role;

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
set search_path to pg_catalog, extensions
as $fn$
declare
  v_device public.attendance_devices%rowtype;
  v_mapping public.attendance_device_subject_mappings%rowtype;
  v_event public.attendance_device_events%rowtype;
  v_modality text:=lower(btrim(coalesce(p_modality,'')));
  v_type text:=lower(btrim(coalesce(p_event_type,'')));
  v_event_key text:=btrim(coalesce(p_external_event_id,''));
  v_subject_key text:=btrim(coalesce(p_external_subject_key,''));
  v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);
  v_actor_identity_id uuid;
  v_apply_result jsonb;
  v_retryable boolean:=false;
begin
  select * into v_device
  from public.attendance_devices d
  where lower(d.external_device_key)=lower(btrim(coalesce(p_external_device_key,'')))
    and d.state='active'
    and d.modality='biometric'
  limit 1;

  if v_device.id is null or p_ingest_token is null
    or v_device.token_hash<>encode(digest(p_ingest_token,'sha256'),'hex') then
    raise exception 'device authentication failed';
  end if;
  if v_modality <> 'biometric' then raise exception 'retired attendance modality'; end if;
  if length(v_event_key) not between 4 and 160 then raise exception 'valid external event id required'; end if;
  if length(v_subject_key) not between 1 and 120 then raise exception 'external subject key required'; end if;
  if v_type not in('presence','check_in','check_out') then raise exception 'invalid device event type'; end if;
  if p_occurred_at is null or p_occurred_at>now()+interval '10 minutes'
    or p_occurred_at<now()-interval '90 days' then
    raise exception 'device event timestamp is outside the accepted window';
  end if;
  if jsonb_typeof(v_metadata)<>'object' then raise exception 'device event metadata must be an object'; end if;
  if octet_length(v_metadata::text)>8192 then raise exception 'device event metadata is too large'; end if;
  if v_metadata ?| array[
    'template','biometric_template','fingerprint','fingerprint_image',
    'face_image','image','raw_image','raw_template'
  ] then
    raise exception 'raw biometric material must not be sent to ERP';
  end if;

  select * into v_mapping
  from public.attendance_device_subject_mappings m
  where m.tenant_id=v_device.tenant_id
    and m.branch_id=v_device.branch_id
    and m.device_id=v_device.id
    and m.external_subject_key=v_subject_key
    and m.state='active'
  limit 1;

  insert into public.attendance_device_events(
    tenant_id,branch_id,device_id,external_event_id,external_subject_key,
    modality,event_type,occurred_at,state,mapping_id,subject_type,
    student_person_id,employment_id,payload_digest,metadata
  ) values(
    v_device.tenant_id,v_device.branch_id,v_device.id,v_event_key,v_subject_key,
    'biometric',v_type,p_occurred_at,
    case when v_mapping.id is null then 'received' else 'matched' end,
    v_mapping.id,v_mapping.subject_type,v_mapping.student_person_id,v_mapping.employment_id,
    encode(digest(v_metadata::text,'sha256'),'hex'),v_metadata
  )
  on conflict(tenant_id,device_id,external_event_id)
  do update set
    received_at=clock_timestamp()
  returning * into v_event;

  update public.attendance_devices
  set last_seen_at=greatest(coalesce(last_seen_at,p_occurred_at),p_occurred_at),
      updated_at=now()
  where tenant_id=v_device.tenant_id and id=v_device.id;

  if v_event.mapping_id is not null and v_event.state<>'applied' then
    select m.identity_id
    into v_actor_identity_id
    from public.memberships m
    where m.tenant_id=v_device.tenant_id
      and m.id=v_device.created_by_membership_id
      and m.status='active'
      and (m.starts_at is null or m.starts_at<=now())
      and (m.ends_at is null or m.ends_at>now())
      and (
        m.all_branches
        or exists(
          select 1
          from public.membership_branch_scopes s
          where s.tenant_id=m.tenant_id
            and s.membership_id=m.id
            and s.branch_id=v_device.branch_id
        )
      )
    limit 1;

    if v_actor_identity_id is null then
      v_retryable:=true;
      update public.attendance_device_events
      set state='matched',
          error_reason='Automatic apply actor is unavailable.'
      where tenant_id=v_device.tenant_id and id=v_event.id;
    else
      begin
        v_apply_result:=public.apply_attendance_device_event_v1(
          v_actor_identity_id,
          v_device.tenant_id,
          v_device.branch_id,
          v_event.id
        );
      exception when others then
        v_retryable:=true;
        update public.attendance_device_events
        set state='matched',
            error_reason=left(sqlerrm,500)
        where tenant_id=v_device.tenant_id and id=v_event.id;
      end;
    end if;
  end if;

  select * into v_event
  from public.attendance_device_events e
  where e.tenant_id=v_device.tenant_id and e.id=v_event.id;

  v_retryable:=v_retryable or (
    v_event.mapping_id is not null and v_event.state<>'applied'
  );

  if v_event.state='applied'
    and v_event.subject_type='student'
    and v_event.student_person_id is not null
    and v_event.event_type in('presence','check_in') then
    perform public.emit_biometric_arrival_notification_v1(
      v_event.tenant_id,
      v_event.branch_id,
      v_event.student_person_id,
      v_event.id,
      v_event.occurred_at
    );
  end if;

  return jsonb_build_object(
    'event_id',v_event.id,
    'state',v_event.state,
    'matched',v_event.mapping_id is not null,
    'auto_applied',v_event.state='applied',
    'retryable',v_retryable,
    'error',v_event.error_reason,
    'received_at',v_event.received_at
  );
end;
$fn$;

revoke all on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb)
  from public,anon,authenticated;
grant execute on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb)
  to service_role;

commit;
