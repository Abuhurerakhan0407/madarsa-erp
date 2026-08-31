create table if not exists public.attendance_devices (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  external_device_key text not null,
  label text not null,
  modality text not null,
  vendor text,
  model text,
  token_hash text not null,
  token_hint text not null,
  state text not null default 'active',
  last_seen_at timestamptz,
  created_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id),
  unique (tenant_id,external_device_key),
  foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
  foreign key (tenant_id,created_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  check (length(btrim(external_device_key)) between 3 and 120),
  check (length(btrim(label)) between 2 and 120),
  check (modality in ('biometric','nfc','hybrid')),
  check (state in ('active','inactive')),
  check (length(token_hash)=64),
  check (length(token_hint) between 4 and 16)
);

create table if not exists public.attendance_device_subject_mappings (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  device_id bigint not null,
  external_subject_key text not null,
  subject_type text not null,
  student_person_id bigint,
  employment_id bigint,
  state text not null default 'active',
  created_by_membership_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id),
  unique (tenant_id,device_id,external_subject_key),
  foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
  foreign key (tenant_id,device_id) references public.attendance_devices(tenant_id,id) on delete cascade,
  foreign key (tenant_id,student_person_id) references public.persons(tenant_id,id) on delete restrict,
  foreign key (tenant_id,employment_id) references public.hr_employments(tenant_id,id) on delete restrict,
  foreign key (tenant_id,created_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  check (length(btrim(external_subject_key)) between 1 and 120),
  check (subject_type in ('student','staff')),
  check (state in ('active','inactive')),
  check (
    (subject_type='student' and student_person_id is not null and employment_id is null)
    or (subject_type='staff' and student_person_id is null and employment_id is not null)
  )
);

