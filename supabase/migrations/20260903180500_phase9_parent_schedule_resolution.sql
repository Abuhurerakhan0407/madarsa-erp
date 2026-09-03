create or replace function public.get_guardian_resolved_schedule_v1(p_identity_id uuid,p_tenant_id bigint)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','extensions'
as $$
with params as (
  select public.institution_local_date(p_tenant_id) as local_date,
         coalesce((select ip.timezone from public.institution_profiles ip where ip.tenant_id=p_tenant_id limit 1),'Asia/Kolkata') as timezone
), children as (
  select distinct sp.person_id student_person_id,sp.student_number,cp.display_name student_name,e.branch_id,e.group_id
  from public.identity_person_links l
  join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
  join public.student_profiles sp on sp.tenant_id=pr.tenant_id and sp.person_id=pr.target_person_id and sp.status in('active','admitted')
  join public.persons cp on cp.tenant_id=sp.tenant_id and cp.id=sp.person_id and cp.status='active'
  join lateral(
    select ee.* from public.enrollments ee
    where ee.tenant_id=sp.tenant_id and ee.student_person_id=sp.person_id and ee.status in('active','paused')
    order by ee.starts_on desc,ee.id desc limit 1
  ) e on true
  where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified'
), open_children as (
  select c.* from children c cross join params p
  where not exists(
    select 1 from public.academic_calendar_events ev
    where ev.tenant_id=p_tenant_id and (ev.branch_id is null or ev.branch_id=c.branch_id)
      and ev.status='active' and ev.event_type in('holiday','closure') and ev.affects_attendance
      and ev.starts_at < ((p.local_date+1)::timestamp at time zone p.timezone)
      and ev.ends_at > (p.local_date::timestamp at time zone p.timezone)
  )
), base_occurrence as (
  select c.student_person_id,c.student_number,c.student_name,e.id entry_id,e.group_id,g.labels group_labels,
         e.subject_id,s.labels subject_labels,s.key subject_key,
         coalesce(x.replacement_teacher_person_id,e.teacher_person_id) teacher_person_id,
         coalesce(rtp.display_name,tp.display_name) teacher_name,
         coalesce(ep2.designation,ep.designation,replace(he2.designation_key,'_',' '),replace(he.designation_key,'_',' ')) teacher_designation,
         e.room_key,sl.starts_at,sl.ends_at,coalesce(x.action,'scheduled') occurrence_type,x.id exception_id
  from open_children c cross join params p
  join public.timetable_entries e on e.tenant_id=p_tenant_id and e.branch_id=c.branch_id and e.group_id=c.group_id and e.status='active'
    and e.weekday=extract(isodow from p.local_date)::smallint and e.effective_from<=p.local_date and (e.effective_to is null or e.effective_to>=p.local_date)
  join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
  join public.timetable_slots sl on sl.tenant_id=e.tenant_id and sl.id=e.slot_id and sl.status='active'
  left join public.subjects s on s.tenant_id=e.tenant_id and s.id=e.subject_id
  left join public.academic_schedule_exceptions x on x.tenant_id=e.tenant_id and x.timetable_entry_id=e.id and x.session_date=p.local_date and x.status='active'
  left join public.persons tp on tp.tenant_id=e.tenant_id and tp.id=e.teacher_person_id
  left join public.persons rtp on rtp.tenant_id=e.tenant_id and rtp.id=x.replacement_teacher_person_id
  left join public.employee_profiles ep on ep.tenant_id=e.tenant_id and ep.person_id=e.teacher_person_id
  left join public.employee_profiles ep2 on ep2.tenant_id=e.tenant_id and ep2.person_id=x.replacement_teacher_person_id
  left join public.hr_employments he on he.tenant_id=e.tenant_id and he.branch_id=e.branch_id and he.employee_person_id=e.teacher_person_id and he.state in('active','on_leave')
  left join public.hr_employments he2 on he2.tenant_id=e.tenant_id and he2.branch_id=e.branch_id and he2.employee_person_id=x.replacement_teacher_person_id and he2.state in('active','on_leave')
  where x.id is null or x.action='substitute'
), rescheduled_occurrence as (
  select c.student_person_id,c.student_number,c.student_name,e.id entry_id,e.group_id,g.labels group_labels,
         e.subject_id,s.labels subject_labels,s.key subject_key,
         coalesce(x.replacement_teacher_person_id,e.teacher_person_id) teacher_person_id,
         coalesce(rtp.display_name,tp.display_name) teacher_name,
         coalesce(ep2.designation,ep.designation,replace(he2.designation_key,'_',' '),replace(he.designation_key,'_',' ')) teacher_designation,
         coalesce(x.replacement_room_key,e.room_key) room_key,sl.starts_at,sl.ends_at,'rescheduled'::text occurrence_type,x.id exception_id
  from open_children c cross join params p
  join public.academic_schedule_exceptions x on x.tenant_id=p_tenant_id and x.branch_id=c.branch_id and x.status='active' and x.action='reschedule' and x.replacement_date=p.local_date
  join public.timetable_entries e on e.tenant_id=x.tenant_id and e.id=x.timetable_entry_id and e.group_id=c.group_id and e.status='active'
  join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
  join public.timetable_slots sl on sl.tenant_id=x.tenant_id and sl.id=x.replacement_slot_id and sl.status='active'
  left join public.subjects s on s.tenant_id=e.tenant_id and s.id=e.subject_id
  left join public.persons tp on tp.tenant_id=e.tenant_id and tp.id=e.teacher_person_id
  left join public.persons rtp on rtp.tenant_id=e.tenant_id and rtp.id=x.replacement_teacher_person_id
  left join public.employee_profiles ep on ep.tenant_id=e.tenant_id and ep.person_id=e.teacher_person_id
  left join public.employee_profiles ep2 on ep2.tenant_id=e.tenant_id and ep2.person_id=x.replacement_teacher_person_id
  left join public.hr_employments he on he.tenant_id=e.tenant_id and he.branch_id=e.branch_id and he.employee_person_id=e.teacher_person_id and he.state in('active','on_leave')
  left join public.hr_employments he2 on he2.tenant_id=e.tenant_id and he2.branch_id=e.branch_id and he2.employee_person_id=x.replacement_teacher_person_id and he2.state in('active','on_leave')
), occurrences as (
  select * from base_occurrence union all select * from rescheduled_occurrence
)
select coalesce(jsonb_agg(jsonb_build_object(
  'student_person_id',o.student_person_id,'student_number',o.student_number,'student_name',o.student_name,
  'entry_id',o.entry_id,'exception_id',o.exception_id,'occurrence_type',o.occurrence_type,
  'group_id',o.group_id,'group_labels',o.group_labels,'subject_id',o.subject_id,'subject_labels',o.subject_labels,'subject_key',o.subject_key,
  'teacher_person_id',o.teacher_person_id,'teacher_name',o.teacher_name,'teacher_designation',o.teacher_designation,
  'room_key',o.room_key,'starts_at',to_char(o.starts_at,'HH24:MI'),'ends_at',to_char(o.ends_at,'HH24:MI')
) order by o.starts_at,o.student_name,o.entry_id),'[]'::jsonb) from occurrences o;
$$;
revoke all on function public.get_guardian_resolved_schedule_v1(uuid,bigint) from public,anon,authenticated;
grant execute on function public.get_guardian_resolved_schedule_v1(uuid,bigint) to service_role;
