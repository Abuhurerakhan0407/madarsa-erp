-- Client V2 Phase 7 — biometric-first attendance with governed emergency manual windows.

create table if not exists public.attendance_manual_authorizations (
  id bigint generated always as identity primary key,
  tenant_id bigint not null,
  branch_id bigint not null,
  attendance_date date not null,
  subject_type text not null check (subject_type in ('student','staff')),
  scope_type text not null check (scope_type in ('branch','group','student','teacher')),
  group_id bigint,
  student_person_id bigint,
  employment_id bigint,
  reason text not null check (length(btrim(reason)) between 4 and 500),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  state text not null default 'active' check (state in ('active','revoked')),
  request_key text not null check (length(request_key) between 16 and 128),
  authorized_by_membership_id bigint not null,
  revoked_by_membership_id bigint,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_manual_authorizations_window_check check (expires_at > starts_at and expires_at <= starts_at + interval '24 hours'),
  constraint attendance_manual_authorizations_scope_check check (
    (scope_type='branch' and group_id is null and student_person_id is null and employment_id is null)
    or (scope_type='group' and subject_type='student' and group_id is not null and student_person_id is null and employment_id is null)
    or (scope_type='student' and subject_type='student' and group_id is null and student_person_id is not null and employment_id is null)
    or (scope_type='teacher' and subject_type='staff' and group_id is null and student_person_id is null and employment_id is not null)
  ),
  constraint attendance_manual_authorizations_tenant_request_unique unique (tenant_id,request_key),
  constraint attendance_manual_authorizations_tenant_branch_fk foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
  constraint attendance_manual_authorizations_tenant_group_fk foreign key (tenant_id,group_id) references public.academic_groups(tenant_id,id) on delete restrict,
  constraint attendance_manual_authorizations_tenant_student_fk foreign key (tenant_id,student_person_id) references public.persons(tenant_id,id) on delete restrict,
  constraint attendance_manual_authorizations_tenant_employment_fk foreign key (tenant_id,employment_id) references public.hr_employments(tenant_id,id) on delete restrict,
  constraint attendance_manual_authorizations_tenant_authorized_by_fk foreign key (tenant_id,authorized_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  constraint attendance_manual_authorizations_tenant_revoked_by_fk foreign key (tenant_id,revoked_by_membership_id) references public.memberships(tenant_id,id) on delete restrict
);

create index if not exists attendance_manual_authorizations_active_idx
  on public.attendance_manual_authorizations(tenant_id,branch_id,subject_type,attendance_date,starts_at,expires_at)
  where state='active';

alter table public.attendance_manual_authorizations enable row level security;
alter table public.attendance_manual_authorizations force row level security;
revoke all on public.attendance_manual_authorizations from public,anon,authenticated;
grant select,insert,update,delete on public.attendance_manual_authorizations to service_role;
grant usage,select on sequence public.attendance_manual_authorizations_id_seq to service_role;

create or replace function public.get_emergency_manual_attendance_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_attendance_date date,p_subject_type text
) returns jsonb
language plpgsql stable
set search_path to 'pg_catalog','extensions'
as $function$
declare
  v_membership bigint;v_can_manage boolean:=false;v_rows jsonb;v_subject text:=lower(btrim(coalesce(p_subject_type,'')));
begin
  if v_subject not in ('student','staff') then raise exception 'attendance subject type is invalid';end if;
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code=case when v_subject='student' then 'attendance.student.read' else 'hr.employee.read' end)
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'attendance read permission denied';end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code=case when v_subject='student' then 'attendance.student.approve' else 'hr.employee.manage' end) into v_can_manage;
  select coalesce(jsonb_agg(row_to_json(x) order by x.starts_at desc,x.id desc),'[]'::jsonb) into v_rows from(
    select a.id,a.attendance_date,a.subject_type,a.scope_type,a.group_id,a.student_person_id,a.employment_id,a.reason,a.starts_at,a.expires_at,a.state,a.authorized_by_membership_id,a.revoked_at,a.created_at,
      (a.state='active' and a.starts_at<=now() and a.expires_at>now()) active,
      coalesce(g.labels->>'en',g.key,p.display_name,pe.display_name,'Entire branch') scope_label
    from public.attendance_manual_authorizations a
    left join public.academic_groups g on g.tenant_id=a.tenant_id and g.id=a.group_id
    left join public.persons p on p.tenant_id=a.tenant_id and p.id=a.student_person_id
    left join public.hr_employments he on he.tenant_id=a.tenant_id and he.id=a.employment_id
    left join public.persons pe on pe.tenant_id=he.tenant_id and pe.id=he.employee_person_id
    where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.subject_type=v_subject
      and a.attendance_date=p_attendance_date
    order by a.starts_at desc,a.id desc limit 50
  )x;
  return jsonb_build_object('can_manage',v_can_manage,'authorizations',v_rows,'server_now',now());