create table if not exists public.attendance_device_events (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete restrict,
  branch_id bigint not null,
  device_id bigint not null,
  external_event_id text not null,
  external_subject_key text not null,
  modality text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  state text not null default 'received',
  mapping_id bigint,
  subject_type text,
  student_person_id bigint,
  employment_id bigint,
  attendance_record_id bigint,
  hr_attendance_record_id bigint,
  payload_digest text not null,
  metadata jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  applied_by_membership_id bigint,
  error_reason text,
  unique (tenant_id,id),
  unique (tenant_id,device_id,external_event_id),
  foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
  foreign key (tenant_id,device_id) references public.attendance_devices(tenant_id,id) on delete restrict,
  foreign key (tenant_id,mapping_id) references public.attendance_device_subject_mappings(tenant_id,id) on delete restrict,
  foreign key (tenant_id,student_person_id) references public.persons(tenant_id,id) on delete restrict,
  foreign key (tenant_id,employment_id) references public.hr_employments(tenant_id,id) on delete restrict,
  foreign key (tenant_id,attendance_record_id) references public.attendance_records(tenant_id,id) on delete restrict,
  foreign key (tenant_id,hr_attendance_record_id) references public.hr_attendance_records(tenant_id,id) on delete restrict,
  foreign key (tenant_id,applied_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  check (length(btrim(external_event_id)) between 4 and 160),
  check (length(btrim(external_subject_key)) between 1 and 120),
  check (modality in ('biometric','nfc')),
  check (event_type in ('presence','check_in','check_out')),
  check (state in ('received','matched','applied','rejected','ignored')),
  check (length(payload_digest)=64),
  check (error_reason is null or length(error_reason)<=500)
);

create index if not exists attendance_device_events_inbox_idx on public.attendance_device_events(tenant_id,branch_id,state,occurred_at desc);
create index if not exists attendance_device_mappings_subject_idx on public.attendance_device_subject_mappings(tenant_id,branch_id,subject_type,state);

alter table public.attendance_devices enable row level security;
alter table public.attendance_device_subject_mappings enable row level security;
alter table public.attendance_device_events enable row level security;
revoke all on public.attendance_devices,public.attendance_device_subject_mappings,public.attendance_device_events from public,anon,authenticated;
grant all on public.attendance_devices,public.attendance_device_subject_mappings,public.attendance_device_events to service_role;
grant usage,select on sequence public.attendance_devices_id_seq to service_role;
grant usage,select on sequence public.attendance_device_subject_mappings_id_seq to service_role;
grant usage,select on sequence public.attendance_device_events_id_seq to service_role;

create or replace function public.get_attendance_device_center_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint
) returns jsonb
language plpgsql stable set search_path to ''
as $fn$
declare v_membership bigint;v_devices jsonb;v_mappings jsonb;v_events jsonb;v_students jsonb;v_staff jsonb;begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in ('attendance.student.read','attendance.staff.read'))
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'attendance device read permission denied';end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required';end if;

  select coalesce(jsonb_agg(row_to_json(x) order by x.label),'[]'::jsonb) into v_devices from(
    select d.id,d.external_device_key,d.label,d.modality,d.vendor,d.model,d.token_hint,d.state,d.last_seen_at,d.created_at
    from public.attendance_devices d where d.tenant_id=p_tenant_id and d.branch_id=p_branch_id
  )x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.device_label,x.external_subject_key),'[]'::jsonb) into v_mappings from(
    select m.id,m.device_id,d.label device_label,m.external_subject_key,m.subject_type,m.student_person_id,m.employment_id,m.state,
      coalesce(sp.student_number,he.employee_number) subject_number,coalesce(ps.display_name,pe.display_name) subject_name
    from public.attendance_device_subject_mappings m
    join public.attendance_devices d on d.tenant_id=m.tenant_id and d.id=m.device_id
    left join public.student_profiles sp on sp.tenant_id=m.tenant_id and sp.person_id=m.student_person_id
    left join public.persons ps on ps.tenant_id=m.tenant_id and ps.id=m.student_person_id
    left join public.hr_employments he on he.tenant_id=m.tenant_id and he.id=m.employment_id
    left join public.persons pe on pe.tenant_id=he.tenant_id and pe.id=he.employee_person_id
    where m.tenant_id=p_tenant_id and m.branch_id=p_branch_id
  )x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.occurred_at desc,x.id desc),'[]'::jsonb) into v_events from(
    select e.id,e.device_id,d.label device_label,e.external_event_id,e.external_subject_key,e.modality,e.event_type,e.occurred_at,e.received_at,e.state,e.subject_type,e.student_person_id,e.employment_id,e.attendance_record_id,e.hr_attendance_record_id,e.error_reason,
      coalesce(sp.student_number,he.employee_number) subject_number,coalesce(ps.display_name,pe.display_name) subject_name
    from public.attendance_device_events e join public.attendance_devices d on d.tenant_id=e.tenant_id and d.id=e.device_id
    left join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
    left join public.persons ps on ps.tenant_id=e.tenant_id and ps.id=e.student_person_id
    left join public.hr_employments he on he.tenant_id=e.tenant_id and he.id=e.employment_id
    left join public.persons pe on pe.tenant_id=he.tenant_id and pe.id=he.employee_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id order by e.occurred_at desc,e.id desc limit 50
  )x;
  with active_students as(
    select distinct on(e.student_person_id) e.student_person_id,sp.student_number,p.display_name
    from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted') join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active' order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  ) select coalesce(jsonb_agg(row_to_json(x) order by x.display_name),'[]'::jsonb) into v_students from active_students x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.display_name),'[]'::jsonb) into v_staff from(
    select he.id employment_id,he.employee_number,p.display_name from public.hr_employments he join public.persons p on p.tenant_id=he.tenant_id and p.id=he.employee_person_id
    where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.state in('active','on_leave','suspended')
  )x;
  return jsonb_build_object('devices',v_devices,'mappings',v_mappings,'events',v_events,'students',v_students,'staff',v_staff,'local_date',public.institution_local_date(p_tenant_id));
end;$fn$;

