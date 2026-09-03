create or replace function public.get_portal_home_v2(p_identity_id uuid,p_tenant_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_base jsonb;
  v_overview jsonb;
begin
  v_base:=public.get_portal_home_v1(p_identity_id,p_tenant_id);
  if not exists(select 1 from public.identity_person_links l where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified') then
    return v_base||jsonb_build_object('overview',jsonb_build_object('urgent_notices','[]'::jsonb,'today_schedule','[]'::jsonb,'homework','[]'::jsonb,'results','[]'::jsonb,'events','[]'::jsonb,'teachers','[]'::jsonb));
  end if;

  v_overview:=jsonb_build_object(
    'urgent_notices',coalesce((select jsonb_agg(to_jsonb(x) order by x.published_at desc,x.id desc) from (
      select distinct n.id,n.labels,n.body,n.priority,n.published_at,n.expires_at
      from public.portal_notices n
      where n.tenant_id=p_tenant_id and n.state='published' and n.priority='urgent' and n.published_at<=now() and (n.expires_at is null or n.expires_at>now())
        and n.audience_type in('tenant','parents')
        and (n.branch_id is null or exists(
          select 1 from public.identity_person_links l
          join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
          join public.enrollments e on e.tenant_id=pr.tenant_id and e.student_person_id=pr.target_person_id and e.status in('active','paused')
          where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified' and e.branch_id=n.branch_id
        ))
      order by n.published_at desc,n.id desc limit 5
    ) x),'[]'::jsonb),
    'today_schedule',coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_at,x.student_name,x.subject_name) from (
      select distinct sp.person_id student_person_id,sp.student_number,cp.display_name student_name,
        g.id group_id,g.labels group_labels,s.id subject_id,s.labels subject_labels,coalesce(s.labels->>'en',s.key) subject_name,
        ts.starts_at,ts.ends_at,te.room_key,p.display_name teacher_name,coalesce(ep.designation,replace(he.designation_key,'_',' ')) teacher_designation
      from public.identity_person_links l
      join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
      join public.student_profiles sp on sp.tenant_id=pr.tenant_id and sp.person_id=pr.target_person_id and sp.status in('active','admitted')
      join public.persons cp on cp.tenant_id=sp.tenant_id and cp.id=sp.person_id
      join public.enrollments e on e.tenant_id=sp.tenant_id and e.student_person_id=sp.person_id and e.status in('active','paused')
      join public.timetable_entries te on te.tenant_id=e.tenant_id and te.branch_id=e.branch_id and te.group_id=e.group_id and te.status='active' and te.weekday=extract(isodow from current_date)::int and te.effective_from<=current_date and (te.effective_to is null or te.effective_to>=current_date)
      join public.timetable_slots ts on ts.tenant_id=te.tenant_id and ts.id=te.slot_id
      join public.academic_groups g on g.tenant_id=te.tenant_id and g.id=te.group_id
      join public.subjects s on s.tenant_id=te.tenant_id and s.id=te.subject_id
      left join public.persons p on p.tenant_id=te.tenant_id and p.id=te.teacher_person_id
      left join public.employee_profiles ep on ep.tenant_id=te.tenant_id and ep.person_id=te.teacher_person_id
      left join public.hr_employments he on he.tenant_id=te.tenant_id and he.branch_id=te.branch_id and he.employee_person_id=te.teacher_person_id and he.state in('active','on_leave')
      where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified'
    ) x),'[]'::jsonb),
    'homework',coalesce((select jsonb_agg(to_jsonb(x) order by x.due_at,x.id) from (
      select distinct h.id,h.title,h.instructions,h.priority,h.assigned_at,h.due_at,
        sp.person_id student_person_id,sp.student_number,cp.display_name student_name,s.labels subject_labels,p.display_name teacher_name
      from public.identity_person_links l
      join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
      join public.student_profiles sp on sp.tenant_id=pr.tenant_id and sp.person_id=pr.target_person_id and sp.status in('active','admitted')
      join public.persons cp on cp.tenant_id=sp.tenant_id and cp.id=sp.person_id
      join public.enrollments e on e.tenant_id=sp.tenant_id and e.student_person_id=sp.person_id and e.status in('active','paused')
      join public.homework_assignments h on h.tenant_id=e.tenant_id and h.branch_id=e.branch_id and h.state='published' and h.parent_visible=true and (h.student_person_id=sp.person_id or h.group_id=e.group_id)
      join public.subjects s on s.tenant_id=h.tenant_id and s.id=h.subject_id
      left join public.persons p on p.tenant_id=h.tenant_id and p.id=h.teacher_person_id
      where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified' and h.due_at>=now()-interval '7 days'
      order by h.due_at limit 20
    ) x),'[]'::jsonb),
    'results',coalesce((select jsonb_agg(to_jsonb(x) order by x.published_at desc,x.snapshot_id desc) from (
      select distinct rs.id snapshot_id,rs.student_person_id,sp.student_number,p.display_name student_name,rs.percentage,rs.aggregate_status,rs.grade_key,rs.rank_value,rs.published_at,es.id exam_id,es.labels exam_labels
      from public.identity_person_links l
      join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
      join public.student_profiles sp on sp.tenant_id=pr.tenant_id and sp.person_id=pr.target_person_id
      join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
      join public.result_snapshots rs on rs.tenant_id=sp.tenant_id and rs.student_person_id=sp.person_id and rs.state='published'
      join public.result_runs rr on rr.tenant_id=rs.tenant_id and rr.id=rs.result_run_id
      join public.exam_series es on es.tenant_id=rr.tenant_id and es.id=rr.exam_series_id
      join public.result_publications rp on rp.tenant_id=rr.tenant_id and rp.result_run_id=rr.id and rp.revoked_at is null
      where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified'
      order by rs.published_at desc,rs.id desc limit 20
    ) x),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_at,x.id) from (
      select distinct ev.id,ev.event_type,ev.labels,ev.description,ev.location,ev.priority,ev.starts_at,ev.ends_at
      from public.academic_calendar_events ev
      where ev.tenant_id=p_tenant_id and ev.status='active' and ev.audience in('all','parents') and ev.ends_at>=now()
        and (ev.branch_id is null or exists(
          select 1 from public.identity_person_links l
          join public.person_relationships pr on pr.tenant_id=l.tenant_id and pr.source_person_id=l.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
          join public.enrollments e on e.tenant_id=pr.tenant_id and e.student_person_id=pr.target_person_id and e.status in('active','paused')
          where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified' and e.branch_id=ev.branch_id
        ))
      order by ev.starts_at limit 20
    ) x),'[]'::jsonb),
    'teachers',coalesce((select jsonb_agg(to_jsonb(x) order by x.teacher_name,x.teacher_person_id) from (
      select distinct tp.id teacher_person_id,tp.display_name teacher_name,tp.photo_storage_path,
        coalesce(ep.designation,replace(he.designation_key,'_',' ')) designation,g.id group_id,g.labels group_labels,
        coalesce(subjects.items,'[]'::jsonb) subjects,prg.id program_id,prg.labels program_labels
      from public.identity_person_links l
      join public.person_relationships rel on rel.tenant_id=l.tenant_id and rel.source_person_id=l.person_id and rel.status='verified' and rel.portal_visibility in('limited','standard')
      join public.enrollments e on e.tenant_id=rel.tenant_id and e.student_person_id=rel.target_person_id and e.status in('active','paused')
      join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
      join public.programs prg on prg.tenant_id=e.tenant_id and prg.id=e.program_id
      join public.hr_employments he on he.tenant_id=e.tenant_id and he.branch_id=e.branch_id and he.state in('active','on_leave') and (
        he.employee_person_id=g.primary_teacher_person_id or exists(select 1 from public.timetable_entries te where te.tenant_id=e.tenant_id and te.branch_id=e.branch_id and te.group_id=e.group_id and te.teacher_person_id=he.employee_person_id and te.status='active')
      )
      join public.persons tp on tp.tenant_id=he.tenant_id and tp.id=he.employee_person_id
      left join public.employee_profiles ep on ep.tenant_id=he.tenant_id and ep.person_id=he.employee_person_id
      left join lateral (
        select jsonb_agg(jsonb_build_object('id',q.id,'labels',q.labels) order by q.id) items from (
          select distinct s.id,s.labels from public.timetable_entries te join public.subjects s on s.tenant_id=te.tenant_id and s.id=te.subject_id where te.tenant_id=e.tenant_id and te.branch_id=e.branch_id and te.group_id=e.group_id and te.teacher_person_id=he.employee_person_id and te.status='active'
          union
          select distinct s.id,s.labels from public.curriculum_teaching_assignments c join public.curriculum_version_items i on i.tenant_id=c.tenant_id and i.id=c.curriculum_item_id join public.subjects s on s.tenant_id=i.tenant_id and s.id=i.subject_id where c.tenant_id=e.tenant_id and c.group_id=e.group_id and c.teacher_person_id=he.employee_person_id and c.status='active'
        ) q
      ) subjects on true
      where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id and l.link_type='guardian' and l.status='verified'
    ) x),'[]'::jsonb)
  );

  return v_base||jsonb_build_object('overview',v_overview);
end;
$$;
revoke all on function public.get_portal_home_v2(uuid,bigint) from public,anon,authenticated;
grant execute on function public.get_portal_home_v2(uuid,bigint) to service_role;