end;$function$;

create or replace function public.enable_emergency_manual_attendance_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_attendance_date date,p_subject_type text,
  p_scope_type text,p_scope_id bigint,p_reason text,p_starts_at timestamptz,p_expires_at timestamptz,p_request_key text
) returns jsonb
language plpgsql
set search_path to 'pg_catalog','extensions'
as $function$
declare
  v_membership bigint;v_subject text:=lower(btrim(coalesce(p_subject_type,'')));v_scope text:=lower(btrim(coalesce(p_scope_type,'')));
  v_reason text:=btrim(coalesce(p_reason,''));v_timezone text:='UTC';v_id bigint;v_group bigint;v_student bigint;v_employment bigint;
begin
  if v_subject not in ('student','staff') then raise exception 'attendance subject type is invalid';end if;
  if v_scope not in ('branch','group','student','teacher') then raise exception 'attendance emergency scope is invalid';end if;
  if p_attendance_date is null or p_starts_at is null or p_expires_at is null then raise exception 'attendance date and emergency time window are required';end if;
  if p_expires_at<=p_starts_at or p_expires_at>p_starts_at+interval '24 hours' then raise exception 'emergency attendance window must be between 1 minute and 24 hours';end if;
  if length(v_reason) not between 4 and 500 then raise exception 'emergency attendance reason is required';end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'valid emergency request key required';end if;
  select coalesce(nullif(ip.timezone,''),'UTC') into v_timezone from public.institution_profiles ip where ip.tenant_id=p_tenant_id limit 1;
  if (p_starts_at at time zone v_timezone)::date<>p_attendance_date then raise exception 'emergency start time must match attendance date';end if;
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code=case when v_subject='student' then 'attendance.student.approve' else 'hr.employee.manage' end)
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'emergency attendance authorization permission denied';end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required';end if;
  if v_scope='branch' then
    if p_scope_id is not null then raise exception 'branch scope does not accept a subject id';end if;
  elsif v_scope='group' then
    if v_subject<>'student' or p_scope_id is null or not exists(select 1 from public.academic_groups g where g.tenant_id=p_tenant_id and g.id=p_scope_id and g.branch_id=p_branch_id and g.status='active') then raise exception 'active student group required';end if;v_group:=p_scope_id;
  elsif v_scope='student' then
    if v_subject<>'student' or p_scope_id is null or not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_scope_id and e.status='active') then raise exception 'active student required';end if;v_student:=p_scope_id;
  elsif v_scope='teacher' then
    if v_subject<>'staff' or p_scope_id is null or not exists(select 1 from public.hr_employments e where e.tenant_id=p_tenant_id and e.id=p_scope_id and e.branch_id=p_branch_id and e.state in('active','on_leave','suspended')) then raise exception 'active teacher employment required';end if;v_employment:=p_scope_id;
  end if;
  insert into public.attendance_manual_authorizations(tenant_id,branch_id,attendance_date,subject_type,scope_type,group_id,student_person_id,employment_id,reason,starts_at,expires_at,request_key,authorized_by_membership_id)
  values(p_tenant_id,p_branch_id,p_attendance_date,v_subject,v_scope,v_group,v_student,v_employment,v_reason,p_starts_at,p_expires_at,p_request_key,v_membership)
  on conflict(tenant_id,request_key) do nothing returning id into v_id;
  if v_id is null then select a.id into v_id from public.attendance_manual_authorizations a where a.tenant_id=p_tenant_id and a.request_key=p_request_key;end if;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'attendance.emergency.enable','succeeded','attendance_manual_authorization',v_id::text,gen_random_uuid(),jsonb_build_object('date',p_attendance_date,'subject_type',v_subject,'scope_type',v_scope,'scope_id',p_scope_id,'reason',v_reason,'starts_at',p_starts_at,'expires_at',p_expires_at));
  return jsonb_build_object('authorization_id',v_id,'state','active','starts_at',p_starts_at,'expires_at',p_expires_at);
