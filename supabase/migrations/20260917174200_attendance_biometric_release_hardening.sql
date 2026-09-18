begin;

-- Commercial release scope is biometric-only. Preserve historical rows, but retire
-- every legacy non-biometric device/mapping from active operational use.
update public.attendance_devices
set state = 'inactive', updated_at = now()
where modality <> 'biometric' and state = 'active';

update public.attendance_device_subject_mappings m
set state = 'inactive', updated_at = now()
where state = 'active'
  and exists (
    select 1 from public.attendance_devices d
    where d.tenant_id = m.tenant_id
      and d.id = m.device_id
      and d.modality <> 'biometric'
  );

create or replace function public.enforce_biometric_attendance_scope_v1()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_table_name = 'attendance_devices' then
    if (tg_op = 'INSERT' and new.modality <> 'biometric')
      or (tg_op = 'UPDATE' and new.modality is distinct from old.modality and new.modality <> 'biometric') then
      raise exception 'Ilmgaah attendance devices are biometric-only';
    end if;
    return new;
  end if;
  if tg_table_name = 'attendance_device_events' then
    if (tg_op = 'INSERT' and new.modality <> 'biometric')
      or (tg_op = 'UPDATE' and new.modality is distinct from old.modality and new.modality <> 'biometric') then
      raise exception 'Ilmgaah attendance events are biometric-only';
    end if;
    return new;
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_biometric_attendance_scope_v1() from public, anon, authenticated;
grant execute on function public.enforce_biometric_attendance_scope_v1() to service_role;

drop trigger if exists attendance_devices_biometric_scope_guard on public.attendance_devices;
create trigger attendance_devices_biometric_scope_guard
before insert or update of modality on public.attendance_devices
for each row execute function public.enforce_biometric_attendance_scope_v1();

drop trigger if exists attendance_device_events_biometric_scope_guard on public.attendance_device_events;
create trigger attendance_device_events_biometric_scope_guard
before insert or update of modality on public.attendance_device_events
for each row execute function public.enforce_biometric_attendance_scope_v1();

-- Device ingest is biometric-only at the database boundary too, not only in the API.
create or replace function public.receive_attendance_device_event_v1(
 p_external_device_key text,p_ingest_token text,p_external_event_id text,p_external_subject_key text,p_modality text,p_event_type text,p_occurred_at timestamptz,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path to pg_catalog, extensions as $fn$
declare
  v_device public.attendance_devices%rowtype;
  v_mapping public.attendance_device_subject_mappings%rowtype;
  v_event public.attendance_device_events%rowtype;
  v_modality text:=lower(btrim(coalesce(p_modality,'')));
  v_type text:=lower(btrim(coalesce(p_event_type,'')));
  v_event_key text:=btrim(coalesce(p_external_event_id,''));
  v_subject_key text:=btrim(coalesce(p_external_subject_key,''));
  v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);
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
  if p_occurred_at is null or p_occurred_at>now()+interval '10 minutes' or p_occurred_at<now()-interval '90 days' then
    raise exception 'device event timestamp is outside the accepted window';
  end if;
  if jsonb_typeof(v_metadata)<>'object' then raise exception 'device event metadata must be an object'; end if;
  if octet_length(v_metadata::text)>8192 then raise exception 'device event metadata is too large'; end if;
  if v_metadata ?| array['template','biometric_template','fingerprint','fingerprint_image','face_image','image','raw_image','raw_template'] then
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
    tenant_id,branch_id,device_id,external_event_id,external_subject_key,modality,event_type,occurred_at,
    state,mapping_id,subject_type,student_person_id,employment_id,payload_digest,metadata
  ) values(
    v_device.tenant_id,v_device.branch_id,v_device.id,v_event_key,v_subject_key,'biometric',v_type,p_occurred_at,
    case when v_mapping.id is null then 'received' else 'matched' end,
    v_mapping.id,v_mapping.subject_type,v_mapping.student_person_id,v_mapping.employment_id,
    encode(digest(v_metadata::text,'sha256'),'hex'),v_metadata
  )
  on conflict(tenant_id,device_id,external_event_id)
  do update set external_event_id=excluded.external_event_id
  returning * into v_event;

  update public.attendance_devices
  set last_seen_at=greatest(coalesce(last_seen_at,p_occurred_at),p_occurred_at),updated_at=now()
  where tenant_id=v_device.tenant_id and id=v_device.id;

  return jsonb_build_object(
    'event_id',v_event.id,
    'state',v_event.state,
    'matched',v_event.mapping_id is not null,
    'received_at',v_event.received_at
  );
