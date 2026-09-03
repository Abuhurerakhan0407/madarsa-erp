create or replace function private.client_v2_result_publication_notification_trigger_v1() returns trigger
language plpgsql security definer set search_path to '' as $fn$
declare v_students bigint[];v_ids uuid[];begin
  if new.audience<>'portal' or new.revoked_at is not null then return new;end if;
  select coalesce(array_agg(distinct s.student_person_id),'{}'::bigint[]) into v_students
  from public.result_snapshots s
  where s.tenant_id=new.tenant_id and s.result_run_id=new.result_run_id
    and s.state in('approved','published');
  v_ids:=private.client_v2_guardian_identities_for_students_v1(new.tenant_id,v_students);
  perform private.emit_client_v2_in_app_v1(new.tenant_id,'assessment.results.published','result_publication',new.id::text,
    jsonb_build_object('priority','important','source_module','Exams & Results','title',jsonb_build_object('en','Results published'),'body',jsonb_build_object('en','A new result is available in the parent portal.'),'link','/portal','exam_series_id',new.exam_series_id,'result_run_id',new.result_run_id),v_ids);
  return new;
end;$fn$;

create or replace function private.client_v2_attendance_notification_trigger_v1() returns trigger
language plpgsql security definer set search_path to '' as $fn$
declare v_enabled boolean;v_ids uuid[];v_branch_id bigint;v_attendance_date date;begin
  if new.status_category not in('absent','late') then return new;end if;
  select s.absence_late_enabled into v_enabled from public.client_v2_notification_settings s where s.tenant_id=new.tenant_id;
  if not coalesce(v_enabled,false) then return new;end if;
  select a.branch_id,a.attendance_date into v_branch_id,v_attendance_date
  from public.attendance_sessions a
  where a.tenant_id=new.tenant_id and a.id=new.attendance_session_id;
  if v_branch_id is null or v_attendance_date is null then return new;end if;
  v_ids:=private.client_v2_guardian_identities_for_students_v1(new.tenant_id,array[new.person_id]);
  perform private.emit_client_v2_in_app_v1(new.tenant_id,'attendance.'||new.status_category,'attendance_record',new.id::text,
    jsonb_build_object('priority',case when new.status_category='absent' then 'important' else 'normal' end,'source_module','Attendance','title',jsonb_build_object('en',case when new.status_category='absent' then 'Absence recorded' else 'Late arrival recorded' end),'body',jsonb_build_object('en','Attendance has been updated for your child.'),'link','/portal','attendance_date',v_attendance_date,'status',new.status_category,'branch_id',v_branch_id),v_ids);
  return new;
end;$fn$;
