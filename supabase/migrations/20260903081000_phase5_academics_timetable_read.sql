begin;

create or replace function public.get_academics_timetable_workspace_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_selected_date date default null
)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_membership_id bigint;
  v_local_date date:=public.institution_local_date(p_tenant_id);
  v_date date:=coalesce(p_selected_date,public.institution_local_date(p_tenant_id));
  v_timezone text;
  v_structure_read boolean:=false;
  v_timetable_manage boolean:=false;
  v_homework_read boolean:=false;
  v_homework_manage boolean:=false;
  v_calendar_manage boolean:=false;
  v_closed boolean:=false;
  v_closure jsonb:=null;
  v_sessions jsonb:='[]'::jsonb;
  v_programs jsonb:='[]'::jsonb;
  v_groups jsonb:='[]'::jsonb;
  v_subjects jsonb:='[]'::jsonb;
  v_teachers jsonb:='[]'::jsonb;
  v_slots jsonb:='[]'::jsonb;
  v_entries jsonb:='[]'::jsonb;
  v_exceptions jsonb:='[]'::jsonb;
  v_homework jsonb:='[]'::jsonb;
  v_calendar jsonb:='[]'::jsonb;
  v_today jsonb:='[]'::jsonb;
  v_summary jsonb:='{}'::jsonb;