end;
$fn$;

revoke all on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb)
  from public,anon,authenticated;
grant execute on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb)
  to service_role;

-- Application is permission-gated before any event state mutation. Failures remain
-- retryable as matched events with an error reason instead of becoming dead forever.
create or replace function public.apply_attendance_device_event_v1(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_event_id bigint
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
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
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id
    and m.identity_id=p_identity_id
    and m.status='active'
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id
    ))
  order by m.created_at
  limit 1;
  if v_membership is null then raise exception 'active membership required'; end if;

  select * into v_event
  from public.attendance_device_events e
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.id=p_event_id
  for update;
  if v_event.id is null then raise exception 'device event not found'; end if;
  if v_event.modality <> 'biometric' then raise exception 'retired attendance modality'; end if;
  if v_event.state='applied' then
    return jsonb_build_object('event_id',v_event.id,'state','applied','unchanged',true,
      'attendance_record_id',v_event.attendance_record_id,'hr_attendance_record_id',v_event.hr_attendance_record_id);
  end if;
  if v_event.mapping_id is null or v_event.state not in('matched','received') then
    raise exception 'device event requires an active subject mapping';
  end if;

  if v_event.subject_type='student' then
    if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'attendance.student.mark') then
      raise exception 'student attendance marking permission denied';
    end if;
  elsif v_event.subject_type='staff' then
    if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage') then
      raise exception 'staff attendance permission denied';
    end if;
  else
    raise exception 'device event subject type is invalid';
  end if;

  select coalesce(nullif(btrim(ip.timezone),''),'UTC') into v_timezone
  from public.institution_profiles ip
  where ip.tenant_id=p_tenant_id
  limit 1;
  v_timezone:=coalesce(v_timezone,'UTC');
  v_local_date:=(v_event.occurred_at at time zone v_timezone)::date;
  v_request_key:='attendance-device-event:'||v_event.id::text;

  begin
    if v_event.subject_type='student' then
      v_session:=public.ensure_student_daily_attendance(p_identity_id,p_tenant_id,p_branch_id,v_local_date);
      v_result:=public.mark_student_attendance(
        p_identity_id,p_tenant_id,p_branch_id,(v_session->>'session_id')::bigint,
        v_event.student_person_id,'present','biometric',v_request_key,'Biometric attendance event'
      );
      v_record_id:=(v_result->>'record_id')::bigint;
      update public.attendance_device_events
      set state='applied',attendance_record_id=v_record_id,applied_at=now(),
          applied_by_membership_id=v_membership,error_reason=null
      where tenant_id=p_tenant_id and id=v_event.id;

    elsif v_event.subject_type='staff' then
      select * into v_current
      from public.hr_effective_attendance_v1 a
      where a.tenant_id=p_tenant_id
        and a.employment_id=v_event.employment_id
        and a.attendance_date=v_local_date
      limit 1;

      if v_current.id is not null then
        if v_event.event_type='check_out'
          and (v_current.check_out_at is null or v_event.occurred_at>v_current.check_out_at) then
          v_result:=public.record_hr_attendance_v1(
            p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,
            coalesce(v_current.status,'present'),v_current.check_in_at,v_event.occurred_at,
            'device',v_request_key,'Biometric check-out reconciliation'
          );
          v_record_id:=(v_result->>'attendance_record_id')::bigint;
        elsif v_event.event_type='check_in' and v_current.check_in_at is null then
          v_result:=public.record_hr_attendance_v1(
            p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,
            coalesce(v_current.status,'present'),v_event.occurred_at,v_current.check_out_at,
            'device',v_request_key,'Biometric check-in reconciliation'
          );
          v_record_id:=(v_result->>'attendance_record_id')::bigint;
        else
          v_record_id:=v_current.id;
        end if;
      else
        v_result:=public.record_hr_attendance_v1(
          p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,'present',
          case when v_event.event_type in('check_in','presence') then v_event.occurred_at else null end,
          case when v_event.event_type='check_out' then v_event.occurred_at else null end,
          'device',v_request_key,null
        );
        v_record_id:=(v_result->>'attendance_record_id')::bigint;
      end if;

      update public.attendance_device_events
      set state='applied',hr_attendance_record_id=v_record_id,applied_at=now(),
          applied_by_membership_id=v_membership,error_reason=null
      where tenant_id=p_tenant_id and id=v_event.id;
    end if;
  exception when others then
    update public.attendance_device_events
    set state='matched',error_reason=left(sqlerrm,500),applied_by_membership_id=null
    where tenant_id=p_tenant_id and id=v_event.id;
    return jsonb_build_object('event_id',v_event.id,'state','matched','retryable',true,'error',left(sqlerrm,500));
  end;

  return jsonb_build_object(
    'event_id',v_event.id,'state','applied','subject_type',v_event.subject_type,
    'attendance_record_id',case when v_event.subject_type='student' then v_record_id else null end,
    'hr_attendance_record_id',case when v_event.subject_type='staff' then v_record_id else null end
  );