create or replace function public.create_attendance_device_v1(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_external_device_key text,p_label text,p_modality text,p_vendor text default null,p_model text default null
) returns jsonb language plpgsql set search_path to '' as $fn$
declare v_membership bigint;v_device_id bigint;v_token text;v_key text:=lower(btrim(coalesce(p_external_device_key,'')));v_label text:=btrim(coalesce(p_label,''));v_modality text:=lower(btrim(coalesce(p_modality,'')));begin
 select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in('attendance.student.mark','hr.employee.manage')) order by m.created_at limit 1;
 if v_membership is null then raise exception 'attendance device management permission denied';end if;
 if length(v_key) not between 3 and 120 then raise exception 'valid external device key required';end if;if length(v_label) not between 2 and 120 then raise exception 'valid device label required';end if;if v_modality not in('biometric','nfc','hybrid') then raise exception 'invalid device modality';end if;
 v_token:='mdev_'||encode(gen_random_bytes(24),'hex');
 insert into public.attendance_devices(tenant_id,branch_id,external_device_key,label,modality,vendor,model,token_hash,token_hint,created_by_membership_id)
 values(p_tenant_id,p_branch_id,v_key,v_label,v_modality,nullif(btrim(coalesce(p_vendor,'')),''),nullif(btrim(coalesce(p_model,'')),''),encode(digest(v_token,'sha256'),'hex'),right(v_token,8),v_membership) returning id into v_device_id;
 insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state) values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'attendance.device.create','succeeded','attendance_device',v_device_id::text,gen_random_uuid(),jsonb_build_object('external_device_key',v_key,'label',v_label,'modality',v_modality));
 return jsonb_build_object('device_id',v_device_id,'external_device_key',v_key,'label',v_label,'modality',v_modality,'ingest_token',v_token,'token_hint',right(v_token,8));
end;$fn$;

create or replace function public.rotate_attendance_device_token_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_device_id bigint)
returns jsonb language plpgsql set search_path to '' as $fn$
declare v_membership bigint;v_token text;v_hint text;begin
 select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in('attendance.student.mark','hr.employee.manage')) order by m.created_at limit 1;
 if v_membership is null then raise exception 'attendance device management permission denied';end if;
 v_token:='mdev_'||encode(gen_random_bytes(24),'hex');v_hint:=right(v_token,8);
 update public.attendance_devices set token_hash=encode(digest(v_token,'sha256'),'hex'),token_hint=v_hint,updated_at=now() where tenant_id=p_tenant_id and branch_id=p_branch_id and id=p_device_id returning id into p_device_id;
 if p_device_id is null then raise exception 'attendance device not found';end if;
 return jsonb_build_object('device_id',p_device_id,'ingest_token',v_token,'token_hint',v_hint);
end;$fn$;

create or replace function public.map_attendance_device_subject_v1(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_device_id bigint,p_external_subject_key text,p_subject_type text,p_student_person_id bigint default null,p_employment_id bigint default null
) returns jsonb language plpgsql set search_path to '' as $fn$
declare v_membership bigint;v_mapping_id bigint;v_key text:=btrim(coalesce(p_external_subject_key,''));v_type text:=lower(btrim(coalesce(p_subject_type,'')));begin
 select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in('attendance.student.mark','hr.employee.manage')) order by m.created_at limit 1;
 if v_membership is null then raise exception 'attendance device mapping permission denied';end if;if not exists(select 1 from public.attendance_devices d where d.tenant_id=p_tenant_id and d.branch_id=p_branch_id and d.id=p_device_id and d.state='active') then raise exception 'active attendance device not found';end if;if length(v_key) not between 1 and 120 then raise exception 'external subject key required';end if;if v_type not in('student','staff') then raise exception 'invalid mapping subject type';end if;
 if v_type='student' then
  if p_student_person_id is null or p_employment_id is not null then raise exception 'student mapping requires a student only';end if;
  if not exists(select 1 from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted') where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active') then raise exception 'active branch student not found';end if;
 else
  if p_employment_id is null or p_student_person_id is not null then raise exception 'staff mapping requires an employment only';end if;
  if not exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.id=p_employment_id and e.state in('active','on_leave','suspended')) then raise exception 'active branch employment not found';end if;
 end if;
 insert into public.attendance_device_subject_mappings(tenant_id,branch_id,device_id,external_subject_key,subject_type,student_person_id,employment_id,state,created_by_membership_id)
 values(p_tenant_id,p_branch_id,p_device_id,v_key,v_type,case when v_type='student' then p_student_person_id else null end,case when v_type='staff' then p_employment_id else null end,'active',v_membership)
 on conflict(tenant_id,device_id,external_subject_key) do update set branch_id=excluded.branch_id,subject_type=excluded.subject_type,student_person_id=excluded.student_person_id,employment_id=excluded.employment_id,state='active',created_by_membership_id=excluded.created_by_membership_id,updated_at=now()
 returning id into v_mapping_id;
 update public.attendance_device_events e set mapping_id=v_mapping_id,subject_type=v_type,student_person_id=case when v_type='student' then p_student_person_id else null end,employment_id=case when v_type='staff' then p_employment_id else null end,state=case when e.state='received' then 'matched' else e.state end,error_reason=null where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.device_id=p_device_id and e.external_subject_key=v_key and e.state in('received','matched');
 return jsonb_build_object('mapping_id',v_mapping_id,'device_id',p_device_id,'external_subject_key',v_key,'subject_type',v_type);