end;$function$;

create or replace function public.revoke_emergency_manual_attendance_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_authorization_id bigint,p_reason text
) returns jsonb
language plpgsql
set search_path to 'pg_catalog','extensions'
as $function$
declare v_membership bigint;v_subject text;v_reason text:=btrim(coalesce(p_reason,''));begin
  select a.subject_type into v_subject from public.attendance_manual_authorizations a where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.id=p_authorization_id for update;
  if v_subject is null then raise exception 'emergency attendance authorization not found';end if;
  if length(v_reason) not between 4 and 500 then raise exception 'revocation reason is required';end if;
  select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code=case when v_subject='student' then 'attendance.student.approve' else 'hr.employee.manage' end) order by m.created_at limit 1;
  if v_membership is null then raise exception 'emergency attendance revocation permission denied';end if;
  update public.attendance_manual_authorizations set state='revoked',revoked_by_membership_id=v_membership,revoked_at=now(),updated_at=now() where tenant_id=p_tenant_id and id=p_authorization_id and state='active';
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'attendance.emergency.revoke','succeeded','attendance_manual_authorization',p_authorization_id::text,gen_random_uuid(),jsonb_build_object('reason',v_reason));
  return jsonb_build_object('authorization_id',p_authorization_id,'state','revoked');
end;$function$;

create or replace function public.mark_student_attendance_emergency_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_attendance_session_id bigint,p_person_id bigint,p_status_key text,p_note text default null
) returns jsonb
language plpgsql
set search_path to 'pg_catalog','extensions'
as $function$
declare v_date date;v_group bigint;v_auth bigint;v_result jsonb;begin
  select s.attendance_date into v_date from public.attendance_sessions s where s.tenant_id=p_tenant_id and s.id=p_attendance_session_id and s.branch_id=p_branch_id and s.context_type='student_daily';
  if v_date is null then raise exception 'student attendance session is not available';end if;
  select e.group_id into v_group from public.attendance_rosters r join public.attendance_roster_members rm on rm.tenant_id=r.tenant_id and rm.roster_id=r.id and rm.person_id=p_person_id and rm.subject_type='student' left join public.enrollments e on e.tenant_id=rm.tenant_id and e.id=rm.enrollment_id where r.tenant_id=p_tenant_id and r.attendance_session_id=p_attendance_session_id order by r.id desc limit 1;
  select a.id into v_auth from public.attendance_manual_authorizations a where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.attendance_date=v_date and a.subject_type='student' and a.state='active' and a.starts_at<=now() and a.expires_at>now() and (a.scope_type='branch' or (a.scope_type='group' and a.group_id=v_group) or (a.scope_type='student' and a.student_person_id=p_person_id)) order by case a.scope_type when 'student' then 1 when 'group' then 2 else 3 end,a.expires_at limit 1;
  if v_auth is null then raise exception 'emergency manual attendance is not authorized for this student and time';end if;
  v_result:=public.mark_student_attendance(p_identity_id,p_tenant_id,p_branch_id,p_attendance_session_id,p_person_id,p_status_key,'manual','emergency:'||v_auth::text,p_note);
  return v_result||jsonb_build_object('authorization_id',v_auth,'source_label','emergency_manual');
end;$function$;