end;
$fn$;
revoke all on function public.apply_attendance_device_event_v1(uuid,bigint,bigint,bigint)
  from public,anon,authenticated;
grant execute on function public.apply_attendance_device_event_v1(uuid,bigint,bigint,bigint)
  to service_role;

-- Fix the release insights contract: the inbox state is "matched", never "mapped",
-- and retired modalities must not appear in current biometric scan summaries.
create or replace function public.get_attendance_v2_insights_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_attendance_date date
) returns jsonb
language plpgsql stable
set search_path to 'pg_catalog','extensions'
as $function$
declare
  v_membership bigint;
  v_timezone text:='UTC';
  v_daily numeric:=0;
  v_weekly numeric:=0;
  v_monthly numeric:=0;
  v_trend jsonb;
  v_scans jsonb;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'attendance.student.read')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'student attendance read permission denied'; end if;
  select coalesce(nullif(timezone,''),'UTC') into v_timezone
  from public.institution_profiles where tenant_id=p_tenant_id limit 1;
  v_timezone:=coalesce(v_timezone,'UTC');

  select coalesce(round(avg(ar.presence_ratio)*100,1),0) into v_daily
  from public.attendance_records ar join public.attendance_sessions s
    on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id
  where ar.tenant_id=p_tenant_id and s.branch_id=p_branch_id
    and s.attendance_date=p_attendance_date and ar.status_category<>'unmarked';

  select coalesce(round(avg(ar.presence_ratio)*100,1),0) into v_weekly
  from public.attendance_records ar join public.attendance_sessions s
    on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id
  where ar.tenant_id=p_tenant_id and s.branch_id=p_branch_id
    and s.attendance_date between p_attendance_date-6 and p_attendance_date
    and ar.status_category<>'unmarked';

  select coalesce(round(avg(ar.presence_ratio)*100,1),0) into v_monthly
  from public.attendance_records ar join public.attendance_sessions s
    on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id
  where ar.tenant_id=p_tenant_id and s.branch_id=p_branch_id
    and s.attendance_date between p_attendance_date-29 and p_attendance_date
    and ar.status_category<>'unmarked';

  select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date),'[]'::jsonb) into v_trend
  from (
    select s.attendance_date,count(*)::int recorded,round(avg(ar.presence_ratio)*100,1) attendance_percent
    from public.attendance_records ar join public.attendance_sessions s
      on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id
    where ar.tenant_id=p_tenant_id and s.branch_id=p_branch_id
      and s.attendance_date between p_attendance_date-29 and p_attendance_date
      and ar.status_category<>'unmarked'
    group by s.attendance_date
  ) x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.person_id),'[]'::jsonb) into v_scans
  from (
    select e.student_person_id person_id,
      min(e.occurred_at) first_scan,
      max(e.occurred_at) last_scan,
      string_agg(distinct d.label,', ' order by d.label) device_label,
      'biometric'::text modality
    from public.attendance_device_events e
    join public.attendance_devices d on d.tenant_id=e.tenant_id and d.id=e.device_id
    where e.tenant_id=p_tenant_id
      and e.branch_id=p_branch_id
      and e.student_person_id is not null
      and e.modality='biometric'
      and d.modality='biometric'
      and (e.occurred_at at time zone v_timezone)::date=p_attendance_date
      and e.state in('received','matched','applied')
    group by e.student_person_id
  ) x;

  return jsonb_build_object(
    'daily_percent',v_daily,'weekly_percent',v_weekly,'monthly_percent',v_monthly,
    'trend',v_trend,'scans',v_scans
  );