end;$fn$;

create or replace function public.receive_attendance_device_event_v1(
 p_external_device_key text,p_ingest_token text,p_external_event_id text,p_external_subject_key text,p_modality text,p_event_type text,p_occurred_at timestamptz,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path to '' as $fn$
declare v_device public.attendance_devices%rowtype;v_mapping public.attendance_device_subject_mappings%rowtype;v_event public.attendance_device_events%rowtype;v_modality text:=lower(btrim(coalesce(p_modality,'')));v_type text:=lower(btrim(coalesce(p_event_type,'')));v_event_key text:=btrim(coalesce(p_external_event_id,''));v_subject_key text:=btrim(coalesce(p_external_subject_key,''));begin
 select * into v_device from public.attendance_devices d where d.external_device_key=lower(btrim(coalesce(p_external_device_key,''))) and d.state='active' order by d.id limit 1;
 if v_device.id is null or p_ingest_token is null or v_device.token_hash<>encode(digest(p_ingest_token,'sha256'),'hex') then raise exception 'device authentication failed';end if;
 if length(v_event_key) not between 4 and 160 then raise exception 'valid external event id required';end if;if length(v_subject_key) not between 1 and 120 then raise exception 'external subject key required';end if;if v_modality not in('biometric','nfc') then raise exception 'invalid event modality';end if;if v_type not in('presence','check_in','check_out') then raise exception 'invalid device event type';end if;
 if v_device.modality<>'hybrid' and v_device.modality<>v_modality then raise exception 'event modality does not match device';end if;if p_occurred_at is null or p_occurred_at>now()+interval '10 minutes' or p_occurred_at<now()-interval '90 days' then raise exception 'device event timestamp is outside the accepted window';end if;if octet_length(coalesce(p_metadata,'{}'::jsonb)::text)>8192 then raise exception 'device event metadata is too large';end if;
 select * into v_mapping from public.attendance_device_subject_mappings m where m.tenant_id=v_device.tenant_id and m.branch_id=v_device.branch_id and m.device_id=v_device.id and m.external_subject_key=v_subject_key and m.state='active' limit 1;
 insert into public.attendance_device_events(tenant_id,branch_id,device_id,external_event_id,external_subject_key,modality,event_type,occurred_at,state,mapping_id,subject_type,student_person_id,employment_id,payload_digest,metadata)
 values(v_device.tenant_id,v_device.branch_id,v_device.id,v_event_key,v_subject_key,v_modality,v_type,p_occurred_at,case when v_mapping.id is null then 'received' else 'matched' end,v_mapping.id,v_mapping.subject_type,v_mapping.student_person_id,v_mapping.employment_id,encode(digest(coalesce(p_metadata,'{}'::jsonb)::text,'sha256'),'hex'),coalesce(p_metadata,'{}'::jsonb))
 on conflict(tenant_id,device_id,external_event_id) do update set received_at=public.attendance_device_events.received_at returning * into v_event;
 update public.attendance_devices set last_seen_at=greatest(coalesce(last_seen_at,p_occurred_at),p_occurred_at),updated_at=now() where tenant_id=v_device.tenant_id and id=v_device.id;
 return jsonb_build_object('event_id',v_event.id,'state',v_event.state,'matched',v_event.mapping_id is not null,'received_at',v_event.received_at);
end;$fn$;

create or replace function public.apply_attendance_device_event_v1(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_event_id bigint
) returns jsonb language plpgsql set search_path to '' as $fn$
declare v_membership bigint;v_event public.attendance_device_events%rowtype;v_local_date date;v_timezone text;v_session jsonb;v_result jsonb;v_current record;v_record_id bigint;begin
 select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) order by m.created_at limit 1;
 if v_membership is null then raise exception 'active membership required';end if;
 select * into v_event from public.attendance_device_events e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.id=p_event_id for update;
 if v_event.id is null then raise exception 'device event not found';end if;if v_event.state='applied' then return jsonb_build_object('event_id',v_event.id,'state','applied','unchanged',true,'attendance_record_id',v_event.attendance_record_id,'hr_attendance_record_id',v_event.hr_attendance_record_id);end if;if v_event.mapping_id is null or v_event.state not in('matched','received') then raise exception 'device event requires an active subject mapping';end if;
 select coalesce(nullif(btrim(ip.timezone),''),'UTC') into v_timezone from public.institution_profiles ip where ip.tenant_id=p_tenant_id limit 1;v_timezone:=coalesce(v_timezone,'UTC');v_local_date:=(v_event.occurred_at at time zone v_timezone)::date;
 begin
  if v_event.subject_type='student' then
   v_session:=public.ensure_student_daily_attendance(p_identity_id,p_tenant_id,p_branch_id,v_local_date);
   v_result:=public.mark_student_attendance(p_identity_id,p_tenant_id,p_branch_id,(v_session->>'session_id')::bigint,v_event.student_person_id,'present',v_event.modality,'device-event:'||v_event.id::text,'Device attendance event');
   v_record_id:=(v_result->>'record_id')::bigint;
   update public.attendance_device_events set state='applied',attendance_record_id=v_record_id,applied_at=now(),applied_by_membership_id=v_membership,error_reason=null where tenant_id=p_tenant_id and id=v_event.id;
  elsif v_event.subject_type='staff' then
   select * into v_current from public.hr_effective_attendance_v1 a where a.tenant_id=p_tenant_id and a.employment_id=v_event.employment_id and a.attendance_date=v_local_date limit 1;
   if v_event.event_type='check_out' and v_current.id is not null then
    v_result:=public.record_hr_attendance_v1(p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,coalesce(v_current.status,'present'),v_current.check_in_at,v_event.occurred_at,'device','device-event:'||v_event.id::text,'Device check-out reconciliation');
   else
    v_result:=public.record_hr_attendance_v1(p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,'present',case when v_event.event_type in('check_in','presence') then v_event.occurred_at else null end,null,'device','device-event:'||v_event.id::text,null);
   end if;
   v_record_id:=(v_result->>'attendance_record_id')::bigint;
   update public.attendance_device_events set state='applied',hr_attendance_record_id=v_record_id,applied_at=now(),applied_by_membership_id=v_membership,error_reason=null where tenant_id=p_tenant_id and id=v_event.id;
  else raise exception 'device event subject type is invalid';end if;
 exception when others then
  update public.attendance_device_events set state='rejected',error_reason=left(sqlerrm,500),applied_by_membership_id=v_membership where tenant_id=p_tenant_id and id=v_event.id;
  return jsonb_build_object('event_id',v_event.id,'state','rejected','error',left(sqlerrm,500));
 end;
 return jsonb_build_object('event_id',v_event.id,'state','applied','subject_type',v_event.subject_type,'attendance_record_id',case when v_event.subject_type='student' then v_record_id else null end,'hr_attendance_record_id',case when v_event.subject_type='staff' then v_record_id else null end);
end;$fn$;

revoke all on function public.get_attendance_device_center_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.create_attendance_device_v1(uuid,bigint,bigint,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.rotate_attendance_device_token_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.map_attendance_device_subject_v1(uuid,bigint,bigint,bigint,text,text,bigint,bigint) from public,anon,authenticated;
revoke all on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.apply_attendance_device_event_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_attendance_device_center_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.create_attendance_device_v1(uuid,bigint,bigint,text,text,text,text,text) to service_role;
grant execute on function public.rotate_attendance_device_token_v1(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.map_attendance_device_subject_v1(uuid,bigint,bigint,bigint,text,text,bigint,bigint) to service_role;
grant execute on function public.receive_attendance_device_event_v1(text,text,text,text,text,text,timestamptz,jsonb) to service_role;
grant execute on function public.apply_attendance_device_event_v1(uuid,bigint,bigint,bigint) to service_role;