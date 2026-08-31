create unique index if not exists attendance_devices_external_device_key_unique
on public.attendance_devices(lower(external_device_key));

create or replace function public.rotate_attendance_device_token_v1(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_device_id bigint
) returns jsonb language plpgsql set search_path to '' as $fn$
declare v_membership bigint;v_token text;v_hint text;v_device_id bigint;begin
 select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in('attendance.student.mark','hr.employee.manage')) order by m.created_at limit 1;
 if v_membership is null then raise exception 'attendance device management permission denied';end if;
 v_token:='mdev_'||encode(gen_random_bytes(24),'hex');v_hint:=right(v_token,8);
 update public.attendance_devices set token_hash=encode(digest(v_token,'sha256'),'hex'),token_hint=v_hint,updated_at=now() where tenant_id=p_tenant_id and branch_id=p_branch_id and id=p_device_id returning id into v_device_id;
 if v_device_id is null then raise exception 'attendance device not found';end if;
 insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state) values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'attendance.device.token.rotate','succeeded','attendance_device',v_device_id::text,gen_random_uuid(),jsonb_build_object('token_hint',v_hint));
 return jsonb_build_object('device_id',v_device_id,'ingest_token',v_token,'token_hint',v_hint);
end;$fn$;

create or replace function public.receive_attendance_device_event_v1(
 p_external_device_key text,p_ingest_token text,p_external_event_id text,p_external_subject_key text,p_modality text,p_event_type text,p_occurred_at timestamptz,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path to '' as $fn$
declare v_device public.attendance_devices%rowtype;v_mapping public.attendance_device_subject_mappings%rowtype;v_event public.attendance_device_events%rowtype;v_modality text:=lower(btrim(coalesce(p_modality,'')));v_type text:=lower(btrim(coalesce(p_event_type,'')));v_event_key text:=btrim(coalesce(p_external_event_id,''));v_subject_key text:=btrim(coalesce(p_external_subject_key,''));v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);begin
 select * into v_device from public.attendance_devices d where lower(d.external_device_key)=lower(btrim(coalesce(p_external_device_key,''))) and d.state='active' limit 1;
 if v_device.id is null or p_ingest_token is null or v_device.token_hash<>encode(digest(p_ingest_token,'sha256'),'hex') then raise exception 'device authentication failed';end if;
 if length(v_event_key) not between 4 and 160 then raise exception 'valid external event id required';end if;if length(v_subject_key) not between 1 and 120 then raise exception 'external subject key required';end if;if v_modality not in('biometric','nfc') then raise exception 'invalid event modality';end if;if v_type not in('presence','check_in','check_out') then raise exception 'invalid device event type';end if;
 if v_device.modality<>'hybrid' and v_device.modality<>v_modality then raise exception 'event modality does not match device';end if;if p_occurred_at is null or p_occurred_at>now()+interval '10 minutes' or p_occurred_at<now()-interval '90 days' then raise exception 'device event timestamp is outside the accepted window';end if;if jsonb_typeof(v_metadata)<>'object' then raise exception 'device event metadata must be an object';end if;if octet_length(v_metadata::text)>8192 then raise exception 'device event metadata is too large';end if;
 if v_metadata ?| array['template','biometric_template','fingerprint','fingerprint_image','face_image','image','raw_image','raw_template'] then raise exception 'raw biometric material must not be sent to ERP';end if;
 select * into v_mapping from public.attendance_device_subject_mappings m where m.tenant_id=v_device.tenant_id and m.branch_id=v_device.branch_id and m.device_id=v_device.id and m.external_subject_key=v_subject_key and m.state='active' limit 1;
 insert into public.attendance_device_events(tenant_id,branch_id,device_id,external_event_id,external_subject_key,modality,event_type,occurred_at,state,mapping_id,subject_type,student_person_id,employment_id,payload_digest,metadata)
 values(v_device.tenant_id,v_device.branch_id,v_device.id,v_event_key,v_subject_key,v_modality,v_type,p_occurred_at,case when v_mapping.id is null then 'received' else 'matched' end,v_mapping.id,v_mapping.subject_type,v_mapping.student_person_id,v_mapping.employment_id,encode(digest(v_metadata::text,'sha256'),'hex'),v_metadata)
 on conflict(tenant_id,device_id,external_event_id) do update set external_event_id=excluded.external_event_id returning * into v_event;
 update public.attendance_devices set last_seen_at=greatest(coalesce(last_seen_at,p_occurred_at),p_occurred_at),updated_at=now() where tenant_id=v_device.tenant_id and id=v_device.id;
 return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'matched',v_event.mapping_id is not null,'received_at',v_event.received_at);
end;$fn$;

revoke all on function public.rotate_attendance_device_token_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.rotate_attendance_device_token_v1(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb) to service_role;