end;
$function$;
create or replace function public.get_hr_attendance_v2_insights_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_attendance_date date
) returns jsonb
language plpgsql stable
set search_path to 'pg_catalog','extensions'
as $function$
declare
  v_membership bigint;
  v_timezone text:='UTC';
  v_daily numeric:=0;
  v_weekly numeric:=0;
  v_monthly numeric:=0;
  v_trend jsonb;
  v_scans jsonb;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.read')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'staff attendance read permission denied'; end if;

  select coalesce(nullif(timezone,''),'UTC') into v_timezone
  from public.institution_profiles where tenant_id=p_tenant_id limit 1;
  v_timezone:=coalesce(v_timezone,'UTC');

  with a as (
    select h.attendance_date,
      case when h.status in('present','late') then 1.0 when h.status='absent' then 0.0 else null end ratio
    from public.hr_effective_attendance_v1 h
    join public.hr_employments e on e.tenant_id=h.tenant_id and e.id=h.employment_id
    where h.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and h.attendance_date between p_attendance_date-29 and p_attendance_date
  )
  select
    coalesce(round(avg(ratio)*100,1) filter(where attendance_date=p_attendance_date),0),
    coalesce(round(avg(ratio)*100,1) filter(where attendance_date between p_attendance_date-6 and p_attendance_date),0),
    coalesce(round(avg(ratio)*100,1),0)
  into v_daily,v_weekly,v_monthly
  from a;

  select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date),'[]'::jsonb) into v_trend
  from (
    select h.attendance_date,
      count(*) filter(where h.status not in('leave','holiday','weekend','unmarked'))::int recorded,
      coalesce(round(avg(case when h.status in('present','late') then 1.0 when h.status='absent' then 0.0 else null end)*100,1),0) attendance_percent
    from public.hr_effective_attendance_v1 h
    join public.hr_employments e on e.tenant_id=h.tenant_id and e.id=h.employment_id
    where h.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and h.attendance_date between p_attendance_date-29 and p_attendance_date
    group by h.attendance_date
  ) x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.employment_id),'[]'::jsonb) into v_scans
  from (
    select e.employment_id,min(e.occurred_at) first_scan,max(e.occurred_at) last_scan,
      string_agg(distinct d.label,', ' order by d.label) device_label,
      'biometric'::text modality
    from public.attendance_device_events e
    join public.attendance_devices d on d.tenant_id=e.tenant_id and d.id=e.device_id
    where e.tenant_id=p_tenant_id
      and e.branch_id=p_branch_id
      and e.employment_id is not null
      and e.modality='biometric'
      and d.modality='biometric'
      and (e.occurred_at at time zone v_timezone)::date=p_attendance_date
      and e.state in('received','matched','applied')
    group by e.employment_id
  ) x;

  return jsonb_build_object(
    'daily_percent',v_daily,'weekly_percent',v_weekly,'monthly_percent',v_monthly,
    'trend',v_trend,'scans',v_scans
  );
end;
$function$;

revoke all on function public.get_attendance_v2_insights_v1(uuid,bigint,bigint,date)
  from public,anon,authenticated;
grant execute on function public.get_attendance_v2_insights_v1(uuid,bigint,bigint,date)
  to service_role;
revoke all on function public.get_hr_attendance_v2_insights_v1(uuid,bigint,bigint,date)
  from public,anon,authenticated;
grant execute on function public.get_hr_attendance_v2_insights_v1(uuid,bigint,bigint,date)
  to service_role;

commit;
