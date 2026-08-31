create or replace function public.apply_attendance_device_event_v1(
 p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_event_id bigint
) returns jsonb language plpgsql set search_path to '' as $fn$
declare v_membership bigint;v_event public.attendance_device_events%rowtype;v_local_date date;v_timezone text;v_session jsonb;v_result jsonb;v_current record;v_record_id bigint;v_request_key text;begin
 select m.id into v_membership from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) order by m.created_at limit 1;
 if v_membership is null then raise exception 'active membership required';end if;
 select * into v_event from public.attendance_device_events e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.id=p_event_id for update;
 if v_event.id is null then raise exception 'device event not found';end if;if v_event.state='applied' then return jsonb_build_object('event_id',v_event.id,'state','applied','unchanged',true,'attendance_record_id',v_event.attendance_record_id,'hr_attendance_record_id',v_event.hr_attendance_record_id);end if;if v_event.mapping_id is null or v_event.state not in('matched','received') then raise exception 'device event requires an active subject mapping';end if;
 select coalesce(nullif(btrim(ip.timezone),''),'UTC') into v_timezone from public.institution_profiles ip where ip.tenant_id=p_tenant_id limit 1;v_timezone:=coalesce(v_timezone,'UTC');v_local_date:=(v_event.occurred_at at time zone v_timezone)::date;v_request_key:='attendance-device-event:'||v_event.id::text;
 begin
  if v_event.subject_type='student' then
   v_session:=public.ensure_student_daily_attendance(p_identity_id,p_tenant_id,p_branch_id,v_local_date);
   v_result:=public.mark_student_attendance(p_identity_id,p_tenant_id,p_branch_id,(v_session->>'session_id')::bigint,v_event.student_person_id,'present',v_event.modality,v_request_key,'Device attendance event');
   v_record_id:=(v_result->>'record_id')::bigint;
   update public.attendance_device_events set state='applied',attendance_record_id=v_record_id,applied_at=now(),applied_by_membership_id=v_membership,error_reason=null where tenant_id=p_tenant_id and id=v_event.id;
  elsif v_event.subject_type='staff' then
   select * into v_current from public.hr_effective_attendance_v1 a where a.tenant_id=p_tenant_id and a.employment_id=v_event.employment_id and a.attendance_date=v_local_date limit 1;
   if v_event.event_type='check_out' and v_current.id is not null then
    v_result:=public.record_hr_attendance_v1(p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,coalesce(v_current.status,'present'),v_current.check_in_at,v_event.occurred_at,'device',v_request_key,'Device check-out reconciliation');
   else
    v_result:=public.record_hr_attendance_v1(p_identity_id,p_tenant_id,p_branch_id,v_event.employment_id,v_local_date,'present',case when v_event.event_type in('check_in','presence') then v_event.occurred_at else null end,null,'device',v_request_key,null);
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

revoke all on function public.apply_attendance_device_event_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.apply_attendance_device_event_v1(uuid,bigint,bigint,bigint) to service_role;