create or replace function public.record_hr_attendance_emergency_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_employment_id bigint,p_attendance_date date,p_status text,
  p_check_in_at timestamptz default null,p_check_out_at timestamptz default null,p_request_key text default null,p_reason text default null
) returns jsonb
language plpgsql
set search_path to 'pg_catalog','extensions'
as $function$
declare v_auth bigint;v_result jsonb;v_record bigint;begin
  select a.id into v_auth from public.attendance_manual_authorizations a where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.attendance_date=p_attendance_date and a.subject_type='staff' and a.state='active' and a.starts_at<=now() and a.expires_at>now() and (a.scope_type='branch' or (a.scope_type='teacher' and a.employment_id=p_employment_id)) order by case a.scope_type when 'teacher' then 1 else 2 end,a.expires_at limit 1;
  if v_auth is null then raise exception 'emergency manual attendance is not authorized for this teacher and time';end if;
  v_result:=public.record_hr_attendance_v1(p_identity_id,p_tenant_id,p_branch_id,p_employment_id,p_attendance_date,p_status,p_check_in_at,p_check_out_at,'manual',p_request_key,p_reason);
  v_record:=nullif(v_result->>'attendance_record_id','')::bigint;
  if v_record is not null then update public.hr_attendance_records set source_reference='emergency:'||v_auth::text where tenant_id=p_tenant_id and id=v_record and source='manual';end if;
  return v_result||jsonb_build_object('authorization_id',v_auth,'source_label','emergency_manual');
end;$function$;

create or replace function public.get_attendance_v2_insights_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_attendance_date date
) returns jsonb
language plpgsql stable
set search_path to 'pg_catalog','extensions'
as $function$
declare v_membership bigint;v_timezone text:='UTC';v_daily numeric:=0;v_weekly numeric:=0;v_monthly numeric:=0;v_trend jsonb;v_scans jsonb;begin
  select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='attendance.student.read') order by m.created_at limit 1;
  if v_membership is null then raise exception 'student attendance read permission denied';end if;
  select coalesce(nullif(timezone,''),'UTC') into v_timezone from public.institution_profiles where tenant_id=p_tenant_id limit 1;
  select coalesce(round(avg(ar.presence_ratio)*100,1),0) into v_daily from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.attendance_date=p_attendance_date and ar.status_category<>'unmarked';
  select coalesce(round(avg(ar.presence_ratio)*100,1),0) into v_weekly from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.attendance_date between p_attendance_date-6 and p_attendance_date and ar.status_category<>'unmarked';
  select coalesce(round(avg(ar.presence_ratio)*100,1),0) into v_monthly from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.attendance_date between p_attendance_date-29 and p_attendance_date and ar.status_category<>'unmarked';
  select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date),'[]'::jsonb) into v_trend from(select s.attendance_date,count(*)::int recorded,round(avg(ar.presence_ratio)*100,1) attendance_percent from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id where ar.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.attendance_date between p_attendance_date-29 and p_attendance_date and ar.status_category<>'unmarked' group by s.attendance_date)x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.person_id),'[]'::jsonb) into v_scans from(select e.student_person_id person_id,min(e.occurred_at) first_scan,max(e.occurred_at) last_scan,string_agg(distinct d.label,', ' order by d.label) device_label,string_agg(distinct e.modality,', ' order by e.modality) modality from public.attendance_device_events e join public.attendance_devices d on d.tenant_id=e.tenant_id and d.id=e.device_id where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id is not null and (e.occurred_at at time zone v_timezone)::date=p_attendance_date and e.state in('received','mapped','applied') group by e.student_person_id)x;
  return jsonb_build_object('daily_percent',v_daily,'weekly_percent',v_weekly,'monthly_percent',v_monthly,'trend',v_trend,'scans',v_scans);
end;$function$;