begin
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
  if v_membership_id is null then raise exception 'Academic workspace membership denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then
    raise exception 'active branch is required';
  end if;
  if v_date < v_local_date-730 or v_date > v_local_date+730 then
    raise exception 'selected academic date is outside the supported range';
  end if;

  select coalesce(ip.timezone,'Asia/Kolkata') into v_timezone
  from public.institution_profiles ip where ip.tenant_id=p_tenant_id limit 1;
  v_timezone:=coalesce(v_timezone,'Asia/Kolkata');

  select
    bool_or(rp.permission_code='academics.structure.read'),
    bool_or(rp.permission_code='academics.timetable.manage'),
    bool_or(rp.permission_code='academics.homework.read'),
    bool_or(rp.permission_code='academics.homework.manage'),
    bool_or(rp.permission_code='academics.structure.manage')
  into v_structure_read,v_timetable_manage,v_homework_read,v_homework_manage,v_calendar_manage
  from public.membership_roles mr
  join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
  join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
  where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id;

  v_structure_read:=coalesce(v_structure_read,false);
  v_timetable_manage:=coalesce(v_timetable_manage,false);
  v_homework_read:=coalesce(v_homework_read,false);
  v_homework_manage:=coalesce(v_homework_manage,false);
  v_calendar_manage:=coalesce(v_calendar_manage,false);
  if not (v_structure_read or v_homework_read) then raise exception 'Academic workspace read permission denied'; end if;

  if v_structure_read then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'key',s.key,'labels',s.labels,'starts_on',s.starts_on,'ends_on',s.ends_on,'is_default',s.is_default
    ) order by s.is_default desc,s.starts_on desc,s.id desc),'[]'::jsonb)
    into v_sessions
    from public.academic_sessions s
    where s.tenant_id=p_tenant_id and s.status='active';

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'key',p.key,'labels',p.labels,'program_type',p.program_type
    ) order by coalesce(p.labels->>'en',p.key),p.id),'[]'::jsonb)
    into v_programs
    from public.programs p
    where p.tenant_id=p_tenant_id and p.status='active' and (p.branch_id is null or p.branch_id=p_branch_id);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',g.id,'key',g.key,'labels',g.labels,'session_id',g.session_id,'program_id',g.program_id,
      'primary_teacher_person_id',g.primary_teacher_person_id
    ) order by coalesce(g.labels->>'en',g.key),g.id),'[]'::jsonb)
    into v_groups
    from public.academic_groups g
    where g.tenant_id=p_tenant_id and g.branch_id=p_branch_id and g.status='active';

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'key',s.key,'labels',s.labels,'subject_type',s.subject_type
    ) order by coalesce(s.labels->>'en',s.key),s.id),'[]'::jsonb)
    into v_subjects
    from public.subjects s
    where s.tenant_id=p_tenant_id and s.status='active';

    select coalesce(jsonb_agg(jsonb_build_object(
      'person_id',ep.person_id,'employee_number',ep.employee_number,'designation',ep.designation,
      'name',p.display_name,'name_native',p.name_native
    ) order by p.display_name,ep.person_id),'[]'::jsonb)
    into v_teachers
    from public.employee_profiles ep
    join public.persons p on p.tenant_id=ep.tenant_id and p.id=ep.person_id and p.status='active'
    where ep.tenant_id=p_tenant_id and ep.status='active';

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',ts.id,'key',ts.key,'labels',ts.labels,'starts_at',to_char(ts.starts_at,'HH24:MI'),
      'ends_at',to_char(ts.ends_at,'HH24:MI'),'sequence',ts.sequence
    ) order by ts.sequence,ts.starts_at,ts.id),'[]'::jsonb)
    into v_slots
    from public.timetable_slots ts
    where ts.tenant_id=p_tenant_id and ts.branch_id=p_branch_id and ts.status='active';

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'session_id',e.session_id,'group_id',e.group_id,'group_labels',g.labels,
      'program_id',g.program_id,'slot_id',e.slot_id,'slot_labels',sl.labels,
      'starts_at',to_char(sl.starts_at,'HH24:MI'),'ends_at',to_char(sl.ends_at,'HH24:MI'),
      'subject_id',e.subject_id,'subject_labels',sub.labels,'subject_key',sub.key,
      'teacher_person_id',e.teacher_person_id,'teacher_name',tp.display_name,
      'room_key',e.room_key,'weekday',e.weekday,'effective_from',e.effective_from,'effective_to',e.effective_to,
      'status',e.status
    ) order by e.weekday,sl.starts_at,g.id,e.id),'[]'::jsonb)
    into v_entries
    from public.timetable_entries e
    join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
    join public.timetable_slots sl on sl.tenant_id=e.tenant_id and sl.id=e.slot_id
    left join public.subjects sub on sub.tenant_id=e.tenant_id and sub.id=e.subject_id
    left join public.persons tp on tp.tenant_id=e.tenant_id and tp.id=e.teacher_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active';

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'timetable_entry_id',x.timetable_entry_id,'session_date',x.session_date,'action',x.action,
      'replacement_date',x.replacement_date,'replacement_slot_id',x.replacement_slot_id,
      'replacement_teacher_person_id',x.replacement_teacher_person_id,'replacement_teacher_name',rp.display_name,
      'replacement_room_key',x.replacement_room_key,'note',x.note,'status',x.status
    ) order by x.session_date desc,x.id desc),'[]'::jsonb)
    into v_exceptions
    from public.academic_schedule_exceptions x
    left join public.persons rp on rp.tenant_id=x.tenant_id and rp.id=x.replacement_teacher_person_id
    where x.tenant_id=p_tenant_id and x.branch_id=p_branch_id and x.status='active'
      and (x.session_date between v_date-45 and v_date+45 or x.replacement_date between v_date-45 and v_date+45);

    select jsonb_build_object(
      'id',c.id,'event_type',c.event_type,'labels',c.labels,'starts_at',c.starts_at,'ends_at',c.ends_at,
      'description',c.description,'location',c.location,'audience',c.audience,'priority',c.priority,
      'affects_attendance',c.affects_attendance
    )
    into v_closure
    from public.academic_calendar_events c
    where c.tenant_id=p_tenant_id and (c.branch_id is null or c.branch_id=p_branch_id) and c.status='active'
      and c.event_type in ('holiday','closure') and c.affects_attendance
      and c.starts_at < ((v_date+1)::timestamp at time zone v_timezone)
      and c.ends_at > (v_date::timestamp at time zone v_timezone)
    order by case c.event_type when 'closure' then 1 else 2 end,c.starts_at,c.id limit 1;
    v_closed:=v_closure is not null;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',c.id,'session_id',c.session_id,'event_type',c.event_type,'labels',c.labels,
      'starts_at',c.starts_at,'ends_at',c.ends_at,'description',c.description,'location',c.location,
      'audience',c.audience,'priority',c.priority,'affects_attendance',c.affects_attendance,
      'attachment_storage_path',c.attachment_storage_path,'status',c.status
    ) order by c.starts_at,c.id),'[]'::jsonb)
    into v_calendar
    from public.academic_calendar_events c
    where c.tenant_id=p_tenant_id and (c.branch_id is null or c.branch_id=p_branch_id) and c.status='active'
      and c.ends_at >= ((v_date-45)::timestamp at time zone v_timezone)
      and c.starts_at < ((v_date+120)::timestamp at time zone v_timezone);

    if not v_closed then
      with base_occurrence as (
        select e.id entry_id,e.session_id,e.group_id,g.labels group_labels,g.program_id,e.subject_id,sub.labels subject_labels,sub.key subject_key,
          e.teacher_person_id,coalesce(x.replacement_teacher_person_id,e.teacher_person_id) effective_teacher_person_id,
          tp.display_name teacher_name,rtp.display_name replacement_teacher_name,e.room_key,
          e.slot_id,sl.labels slot_labels,sl.starts_at,sl.ends_at,e.weekday,
          coalesce(x.action,'scheduled') occurrence_type,x.id exception_id
        from public.timetable_entries e
        join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
        join public.timetable_slots sl on sl.tenant_id=e.tenant_id and sl.id=e.slot_id and sl.status='active'
        left join public.subjects sub on sub.tenant_id=e.tenant_id and sub.id=e.subject_id
        left join public.persons tp on tp.tenant_id=e.tenant_id and tp.id=e.teacher_person_id
        left join public.academic_schedule_exceptions x on x.tenant_id=e.tenant_id and x.timetable_entry_id=e.id and x.session_date=v_date and x.status='active'
        left join public.persons rtp on rtp.tenant_id=e.tenant_id and rtp.id=x.replacement_teacher_person_id
        where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
          and e.weekday=extract(isodow from v_date)::smallint
          and e.effective_from<=v_date and (e.effective_to is null or e.effective_to>=v_date)
          and (x.id is null or x.action='substitute')
      ), rescheduled_occurrence as (
        select e.id entry_id,e.session_id,e.group_id,g.labels group_labels,g.program_id,e.subject_id,sub.labels subject_labels,sub.key subject_key,
          e.teacher_person_id,coalesce(x.replacement_teacher_person_id,e.teacher_person_id) effective_teacher_person_id,
          tp.display_name teacher_name,rtp.display_name replacement_teacher_name,coalesce(x.replacement_room_key,e.room_key) room_key,
          x.replacement_slot_id slot_id,sl.labels slot_labels,sl.starts_at,sl.ends_at,e.weekday,
          'rescheduled' occurrence_type,x.id exception_id
        from public.academic_schedule_exceptions x
        join public.timetable_entries e on e.tenant_id=x.tenant_id and e.id=x.timetable_entry_id
        join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
        join public.timetable_slots sl on sl.tenant_id=x.tenant_id and sl.id=x.replacement_slot_id and sl.status='active'
        left join public.subjects sub on sub.tenant_id=e.tenant_id and sub.id=e.subject_id
        left join public.persons tp on tp.tenant_id=e.tenant_id and tp.id=e.teacher_person_id
        left join public.persons rtp on rtp.tenant_id=e.tenant_id and rtp.id=x.replacement_teacher_person_id
        where x.tenant_id=p_tenant_id and x.branch_id=p_branch_id and x.status='active'
          and x.action='reschedule' and x.replacement_date=v_date and e.status='active'
      ), occurrences as (
        select * from base_occurrence union all select * from rescheduled_occurrence
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'entry_id',o.entry_id,'exception_id',o.exception_id,'occurrence_type',o.occurrence_type,
        'session_id',o.session_id,'group_id',o.group_id,'group_labels',o.group_labels,'program_id',o.program_id,
        'subject_id',o.subject_id,'subject_labels',o.subject_labels,'subject_key',o.subject_key,
        'teacher_person_id',o.effective_teacher_person_id,'teacher_name',coalesce(o.replacement_teacher_name,o.teacher_name),
        'room_key',o.room_key,'slot_id',o.slot_id,'slot_labels',o.slot_labels,
        'starts_at',to_char(o.starts_at,'HH24:MI'),'ends_at',to_char(o.ends_at,'HH24:MI')
      ) order by o.starts_at,o.group_id,o.entry_id),'[]'::jsonb)
      into v_today from occurrences o;
    end if;
  end if;

  if v_homework_read then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',h.id,'academic_session_id',h.academic_session_id,'group_id',h.group_id,'group_labels',g.labels,
      'student_person_id',h.student_person_id,'student_name',sp.display_name,
      'subject_id',h.subject_id,'subject_labels',sub.labels,'teacher_person_id',h.teacher_person_id,'teacher_name',tp.display_name,
      'title',h.title,'instructions',h.instructions,'assigned_at',h.assigned_at,'due_at',h.due_at,
      'allow_submission',h.allow_submission,'state',h.state,'priority',h.priority,
      'parent_visible',h.parent_visible,'student_visible',h.student_visible,'attachment_storage_path',h.attachment_storage_path
    ) order by h.due_at,h.id),'[]'::jsonb)
    into v_homework
    from public.homework_assignments h
    left join public.academic_groups g on g.tenant_id=h.tenant_id and g.id=h.group_id
    left join public.persons sp on sp.tenant_id=h.tenant_id and sp.id=h.student_person_id
    left join public.subjects sub on sub.tenant_id=h.tenant_id and sub.id=h.subject_id
    left join public.persons tp on tp.tenant_id=h.tenant_id and tp.id=h.teacher_person_id
    where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id
      and (h.state='published' or v_homework_manage)
      and h.state<>'cancelled'
      and h.due_at >= ((v_date-30)::timestamp at time zone v_timezone)
    limit 100;
  end if;

  v_summary:=jsonb_build_object(
    'today_lessons',jsonb_array_length(v_today),
    'active_slots',jsonb_array_length(v_slots),
    'active_timetable_entries',jsonb_array_length(v_entries),
    'open_homework',jsonb_array_length(v_homework),
    'calendar_items',jsonb_array_length(v_calendar),
    'closed_for_attendance',v_closed
  );

  return jsonb_build_object(
    'local_date',v_local_date,'selected_date',v_date,'timezone',v_timezone,
    'permissions',jsonb_build_object(
      'structure_read',v_structure_read,'timetable_manage',v_timetable_manage,
      'homework_read',v_homework_read,'homework_manage',v_homework_manage,'calendar_manage',v_calendar_manage
    ),
    'sessions',v_sessions,'programs',v_programs,'groups',v_groups,'subjects',v_subjects,'teachers',v_teachers,
    'slots',v_slots,'entries',v_entries,'exceptions',v_exceptions,'homework',v_homework,'calendar',v_calendar,
    'today_schedule',v_today,'closure',v_closure,'summary',v_summary
  );
end;
$$;

revoke all on function public.get_academics_timetable_workspace_v1(uuid,bigint,bigint,date) from public,anon,authenticated;
grant execute on function public.get_academics_timetable_workspace_v1(uuid,bigint,bigint,date) to service_role;

commit;
