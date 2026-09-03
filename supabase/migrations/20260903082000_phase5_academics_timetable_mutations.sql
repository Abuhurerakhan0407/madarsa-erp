begin;

create or replace function public.mutate_academics_timetable_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_membership_id bigint;
  v_action text:=lower(btrim(coalesce(p_action,'')));
  v_permission text;
  v_timezone text;
  v_id bigint;
  v_entry public.timetable_entries%rowtype;
  v_session public.academic_sessions%rowtype;
  v_slot public.timetable_slots%rowtype;
  v_group public.academic_groups%rowtype;
  v_existing public.homework_assignments%rowtype;
  v_labels jsonb;
  v_key text;
  v_title text;
  v_instructions text;
  v_room text;
  v_note text;
  v_event_type text;
  v_audience text;
  v_priority text;
  v_state text;
  v_exception_action text;
  v_start_time time;
  v_end_time time;
  v_weekday smallint;
  v_effective_from date;
  v_effective_to date;
  v_session_date date;
  v_replacement_date date;
  v_due_at timestamptz;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_group_id bigint;
  v_student_id bigint;
  v_subject_id bigint;
  v_teacher_id bigint;
  v_slot_id bigint;
  v_replacement_slot_id bigint;
  v_replacement_teacher_id bigint;
  v_attachment text;
  v_publish boolean;
  v_parent_visible boolean;
  v_student_visible boolean;
  v_allow_submission boolean;
  v_affects_attendance boolean;
  v_sequence integer;
  v_conflict text;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Academic mutation payload must be an object'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id
    ))
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Academic mutation membership denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch is required'; end if;

  v_permission:=case
    when v_action in ('create_slot','create_timetable_entry','create_exception','archive_timetable_entry') then 'academics.timetable.manage'
    when v_action in ('create_homework','set_homework_state') then 'academics.homework.manage'
    when v_action in ('create_calendar_event','set_calendar_status') then 'academics.structure.manage'
    else null
  end;
  if v_permission is null then raise exception 'Academic mutation action is invalid'; end if;
  if not exists(
    select 1 from public.membership_roles mr
    join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
    join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
    where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code=v_permission
  ) then raise exception 'Academic mutation permission denied'; end if;

  select coalesce(ip.timezone,'Asia/Kolkata') into v_timezone from public.institution_profiles ip where ip.tenant_id=p_tenant_id limit 1;
  v_timezone:=coalesce(v_timezone,'Asia/Kolkata');

  if v_action='create_slot' then
    v_key:=lower(btrim(coalesce(p_payload->>'key','')));
    v_labels:=p_payload->'labels';
    begin
      v_start_time:=(p_payload->>'startsAt')::time;
      v_end_time:=(p_payload->>'endsAt')::time;
      v_sequence:=coalesce((p_payload->>'sequence')::integer,0);
    exception when others then raise exception 'Timetable slot values are invalid'; end;
    if v_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then raise exception 'Timetable slot key is invalid'; end if;
    if v_labels is null or jsonb_typeof(v_labels)<>'object' or length(btrim(coalesce(v_labels->>'en',v_labels->>'ur',v_labels->>'ar','')))<2 then raise exception 'Timetable slot label is required'; end if;
    if v_end_time<=v_start_time then raise exception 'Timetable slot end time must be after start time'; end if;
    if v_sequence<0 or v_sequence>200 then raise exception 'Timetable slot sequence is invalid'; end if;
    if exists(select 1 from public.timetable_slots s where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.key=v_key and s.status<>'archived') then raise exception 'Timetable slot key already exists'; end if;

    insert into public.timetable_slots(tenant_id,branch_id,key,labels,starts_at,ends_at,sequence,status)
    values(p_tenant_id,p_branch_id,v_key,v_labels,v_start_time,v_end_time,v_sequence,'active') returning id into v_id;

  elsif v_action='create_timetable_entry' then
    begin
      v_group_id:=(p_payload->>'groupId')::bigint;
      v_slot_id:=(p_payload->>'slotId')::bigint;
      v_subject_id:=(p_payload->>'subjectId')::bigint;
      v_teacher_id:=nullif(p_payload->>'teacherPersonId','')::bigint;
      v_weekday:=(p_payload->>'weekday')::smallint;
      v_effective_from:=(p_payload->>'effectiveFrom')::date;
      v_effective_to:=nullif(p_payload->>'effectiveTo','')::date;
    exception when others then raise exception 'Timetable entry values are invalid'; end;
    v_room:=nullif(btrim(coalesce(p_payload->>'roomKey','')),'');
    if v_weekday not between 1 and 7 then raise exception 'Timetable weekday is invalid'; end if;

    select * into v_group from public.academic_groups g where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.id=v_group_id and g.status='active';
    if v_group.id is null then raise exception 'Active academic group is required'; end if;
    select * into v_session from public.academic_sessions s where s.tenant_id=p_tenant_id and s.id=v_group.session_id and s.status='active';
    if v_session.id is null then raise exception 'Active academic session is required'; end if;
    if v_effective_from<v_session.starts_on or v_effective_from>v_session.ends_on or (v_effective_to is not null and (v_effective_to<v_effective_from or v_effective_to>v_session.ends_on)) then raise exception 'Timetable effective dates must stay inside the academic session'; end if;
    select * into v_slot from public.timetable_slots s where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.id=v_slot_id and s.status='active';
    if v_slot.id is null then raise exception 'Active timetable slot is required'; end if;
    if not exists(select 1 from public.subjects s where s.tenant_id=p_tenant_id and s.id=v_subject_id and s.status='active') then raise exception 'Active subject or component is required'; end if;
    if v_teacher_id is not null and not exists(select 1 from public.employee_profiles ep where ep.tenant_id=p_tenant_id and ep.person_id=v_teacher_id and ep.status='active') then raise exception 'Active teacher is required'; end if;

    select case
      when e.group_id=v_group_id then 'group'
      when v_teacher_id is not null and e.teacher_person_id=v_teacher_id then 'teacher'
      when v_room is not null and lower(e.room_key)=lower(v_room) then 'room'
      else null end into v_conflict
    from public.timetable_entries e
    join public.timetable_slots s on s.tenant_id=e.tenant_id and s.id=e.slot_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active' and e.weekday=v_weekday
      and e.effective_from<=coalesce(v_effective_to,'9999-12-31'::date)
      and coalesce(e.effective_to,'9999-12-31'::date)>=v_effective_from
      and s.starts_at<v_slot.ends_at and s.ends_at>v_slot.starts_at
      and (e.group_id=v_group_id or (v_teacher_id is not null and e.teacher_person_id=v_teacher_id) or (v_room is not null and lower(e.room_key)=lower(v_room)))
    order by case when e.group_id=v_group_id then 1 when v_teacher_id is not null and e.teacher_person_id=v_teacher_id then 2 else 3 end
    limit 1;
    if v_conflict is not null then raise exception 'Timetable % conflict detected',v_conflict; end if;

    insert into public.timetable_entries(tenant_id,branch_id,session_id,group_id,slot_id,subject_id,teacher_person_id,room_key,weekday,effective_from,effective_to,status)
    values(p_tenant_id,p_branch_id,v_group.session_id,v_group_id,v_slot_id,v_subject_id,v_teacher_id,v_room,v_weekday,v_effective_from,v_effective_to,'active') returning id into v_id;

  elsif v_action='create_exception' then
    begin
      v_id:=(p_payload->>'entryId')::bigint;
      v_session_date:=(p_payload->>'sessionDate')::date;
      v_replacement_date:=nullif(p_payload->>'replacementDate','')::date;
      v_replacement_slot_id:=nullif(p_payload->>'replacementSlotId','')::bigint;
      v_replacement_teacher_id:=nullif(p_payload->>'replacementTeacherPersonId','')::bigint;
    exception when others then raise exception 'Schedule exception values are invalid'; end;
    v_exception_action:=lower(btrim(coalesce(p_payload->>'exceptionAction','')));
    v_room:=nullif(btrim(coalesce(p_payload->>'replacementRoomKey','')),'');
    v_note:=nullif(btrim(coalesce(p_payload->>'note','')),'');
    if v_exception_action not in ('cancel','substitute','reschedule') then raise exception 'Schedule exception action is invalid'; end if;
    if v_note is not null and length(v_note)>1000 then raise exception 'Schedule exception note is too long'; end if;

    select * into v_entry from public.timetable_entries e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.id=v_id and e.status='active';
    if v_entry.id is null then raise exception 'Active timetable entry is required'; end if;
    select * into v_session from public.academic_sessions s where s.tenant_id=p_tenant_id and s.id=v_entry.session_id and s.status='active';
    select * into v_slot from public.timetable_slots s where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.id=v_entry.slot_id and s.status='active';
    if v_session_date<v_entry.effective_from or (v_entry.effective_to is not null and v_session_date>v_entry.effective_to) or extract(isodow from v_session_date)::smallint<>v_entry.weekday then raise exception 'Schedule exception date is not an occurrence of this timetable entry'; end if;

    if v_exception_action='cancel' then
      v_replacement_date:=null;v_replacement_slot_id:=null;v_replacement_teacher_id:=null;v_room:=null;
    elsif v_exception_action='substitute' then
      v_replacement_date:=null;v_replacement_slot_id:=null;v_room:=null;
      if v_replacement_teacher_id is null or not exists(select 1 from public.employee_profiles ep where ep.tenant_id=p_tenant_id and ep.person_id=v_replacement_teacher_id and ep.status='active') then raise exception 'Active substitute teacher is required'; end if;
      if exists(
        select 1 from public.timetable_entries e
        join public.timetable_slots s on s.tenant_id=e.tenant_id and s.id=e.slot_id
        where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active' and e.id<>v_entry.id
          and e.teacher_person_id=v_replacement_teacher_id and e.weekday=extract(isodow from v_session_date)::smallint
          and e.effective_from<=v_session_date and (e.effective_to is null or e.effective_to>=v_session_date)
          and s.starts_at<v_slot.ends_at and s.ends_at>v_slot.starts_at
          and not exists(select 1 from public.academic_schedule_exceptions x where x.tenant_id=e.tenant_id and x.timetable_entry_id=e.id and x.session_date=v_session_date and x.status='active' and x.action in ('cancel','reschedule'))
      ) or exists(
        select 1 from public.academic_schedule_exceptions x
        join public.timetable_entries e on e.tenant_id=x.tenant_id and e.id=x.timetable_entry_id
        join public.timetable_slots s on s.tenant_id=x.tenant_id and s.id=x.replacement_slot_id
        where x.tenant_id=p_tenant_id and x.branch_id=p_branch_id and x.status='active' and x.action='reschedule' and x.replacement_date=v_session_date
          and coalesce(x.replacement_teacher_person_id,e.teacher_person_id)=v_replacement_teacher_id
          and s.starts_at<v_slot.ends_at and s.ends_at>v_slot.starts_at
      ) then raise exception 'Timetable teacher conflict detected for substitute'; end if;
    else
      if v_replacement_date is null or v_replacement_slot_id is null then raise exception 'Reschedule date and slot are required'; end if;
      if v_replacement_date<v_session.starts_on or v_replacement_date>v_session.ends_on then raise exception 'Reschedule date must stay inside the academic session'; end if;
      select * into v_slot from public.timetable_slots s where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.id=v_replacement_slot_id and s.status='active';
      if v_slot.id is null then raise exception 'Active replacement timetable slot is required'; end if;
      if v_replacement_teacher_id is not null and not exists(select 1 from public.employee_profiles ep where ep.tenant_id=p_tenant_id and ep.person_id=v_replacement_teacher_id and ep.status='active') then raise exception 'Active replacement teacher is required'; end if;

      select case
        when e.group_id=v_entry.group_id then 'group'
        when coalesce(v_replacement_teacher_id,v_entry.teacher_person_id) is not null and e.teacher_person_id=coalesce(v_replacement_teacher_id,v_entry.teacher_person_id) then 'teacher'
        when coalesce(v_room,v_entry.room_key) is not null and lower(e.room_key)=lower(coalesce(v_room,v_entry.room_key)) then 'room'
        else null end into v_conflict
      from public.timetable_entries e
      join public.timetable_slots s on s.tenant_id=e.tenant_id and s.id=e.slot_id
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active' and e.id<>v_entry.id
        and e.weekday=extract(isodow from v_replacement_date)::smallint
        and e.effective_from<=v_replacement_date and (e.effective_to is null or e.effective_to>=v_replacement_date)
        and s.starts_at<v_slot.ends_at and s.ends_at>v_slot.starts_at
        and (e.group_id=v_entry.group_id
          or (coalesce(v_replacement_teacher_id,v_entry.teacher_person_id) is not null and e.teacher_person_id=coalesce(v_replacement_teacher_id,v_entry.teacher_person_id))
          or (coalesce(v_room,v_entry.room_key) is not null and lower(e.room_key)=lower(coalesce(v_room,v_entry.room_key))))
        and not exists(select 1 from public.academic_schedule_exceptions x where x.tenant_id=e.tenant_id and x.timetable_entry_id=e.id and x.session_date=v_replacement_date and x.status='active' and x.action in ('cancel','reschedule'))
      limit 1;
      if v_conflict is not null then raise exception 'Timetable % conflict detected for reschedule',v_conflict; end if;
    end if;

    insert into public.academic_schedule_exceptions(
      tenant_id,branch_id,timetable_entry_id,session_date,action,replacement_date,replacement_slot_id,replacement_teacher_person_id,replacement_room_key,note,status,created_by_membership_id
    ) values(
      p_tenant_id,p_branch_id,v_entry.id,v_session_date,v_exception_action,v_replacement_date,v_replacement_slot_id,v_replacement_teacher_id,v_room,v_note,'active',v_membership_id
    )
    on conflict (tenant_id,timetable_entry_id,session_date) do update set
      action=excluded.action,replacement_date=excluded.replacement_date,replacement_slot_id=excluded.replacement_slot_id,
      replacement_teacher_person_id=excluded.replacement_teacher_person_id,replacement_room_key=excluded.replacement_room_key,
      note=excluded.note,status='active',created_by_membership_id=excluded.created_by_membership_id,updated_at=clock_timestamp()
    returning id into v_id;

  elsif v_action='archive_timetable_entry' then
    begin v_id:=(p_payload->>'entryId')::bigint; exception when others then raise exception 'Timetable entry id is invalid'; end;
    update public.timetable_entries set status='archived',updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id and status='active';
    if not found then raise exception 'Active timetable entry is required'; end if;

  elsif v_action='create_homework' then
    begin
      v_group_id:=nullif(p_payload->>'groupId','')::bigint;
      v_student_id:=nullif(p_payload->>'studentPersonId','')::bigint;
      v_subject_id:=(p_payload->>'subjectId')::bigint;
      v_teacher_id:=(p_payload->>'teacherPersonId')::bigint;
      v_id:=(p_payload->>'sessionId')::bigint;
      v_due_at:=((p_payload->>'dueAt')::timestamp at time zone v_timezone);
      v_publish:=coalesce((p_payload->>'publish')::boolean,false);
      v_parent_visible:=coalesce((p_payload->>'parentVisible')::boolean,true);
      v_student_visible:=coalesce((p_payload->>'studentVisible')::boolean,true);
      v_allow_submission:=coalesce((p_payload->>'allowSubmission')::boolean,false);
    exception when others then raise exception 'Homework values are invalid'; end;
    if num_nonnulls(v_group_id,v_student_id)<>1 then raise exception 'Choose exactly one homework target: group or student'; end if;
    v_title:=btrim(coalesce(p_payload->>'title',''));
    v_instructions:=btrim(coalesce(p_payload->>'instructions',''));
    v_priority:=lower(btrim(coalesce(p_payload->>'priority','normal')));
    v_attachment:=nullif(btrim(coalesce(p_payload->>'attachmentStoragePath','')),'');
    if length(v_title) not between 2 and 200 then raise exception 'Homework title must be between 2 and 200 characters'; end if;
    if length(v_instructions)<2 or length(v_instructions)>5000 then raise exception 'Homework instructions must be between 2 and 5000 characters'; end if;
    if v_priority not in ('low','normal','high','urgent') then raise exception 'Homework priority is invalid'; end if;
    select * into v_session from public.academic_sessions s where s.tenant_id=p_tenant_id and s.id=v_id and s.status='active';
    if v_session.id is null then raise exception 'Active academic session is required'; end if;
    if v_due_at<=now() then raise exception 'Homework due time must be in the future'; end if;
    if v_group_id is not null and not exists(select 1 from public.academic_groups g where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.id=v_group_id and g.session_id=v_session.id and g.status='active') then raise exception 'Homework group must belong to the selected academic session'; end if;
    if v_student_id is not null and not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.session_id=v_session.id and e.student_person_id=v_student_id and e.status='active') then raise exception 'Homework student must be actively enrolled in the selected academic session'; end if;
    if not exists(select 1 from public.subjects s where s.tenant_id=p_tenant_id and s.id=v_subject_id and s.status='active') then raise exception 'Active homework subject or component is required'; end if;
    if not exists(select 1 from public.employee_profiles ep where ep.tenant_id=p_tenant_id and ep.person_id=v_teacher_id and ep.status='active') then raise exception 'Active homework teacher is required'; end if;
    if v_attachment is not null and v_attachment !~ ('^'||p_tenant_id::text||'/academics/homework/[a-f0-9]{24,64}\.[a-z0-9]{2,8}$') then raise exception 'Homework attachment path is invalid'; end if;

    insert into public.homework_assignments(
      tenant_id,branch_id,academic_session_id,group_id,student_person_id,subject_id,teacher_person_id,title,instructions,
      assigned_at,due_at,allow_submission,state,priority,parent_visible,student_visible,attachment_storage_path,created_by_membership_id
    ) values(
      p_tenant_id,p_branch_id,v_session.id,v_group_id,v_student_id,v_subject_id,v_teacher_id,v_title,v_instructions,
      case when v_publish then now() else null end,v_due_at,v_allow_submission,case when v_publish then 'published' else 'draft' end,
      v_priority,v_parent_visible,v_student_visible,v_attachment,v_membership_id
    ) returning id into v_id;

  elsif v_action='set_homework_state' then
    begin v_id:=(p_payload->>'homeworkId')::bigint; exception when others then raise exception 'Homework id is invalid'; end;
    v_state:=lower(btrim(coalesce(p_payload->>'state','')));
    if v_state not in ('published','closed','cancelled') then raise exception 'Homework state is invalid'; end if;
    select * into v_existing from public.homework_assignments h where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id and h.id=v_id;
    if v_existing.id is null then raise exception 'Homework assignment was not found'; end if;
    if v_state='published' and v_existing.due_at<=now() then raise exception 'Cannot publish homework after its due time'; end if;
    update public.homework_assignments set state=v_state,assigned_at=case when v_state='published' then coalesce(assigned_at,now()) else assigned_at end,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id;

  elsif v_action='create_calendar_event' then
    begin
      v_id:=(p_payload->>'sessionId')::bigint;
      v_starts_at:=((p_payload->>'startsAt')::timestamp at time zone v_timezone);
      v_ends_at:=((p_payload->>'endsAt')::timestamp at time zone v_timezone);
      v_affects_attendance:=coalesce((p_payload->>'affectsAttendance')::boolean,false);
    exception when others then raise exception 'Calendar event values are invalid'; end;
    v_event_type:=lower(btrim(coalesce(p_payload->>'eventType','')));
    v_labels:=p_payload->'labels';
    v_audience:=lower(btrim(coalesce(p_payload->>'audience','all')));
    v_priority:=lower(btrim(coalesce(p_payload->>'priority','normal')));
    v_note:=nullif(btrim(coalesce(p_payload->>'description','')),'');
    v_room:=nullif(btrim(coalesce(p_payload->>'location','')),'');
    v_attachment:=nullif(btrim(coalesce(p_payload->>'attachmentStoragePath','')),'');
    if v_event_type not in ('working_day','holiday','event','exam_window','closure') then raise exception 'Calendar event type is invalid'; end if;
    if v_labels is null or jsonb_typeof(v_labels)<>'object' or length(btrim(coalesce(v_labels->>'en',v_labels->>'ur',v_labels->>'ar','')))<2 then raise exception 'Calendar event title is required'; end if;
    if v_ends_at<=v_starts_at then raise exception 'Calendar event end must be after start'; end if;
    if v_audience not in ('all','parents','students','teachers','staff') then raise exception 'Calendar event audience is invalid'; end if;
    if v_priority not in ('low','normal','high','urgent') then raise exception 'Calendar event priority is invalid'; end if;
    if v_note is not null and length(v_note)>4000 then raise exception 'Calendar event description is too long'; end if;
    if v_room is not null and length(v_room)>240 then raise exception 'Calendar event location is too long'; end if;
    if v_attachment is not null and v_attachment !~ ('^'||p_tenant_id::text||'/academics/calendar/[a-f0-9]{24,64}\.[a-z0-9]{2,8}$') then raise exception 'Calendar attachment path is invalid'; end if;
    select * into v_session from public.academic_sessions s where s.tenant_id=p_tenant_id and s.id=v_id and s.status='active';
    if v_session.id is null then raise exception 'Active academic session is required'; end if;

    insert into public.academic_calendar_events(
      tenant_id,branch_id,session_id,event_type,labels,starts_at,ends_at,affects_attendance,metadata,
      description,location,audience,priority,attachment_storage_path,status,created_by_membership_id
    ) values(
      p_tenant_id,p_branch_id,v_session.id,v_event_type,v_labels,v_starts_at,v_ends_at,v_affects_attendance,'{}'::jsonb,
      v_note,v_room,v_audience,v_priority,v_attachment,'active',v_membership_id
    ) returning id into v_id;

  elsif v_action='set_calendar_status' then
    begin v_id:=(p_payload->>'eventId')::bigint; exception when others then raise exception 'Calendar event id is invalid'; end;
    v_state:=lower(btrim(coalesce(p_payload->>'status','')));
    if v_state not in ('active','cancelled') then raise exception 'Calendar event status is invalid'; end if;
    update public.academic_calendar_events set status=v_state,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and (branch_id is null or branch_id=p_branch_id) and id=v_id;
    if not found then raise exception 'Calendar event was not found'; end if;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'academics.'||v_action,'succeeded',
    case when v_action like '%homework%' then 'homework_assignment' when v_action like '%calendar%' then 'academic_calendar_event' when v_action='create_exception' then 'academic_schedule_exception' when v_action='create_slot' then 'timetable_slot' else 'timetable_entry' end,
    v_id::text,gen_random_uuid(),jsonb_build_object('action',v_action,'id',v_id)
  );

  return jsonb_build_object('ok',true,'action',v_action,'id',v_id);
end;
$$;

revoke all on function public.mutate_academics_timetable_v1(uuid,bigint,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_academics_timetable_v1(uuid,bigint,bigint,text,jsonb) to service_role;

commit;