create or replace function public.get_hr_attendance_v2_insights_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_attendance_date date
) returns jsonb
language plpgsql stable
set search_path to 'pg_catalog','extensions'
as $function$
declare v_membership bigint;v_timezone text:='UTC';v_daily numeric:=0;v_weekly numeric:=0;v_monthly numeric:=0;v_trend jsonb;v_scans jsonb;begin
  select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='hr.employee.read') order by m.created_at limit 1;
  if v_membership is null then raise exception 'staff attendance read permission denied';end if;
  select coalesce(nullif(timezone,''),'UTC') into v_timezone from public.institution_profiles where tenant_id=p_tenant_id limit 1;
  with a as(select h.attendance_date,case when h.status in('present','late') then 1.0 when h.status='absent' then 0.0 else null end ratio from public.hr_effective_attendance_v1 h join public.hr_employments e on e.tenant_id=h.tenant_id and e.id=h.employment_id where h.tenant_id=p_tenant_id and e.branch_id=p_branch_id and h.attendance_date between p_attendance_date-29 and p_attendance_date)
  select coalesce(round(avg(ratio)*100,1) filter(where attendance_date=p_attendance_date),0),coalesce(round(avg(ratio)*100,1) filter(where attendance_date between p_attendance_date-6 and p_attendance_date),0),coalesce(round(avg(ratio)*100,1),0) into v_daily,v_weekly,v_monthly from a;
  select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date),'[]'::jsonb) into v_trend from(select h.attendance_date,count(*) filter(where h.status not in('leave','holiday','weekend','unmarked'))::int recorded,coalesce(round(avg(case when h.status in('present','late') then 1.0 when h.status='absent' then 0.0 else null end)*100,1),0) attendance_percent from public.hr_effective_attendance_v1 h join public.hr_employments e on e.tenant_id=h.tenant_id and e.id=h.employment_id where h.tenant_id=p_tenant_id and e.branch_id=p_branch_id and h.attendance_date between p_attendance_date-29 and p_attendance_date group by h.attendance_date)x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.employment_id),'[]'::jsonb) into v_scans from(select e.employment_id,min(e.occurred_at) first_scan,max(e.occurred_at) last_scan,string_agg(distinct d.label,', ' order by d.label) device_label,string_agg(distinct e.modality,', ' order by e.modality) modality from public.attendance_device_events e join public.attendance_devices d on d.tenant_id=e.tenant_id and d.id=e.device_id where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.employment_id is not null and (e.occurred_at at time zone v_timezone)::date=p_attendance_date and e.state in('received','mapped','applied') group by e.employment_id)x;
  return jsonb_build_object('daily_percent',v_daily,'weekly_percent',v_weekly,'monthly_percent',v_monthly,'trend',v_trend,'scans',v_scans);
end;$function$;

revoke all on function public.get_emergency_manual_attendance_v1(uuid,bigint,bigint,date,text) from public,anon,authenticated;
grant execute on function public.get_emergency_manual_attendance_v1(uuid,bigint,bigint,date,text) to service_role;
revoke all on function public.enable_emergency_manual_attendance_v1(uuid,bigint,bigint,date,text,text,bigint,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.enable_emergency_manual_attendance_v1(uuid,bigint,bigint,date,text,text,bigint,text,timestamptz,timestamptz,text) to service_role;
revoke all on function public.revoke_emergency_manual_attendance_v1(uuid,bigint,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.revoke_emergency_manual_attendance_v1(uuid,bigint,bigint,bigint,text) to service_role;
revoke all on function public.mark_student_attendance_emergency_v1(uuid,bigint,bigint,bigint,bigint,text,text) from public,anon,authenticated;
grant execute on function public.mark_student_attendance_emergency_v1(uuid,bigint,bigint,bigint,bigint,text,text) to service_role;
revoke all on function public.record_hr_attendance_emergency_v1(uuid,bigint,bigint,bigint,date,text,timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.record_hr_attendance_emergency_v1(uuid,bigint,bigint,bigint,date,text,timestamptz,timestamptz,text,text) to service_role;
revoke all on function public.get_attendance_v2_insights_v1(uuid,bigint,bigint,date) from public,anon,authenticated;
grant execute on function public.get_attendance_v2_insights_v1(uuid,bigint,bigint,date) to service_role;
revoke all on function public.get_hr_attendance_v2_insights_v1(uuid,bigint,bigint,date) from public,anon,authenticated;
grant execute on function public.get_hr_attendance_v2_insights_v1(uuid,bigint,bigint,date) to service_role;
