begin;

-- P0 forward-fix: branch provenance belongs to academic domain rows, not audit-event existence.
-- Historical rows are backfilled only where existing domain relationships prove one branch.
alter table public.curriculum_teaching_assignments
  add column if not exists source_branch_id bigint;
alter table public.student_curriculum_progress
  add column if not exists source_branch_id bigint;

do $block$
begin
  if not exists(select 1 from pg_constraint where conname='curriculum_teaching_assignments_source_branch_fk' and conrelid='public.curriculum_teaching_assignments'::regclass) then
    alter table public.curriculum_teaching_assignments add constraint curriculum_teaching_assignments_source_branch_fk
      foreign key (tenant_id,source_branch_id) references public.branches(tenant_id,id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='student_curriculum_progress_source_branch_fk' and conrelid='public.student_curriculum_progress'::regclass) then
    alter table public.student_curriculum_progress add constraint student_curriculum_progress_source_branch_fk
      foreign key (tenant_id,source_branch_id) references public.branches(tenant_id,id) on delete restrict;
  end if;
end;
$block$;

create index if not exists curriculum_teaching_assignments_source_branch_idx
  on public.curriculum_teaching_assignments(tenant_id,source_branch_id,session_id,program_id,status)
  where source_branch_id is not null;
create index if not exists student_curriculum_progress_source_branch_idx
  on public.student_curriculum_progress(tenant_id,source_branch_id,student_person_id,occurred_at desc)
  where source_branch_id is not null;
-- Group-target assignments have authoritative branch ownership on academic_groups.
update public.curriculum_teaching_assignments a
set source_branch_id=g.branch_id
from public.academic_groups g
where a.source_branch_id is null
  and a.group_id is not null
  and g.tenant_id=a.tenant_id
  and g.id=a.group_id
  and g.session_id=a.session_id
  and g.program_id=a.program_id;

-- Student-target assignments are backfilled only when exactly one effective branch is provable.
update public.curriculum_teaching_assignments a
set source_branch_id=(
  select min(e.branch_id)
  from public.enrollments e
  where e.tenant_id=a.tenant_id
    and e.student_person_id=a.student_person_id
    and e.session_id=a.session_id
    and e.program_id=a.program_id
    and e.status<>'cancelled'
    and coalesce(e.starts_on,a.starts_on)<=a.starts_on
    and (e.ends_on is null or e.ends_on>=a.starts_on)
  having count(distinct e.branch_id)=1
)
where a.source_branch_id is null
  and a.student_person_id is not null;
-- Progress inherits only already-proven assignment provenance and must also match
-- the student's effective enrollment at the exact progress date.
update public.student_curriculum_progress scp
set source_branch_id=ta.source_branch_id
from public.curriculum_teaching_assignments ta
where scp.source_branch_id is null
  and ta.tenant_id=scp.tenant_id
  and ta.id=scp.teaching_assignment_id
  and ta.source_branch_id is not null
  and ta.starts_on<=scp.occurred_at::date
  and (ta.ends_on is null or ta.ends_on>=scp.occurred_at::date)
  and (ta.teacher_person_id is null or ta.teacher_person_id is not distinct from scp.teacher_person_id)
  and exists(
    select 1 from public.curriculum_units u
    where u.tenant_id=scp.tenant_id and u.id=scp.curriculum_unit_id
      and u.curriculum_item_id=ta.curriculum_item_id
  )
  and exists(
    select 1 from public.enrollments e
    where e.tenant_id=scp.tenant_id and e.branch_id=ta.source_branch_id
      and e.student_person_id=scp.student_person_id
      and e.session_id=ta.session_id and e.program_id=ta.program_id
      and e.status<>'cancelled'
      and e.starts_on<=scp.occurred_at::date
      and (e.ends_on is null or e.ends_on>=scp.occurred_at::date)
      and (ta.group_id is null or e.group_id=ta.group_id)
  );
create or replace function public.enforce_academic_domain_branch_provenance_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_assignment public.curriculum_teaching_assignments%rowtype;
begin
  if tg_table_name='curriculum_teaching_assignments' then
    if tg_op='INSERT' and new.source_branch_id is null then
      raise exception 'teaching assignment branch provenance is required';
    end if;
    if tg_op='UPDATE' and new.source_branch_id is distinct from old.source_branch_id then
      raise exception 'teaching assignment branch provenance is immutable';
    end if;
    if new.source_branch_id is null then return new; end if;
    if not exists(select 1 from public.branches b where b.tenant_id=new.tenant_id and b.id=new.source_branch_id) then
      raise exception 'teaching assignment branch provenance is invalid';
    end if;
    if new.group_id is not null and not exists(
      select 1 from public.academic_groups g
      where g.tenant_id=new.tenant_id and g.id=new.group_id and g.branch_id=new.source_branch_id
        and g.session_id=new.session_id and g.program_id=new.program_id
    ) then raise exception 'teaching assignment group does not match source branch'; end if;
    if new.student_person_id is not null and not exists(
      select 1 from public.enrollments e
      where e.tenant_id=new.tenant_id and e.branch_id=new.source_branch_id
        and e.student_person_id=new.student_person_id and e.session_id=new.session_id
        and e.program_id=new.program_id and e.status<>'cancelled'
    ) then raise exception 'teaching assignment student does not match source branch'; end if;
    return new;
  end if;
  if tg_table_name='student_curriculum_progress' then
    if tg_op='INSERT' and (new.source_branch_id is null or new.teaching_assignment_id is null) then
      raise exception 'curriculum progress branch provenance is required';
    end if;
    if tg_op='UPDATE' and (
      new.source_branch_id is distinct from old.source_branch_id
      or new.teaching_assignment_id is distinct from old.teaching_assignment_id
      or new.student_person_id is distinct from old.student_person_id
      or new.curriculum_unit_id is distinct from old.curriculum_unit_id
      or new.teacher_person_id is distinct from old.teacher_person_id
      or new.occurred_at is distinct from old.occurred_at
    ) then raise exception 'curriculum progress provenance is immutable'; end if;
    if new.source_branch_id is null then return new; end if;

    select a.* into v_assignment
    from public.curriculum_teaching_assignments a
    where a.tenant_id=new.tenant_id and a.id=new.teaching_assignment_id
      and a.source_branch_id=new.source_branch_id
    limit 1;
    if v_assignment.id is null then raise exception 'curriculum progress assignment provenance is invalid'; end if;
    if v_assignment.starts_on>new.occurred_at::date
      or (v_assignment.ends_on is not null and v_assignment.ends_on<new.occurred_at::date) then
      raise exception 'curriculum progress is outside assignment dates';
    end if;
    if v_assignment.teacher_person_id is distinct from new.teacher_person_id then
      raise exception 'curriculum progress teacher does not match assignment';
    end if;
    if not exists(
      select 1 from public.curriculum_units u
      where u.tenant_id=new.tenant_id and u.id=new.curriculum_unit_id
        and u.curriculum_item_id=v_assignment.curriculum_item_id
    ) then raise exception 'curriculum progress unit does not match assignment'; end if;
    if not exists(
      select 1 from public.enrollments e
      where e.tenant_id=new.tenant_id and e.branch_id=new.source_branch_id
        and e.student_person_id=new.student_person_id
        and e.session_id=v_assignment.session_id and e.program_id=v_assignment.program_id
        and e.status<>'cancelled'
        and e.starts_on<=new.occurred_at::date
        and (e.ends_on is null or e.ends_on>=new.occurred_at::date)
        and (v_assignment.group_id is null or e.group_id=v_assignment.group_id)
    ) then raise exception 'curriculum progress student does not match source branch enrollment'; end if;
    if not (
      v_assignment.student_person_id=new.student_person_id
      or (v_assignment.student_person_id is null and v_assignment.group_id is not null)
    ) then raise exception 'curriculum progress student is outside assignment target'; end if;
    return new;
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_academic_domain_branch_provenance_v1() from public,anon,authenticated;
grant execute on function public.enforce_academic_domain_branch_provenance_v1() to service_role;
drop trigger if exists curriculum_teaching_assignment_branch_provenance_guard
  on public.curriculum_teaching_assignments;
create trigger curriculum_teaching_assignment_branch_provenance_guard
before insert or update of source_branch_id,session_id,program_id,group_id,student_person_id
on public.curriculum_teaching_assignments
for each row execute function public.enforce_academic_domain_branch_provenance_v1();

drop trigger if exists student_curriculum_progress_branch_provenance_guard
  on public.student_curriculum_progress;
create trigger student_curriculum_progress_branch_provenance_guard
before insert or update of source_branch_id,teaching_assignment_id,student_person_id,curriculum_unit_id,teacher_person_id,occurred_at
on public.student_curriculum_progress
for each row execute function public.enforce_academic_domain_branch_provenance_v1();

-- Governed assignment writes now persist immutable branch provenance.
create or replace function public.assign_curriculum_teaching_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_session_id bigint,p_curriculum_item_id bigint,
  p_group_id bigint,p_student_person_id bigint,p_teacher_person_id bigint,p_evaluation_method text,
  p_starts_on date,p_ends_on date
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_membership_id bigint;v_assignment_id bigint;v_program_id bigint;v_progress_method text;
begin
  v_membership_id:=private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['academics.structure.manage','learning.curriculum.manage']);
  if v_membership_id is null then raise exception 'curriculum assignment permission denied'; end if;
  if ((p_group_id is not null)::int + (p_student_person_id is not null)::int)<>1 then raise exception 'select exactly one group or student target'; end if;
  if p_teacher_person_id is null or not exists(select 1 from public.employee_profiles e where e.tenant_id=p_tenant_id and e.person_id=p_teacher_person_id and e.status='active') then raise exception 'active teacher is required'; end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on<p_starts_on) then raise exception 'assignment dates are invalid'; end if;
  select cv.program_id,i.progress_method into v_program_id,v_progress_method
  from public.curriculum_version_items i
  join public.curriculum_versions cv on cv.tenant_id=i.tenant_id and cv.id=i.curriculum_version_id and cv.state='published'
  join public.programs p on p.tenant_id=cv.tenant_id and p.id=cv.program_id and p.status='active' and (p.branch_id is null or p.branch_id=p_branch_id)
  where i.tenant_id=p_tenant_id and i.id=p_curriculum_item_id;
  if v_program_id is null then raise exception 'published curriculum item is required'; end if;
  if p_evaluation_method is distinct from v_progress_method then raise exception 'evaluation method must match the published curriculum progress method'; end if;
  if not exists(select 1 from public.academic_sessions s where s.tenant_id=p_tenant_id and s.id=p_session_id and s.status='active') then raise exception 'active academic session is required'; end if;
  if p_group_id is not null and not exists(
    select 1 from public.academic_groups g
    where g.tenant_id=p_tenant_id and g.id=p_group_id and g.branch_id=p_branch_id
      and g.session_id=p_session_id and g.program_id=v_program_id and g.status='active'
  ) then raise exception 'group target is invalid'; end if;
  if p_student_person_id is not null and not exists(
    select 1 from public.enrollments e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id
      and e.session_id=p_session_id and e.program_id=v_program_id and e.status='active'
  ) then raise exception 'student target is not actively enrolled in this program'; end if;
  insert into public.curriculum_teaching_assignments(
    tenant_id,source_branch_id,session_id,program_id,curriculum_item_id,group_id,student_person_id,
    teacher_person_id,evaluation_method,status,starts_on,ends_on
  ) values(
    p_tenant_id,p_branch_id,p_session_id,v_program_id,p_curriculum_item_id,p_group_id,p_student_person_id,
    p_teacher_person_id,p_evaluation_method,'active',p_starts_on,p_ends_on
  ) returning id into v_assignment_id;
  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.curriculum.assign','succeeded',
    'curriculum_teaching_assignment',v_assignment_id::text,gen_random_uuid(),
    jsonb_build_object('program_id',v_program_id,'session_id',p_session_id,'curriculum_item_id',p_curriculum_item_id,
      'group_id',p_group_id,'student_person_id',p_student_person_id,'teacher_person_id',p_teacher_person_id,'source_branch_id',p_branch_id)
  );
  return jsonb_build_object('assignment_id',v_assignment_id,'program_id',v_program_id,
    'evaluation_method',p_evaluation_method,'source_branch_id',p_branch_id);
end;
$$;
revoke all on function public.assign_curriculum_teaching_v1(uuid,bigint,bigint,bigint,bigint,bigint,bigint,bigint,text,date,date)
  from public,anon,authenticated;
grant execute on function public.assign_curriculum_teaching_v1(uuid,bigint,bigint,bigint,bigint,bigint,bigint,bigint,text,date,date)
  to service_role;

-- Governed progress writes inherit the assignment's exact immutable branch provenance.
create or replace function public.record_student_curriculum_progress_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_assignment_id bigint,p_student_person_id bigint,
  p_curriculum_unit_id bigint,p_teacher_person_id bigint,p_state text,p_progress_value jsonb,p_notes text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_membership_id bigint;v_progress_id bigint;v_method text;
  v_assignment public.curriculum_teaching_assignments%rowtype;v_numeric numeric;v_max numeric;
begin
  v_membership_id:=private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['learning.progress.manage']);
  if v_membership_id is null then raise exception 'curriculum progress permission denied'; end if;
  select a.* into v_assignment
  from public.curriculum_teaching_assignments a
  where a.tenant_id=p_tenant_id and a.id=p_assignment_id
    and a.source_branch_id=p_branch_id
    and a.status='active'
    and (a.ends_on is null or a.ends_on>=current_date);
  if v_assignment.id is null then raise exception 'active teaching assignment is required in this branch'; end if;
  if p_teacher_person_id is null or p_teacher_person_id is distinct from v_assignment.teacher_person_id then raise exception 'assigned teacher is required'; end if;
  if p_state not in ('not_started','in_progress','completed','passed','repeat','needs_support','skipped') then raise exception 'progress state is invalid'; end if;
  if length(coalesce(p_notes,''))>2000 then raise exception 'progress notes are too long'; end if;
  if length(coalesce(p_progress_value,'{}'::jsonb)::text)>4000 then raise exception 'progress value is too large'; end if;
  if not exists(
    select 1 from public.curriculum_units u
    where u.tenant_id=p_tenant_id and u.id=p_curriculum_unit_id
      and u.curriculum_item_id=v_assignment.curriculum_item_id
  ) then raise exception 'curriculum unit is outside this assignment'; end if;
  if not (
    v_assignment.student_person_id=p_student_person_id
    or (v_assignment.group_id is not null and exists(
      select 1 from public.enrollments e
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
        and e.student_person_id=p_student_person_id and e.session_id=v_assignment.session_id
        and e.program_id=v_assignment.program_id and e.group_id=v_assignment.group_id and e.status='active'
    ))
  ) then raise exception 'student is outside this teaching assignment'; end if;
  v_method:=v_assignment.evaluation_method;
  if v_method='percentage' then
    begin v_numeric:=(p_progress_value->>'percent')::numeric; exception when others then raise exception 'percentage progress requires numeric percent'; end;
    if v_numeric<0 or v_numeric>100 then raise exception 'percentage progress must be between 0 and 100'; end if;
  elsif v_method='rating' then
    begin v_numeric:=(p_progress_value->>'rating')::numeric; exception when others then raise exception 'rating progress requires numeric rating'; end;
    if v_numeric<1 or v_numeric>5 then raise exception 'rating must be between 1 and 5'; end if;
  elsif v_method in ('score','marks') then
    begin v_numeric:=(p_progress_value->>'score')::numeric;v_max:=(p_progress_value->>'max')::numeric; exception when others then raise exception 'score progress requires score and max'; end;
    if v_max<=0 or v_numeric<0 or v_numeric>v_max then raise exception 'score progress is invalid'; end if;
  end if;

  insert into public.student_curriculum_progress(
    tenant_id,source_branch_id,student_person_id,curriculum_unit_id,teaching_assignment_id,
    teacher_person_id,progress_method,state,progress_value,notes
  ) values(
    p_tenant_id,p_branch_id,p_student_person_id,p_curriculum_unit_id,p_assignment_id,
    p_teacher_person_id,v_method,p_state,coalesce(p_progress_value,'{}'::jsonb),nullif(btrim(coalesce(p_notes,'')),'')
  ) returning id into v_progress_id;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.curriculum.progress.record','succeeded',
    'student_curriculum_progress',v_progress_id::text,gen_random_uuid(),
    jsonb_build_object('assignment_id',p_assignment_id,'student_person_id',p_student_person_id,
      'curriculum_unit_id',p_curriculum_unit_id,'state',p_state,'progress_method',v_method,'source_branch_id',p_branch_id)
  );
  return jsonb_build_object(
    'progress_id',v_progress_id,'assignment_id',p_assignment_id,'student_person_id',p_student_person_id,
    'state',p_state,'progress_method',v_method,'source_branch_id',p_branch_id
  );
end;
$$;
revoke all on function public.record_student_curriculum_progress_v1(uuid,bigint,bigint,bigint,bigint,bigint,bigint,text,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.record_student_curriculum_progress_v1(uuid,bigint,bigint,bigint,bigint,bigint,bigint,text,jsonb,text)
  to service_role;

create or replace function public.run_operational_report_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_report_key text,
  p_parameters jsonb default '{}'::jsonb,
  p_output_format text default 'screen',
  p_request_key text default null
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_definition public.report_definitions%rowtype;
  v_rows jsonb:='[]'::jsonb;
  v_columns jsonb:='[]'::jsonb;
  v_count bigint:=0;
  v_run_id bigint;
  v_existing bigint;
  v_today date:=public.institution_local_date(p_tenant_id);
  v_date_from date;
  v_date_to date;
  v_session_id bigint;
  v_program_id bigint;
  v_group_id bigint;
  v_student_id bigint;
  v_teacher_id bigint;
begin
  p_report_key:=btrim(coalesce(p_report_key,''));
  p_parameters:=coalesce(p_parameters,'{}'::jsonb);
  if p_output_format not in ('screen','csv','json') then raise exception 'unsupported operational report format'; end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'valid report request key is required'; end if;

  begin
    if nullif(p_parameters->>'attendance_date','') is not null then
      v_date_from:=(p_parameters->>'attendance_date')::date; v_date_to:=v_date_from;
    else
      v_date_to:=coalesce(nullif(p_parameters->>'date_to','')::date,v_today);
      v_date_from:=coalesce(nullif(p_parameters->>'date_from','')::date,v_date_to-29);
    end if;
  exception when others then raise exception 'invalid report date range'; end;
  if v_date_from>v_date_to or (v_date_to-v_date_from)>366 then raise exception 'report date range must be between 1 and 367 days'; end if;
  begin v_session_id:=nullif(p_parameters->>'session_id','')::bigint; exception when others then raise exception 'invalid academic session filter'; end;
  begin v_program_id:=nullif(p_parameters->>'program_id','')::bigint; exception when others then raise exception 'invalid program filter'; end;
  begin v_group_id:=nullif(p_parameters->>'group_id','')::bigint; exception when others then raise exception 'invalid group filter'; end;
  begin v_student_id:=nullif(p_parameters->>'student_person_id','')::bigint; exception when others then raise exception 'invalid student filter'; end;
  begin v_teacher_id:=nullif(p_parameters->>'teacher_person_id','')::bigint; exception when others then raise exception 'invalid teacher filter'; end;
  if coalesce(v_session_id,1)<=0 or coalesce(v_program_id,1)<=0 or coalesce(v_group_id,1)<=0 or coalesce(v_student_id,1)<=0 or coalesce(v_teacher_id,1)<=0 then raise exception 'report filters must be positive identifiers'; end if;

  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='report.run.execute'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'report execution permission denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required'; end if;

  select rd.* into v_definition from public.report_definitions rd
  where rd.tenant_id=p_tenant_id and rd.key=p_report_key and rd.state='published'
  order by rd.version desc limit 1;
  if v_definition.id is null then raise exception 'published report definition not found'; end if;

  if p_report_key='daily_attendance' then
    v_columns:='["attendance_date","student_number","name","program","class_group","status","source","marked_at"]'::jsonb;
    with effective as(
      select distinct on(s.attendance_date,ar.person_id)
        s.attendance_date,ar.person_id,ar.enrollment_id,coalesce(ac.requested_status_key,ar.status_key) status,ar.source,ar.marked_at
      from public.attendance_records ar
      join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id and s.branch_id=p_branch_id
      left join lateral(select c.requested_status_key from public.attendance_corrections c where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved' order by c.reviewed_at desc,c.id desc limit 1) ac on true
      where ar.tenant_id=p_tenant_id and s.attendance_date between v_date_from and v_date_to
      order by s.attendance_date,ar.person_id,ar.marked_at desc,ar.id desc
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date desc,x.name,x.student_number),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select a.attendance_date,sp.student_number,p.display_name name,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,a.status,a.source,a.marked_at
      from effective a
      join public.enrollments e on e.tenant_id=p_tenant_id and e.id=a.enrollment_id and e.branch_id=p_branch_id
      join public.student_profiles sp on sp.tenant_id=p_tenant_id and sp.person_id=a.person_id
      join public.persons p on p.tenant_id=p_tenant_id and p.id=a.person_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=e.program_id
      left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=e.group_id
      where (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or a.person_id=v_student_id)
    ) x;

  elsif p_report_key='student_strength' then
    v_columns:='["academic_session","program","class_group","students","capacity","utilization_pct"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.program,x.class_group),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select coalesce(s.labels->>'en',s.key) academic_session,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,
        count(distinct e.student_person_id)::int students,g.capacity,
        case when g.capacity is null or g.capacity=0 then null else round((count(distinct e.student_person_id)::numeric/g.capacity)*100,1) end utilization_pct
      from public.enrollments e
      join public.academic_sessions s on s.tenant_id=e.tenant_id and s.id=e.session_id
      join public.programs pr on pr.tenant_id=e.tenant_id and pr.id=e.program_id
      join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status<>'cancelled'
        and coalesce(e.starts_on,v_date_to)<=v_date_to and (e.ends_on is null or e.ends_on>=v_date_to)
        and (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or e.student_person_id=v_student_id)
      group by s.id,s.labels,s.key,pr.id,pr.labels,pr.key,g.id,g.labels,g.key,g.capacity
    ) x;

  elsif p_report_key='teacher_attendance' then
    v_columns:='["attendance_date","teacher_id","teacher_name","designation","status","source","check_in","check_out"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date desc,x.teacher_name),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select a.attendance_date,h.employee_number teacher_id,p.display_name teacher_name,h.designation_key designation,a.status,a.source,a.check_in_at check_in,a.check_out_at check_out
      from public.hr_effective_attendance_v1 a
      join public.hr_employments h on h.tenant_id=a.tenant_id and h.id=a.employment_id and h.branch_id=p_branch_id
      join public.persons p on p.tenant_id=h.tenant_id and p.id=h.employee_person_id
      where a.tenant_id=p_tenant_id and a.attendance_date between v_date_from and v_date_to and (v_teacher_id is null or h.employee_person_id=v_teacher_id)
    ) x;

  elsif p_report_key='quran_progress' then
    v_columns:='["student_number","name","program","class_group","latest_category","latest_portion","latest_score","latest_outcome","attempts","revision_due"]'::jsonb;
    with students as(
      select distinct on(e.student_person_id) e.student_person_id,e.program_id,e.group_id
      from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted')
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
        and (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or e.student_person_id=v_student_id)
      order by e.student_person_id,e.starts_on desc nulls last,e.id desc
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.name,x.student_number),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select sp.student_number,p.display_name name,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,
        la.work_category latest_category,
        case when la.juz_number is not null then 'Juz '||la.juz_number when la.start_surah_number is not null then format('%s:%s-%s:%s',la.start_surah_number,la.start_ayah_number,la.end_surah_number,la.end_ayah_number) when la.page_start is not null then format('Pages %s-%s',la.page_start,la.page_end) else null end latest_portion,
        la.overall_score latest_score,la.outcome latest_outcome,coalesce(stats.attempts,0) attempts,coalesce(rv.revision_due,0) revision_due
      from students st
      join public.student_profiles sp on sp.tenant_id=p_tenant_id and sp.person_id=st.student_person_id
      join public.persons p on p.tenant_id=p_tenant_id and p.id=st.student_person_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=st.program_id
      left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=st.group_id
      left join lateral(
        select a.* from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=st.student_person_id and rs.branch_id=p_branch_id and a.occurred_at::date between v_date_from and v_date_to
        order by a.occurred_at desc,a.id desc limit 1
      ) la on true
      left join lateral(
        select count(*)::int attempts from public.quran_effective_recitation_attempts_v1 a join public.recitation_sessions rs on rs.tenant_id=a.tenant_id and rs.id=a.recitation_session_id
        where a.tenant_id=p_tenant_id and a.student_person_id=st.student_person_id and rs.branch_id=p_branch_id and a.occurred_at::date between v_date_from and v_date_to
      ) stats on true
      left join lateral(
        select count(*)::int revision_due
        from public.revision_obligations r
        where r.tenant_id=p_tenant_id and r.student_person_id=st.student_person_id
          and r.state in('due','assigned','attempted') and r.due_on<=v_date_to
          and public.quran_revision_obligation_in_branch_v1(r.id,p_tenant_id,p_branch_id,st.student_person_id)
      ) rv on true
    ) x;

  elsif p_report_key='program_progress' then
    v_columns:='["student_number","student_name","program","class_group","component","unit","state","progress_method","progress_value","occurred_at"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.occurred_at desc,x.student_name),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select sp.student_number,p.display_name student_name,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,
        coalesce(sub.labels->>'en',sub.key,'Component') component,coalesce(u.labels->>'en',u.key) unit,scp.state,scp.progress_method,scp.progress_value,scp.occurred_at
      from public.student_curriculum_progress scp
      join public.curriculum_units u on u.tenant_id=scp.tenant_id and u.id=scp.curriculum_unit_id
      join public.curriculum_version_items item on item.tenant_id=u.tenant_id and item.id=u.curriculum_item_id
      left join public.subjects sub on sub.tenant_id=item.tenant_id and sub.id=item.subject_id
      join public.curriculum_teaching_assignments ta on ta.tenant_id=scp.tenant_id and ta.id=scp.teaching_assignment_id
      join lateral(
        select e.* from public.enrollments e
        where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=scp.student_person_id
          and e.session_id=ta.session_id and e.program_id=ta.program_id and e.status<>'cancelled'
          and e.starts_on<=scp.occurred_at::date and (e.ends_on is null or e.ends_on>=scp.occurred_at::date)
          and (ta.group_id is null or e.group_id=ta.group_id)
        order by e.starts_on desc,e.id desc limit 1
      ) e on true
      join public.student_profiles sp on sp.tenant_id=scp.tenant_id and sp.person_id=scp.student_person_id
      join public.persons p on p.tenant_id=scp.tenant_id and p.id=scp.student_person_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=ta.program_id and (pr.branch_id is null or pr.branch_id=p_branch_id)
      left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=e.group_id and g.branch_id=p_branch_id
      where scp.tenant_id=p_tenant_id and scp.occurred_at::date between v_date_from and v_date_to
        and ta.starts_on<=scp.occurred_at::date and (ta.ends_on is null or ta.ends_on>=scp.occurred_at::date)
        and ((ta.student_person_id is not null and ta.student_person_id=scp.student_person_id) or (ta.group_id is not null and e.group_id=ta.group_id))
        and ta.source_branch_id=p_branch_id
        and scp.source_branch_id=p_branch_id and scp.source_branch_id=ta.source_branch_id
        and (v_session_id is null or ta.session_id=v_session_id)
        and (v_program_id is null or ta.program_id=v_program_id)
        and (v_group_id is null or e.group_id=v_group_id)
        and (v_student_id is null or scp.student_person_id=v_student_id)
    ) x;

  elsif p_report_key='exam_performance' then
    v_columns:='["exam","subject","student_number","student_name","program","class_group","marks","maximum_marks","percentage","status"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.exam,x.student_name,x.subject),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select coalesce(ex.labels->>'en',ex.key) exam,coalesce(sub.labels->>'en',sub.key) subject,sp.student_number,p.display_name student_name,
        coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,me.raw_marks marks,es.maximum_marks,
        case when me.raw_marks is null or es.maximum_marks=0 then null else round((me.raw_marks/es.maximum_marks)*100,1) end percentage,me.entry_status status
      from public.mark_entries me join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id
      join public.exam_subjects es on es.tenant_id=ms.tenant_id and es.id=ms.exam_subject_id
      join public.exam_series ex on ex.tenant_id=es.tenant_id and ex.id=es.exam_series_id and ex.branch_id=p_branch_id
      join public.subjects sub on sub.tenant_id=es.tenant_id and sub.id=es.subject_id
      join public.student_profiles sp on sp.tenant_id=me.tenant_id and sp.person_id=me.student_person_id
      join public.persons p on p.tenant_id=me.tenant_id and p.id=me.student_person_id
      left join public.programs pr on pr.tenant_id=ex.tenant_id and pr.id=ex.program_id
      left join public.academic_groups g on g.tenant_id=ex.tenant_id and g.id=ex.group_id
      where me.tenant_id=p_tenant_id and ex.starts_on<=v_date_to and ex.ends_on>=v_date_from
        and (v_session_id is null or ex.session_id=v_session_id) and (v_program_id is null or ex.program_id=v_program_id) and (v_group_id is null or ex.group_id=v_group_id) and (v_student_id is null or me.student_person_id=v_student_id)
    ) x;

  elsif p_report_key='absence_trend' then
    v_columns:='["attendance_date","program","class_group","absent","recorded","absence_rate"]'::jsonb;
    with effective as(
      select distinct on(s.attendance_date,ar.person_id) s.attendance_date,ar.person_id,ar.enrollment_id,coalesce(ac.requested_status_key,ar.status_key) status
      from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id and s.branch_id=p_branch_id
      left join lateral(select c.requested_status_key from public.attendance_corrections c where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved' order by c.reviewed_at desc,c.id desc limit 1) ac on true
      where ar.tenant_id=p_tenant_id and s.attendance_date between v_date_from and v_date_to
      order by s.attendance_date,ar.person_id,ar.marked_at desc,ar.id desc
    ), scoped as(
      select a.*,e.program_id,e.group_id,pr.labels program_labels,pr.key program_key,g.labels group_labels,g.key group_key
      from effective a join public.enrollments e on e.tenant_id=p_tenant_id and e.id=a.enrollment_id and e.branch_id=p_branch_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=e.program_id left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=e.group_id
      where (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or a.person_id=v_student_id)
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date desc,x.program,x.class_group),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select attendance_date,coalesce(program_labels->>'en',program_key) program,coalesce(group_labels->>'en',group_key) class_group,
        count(*) filter(where status='absent')::int absent,count(*)::int recorded,
        round((count(*) filter(where status='absent')::numeric/nullif(count(*),0))*100,1) absence_rate
      from scoped group by attendance_date,program_id,group_id,program_labels,program_key,group_labels,group_key
    ) x;

  elsif p_report_key='late_trend' then
    v_columns:='["attendance_date","program","class_group","late","recorded","late_rate"]'::jsonb;
    with effective as(
      select distinct on(s.attendance_date,ar.person_id) s.attendance_date,ar.person_id,ar.enrollment_id,coalesce(ac.requested_status_key,ar.status_key) status
      from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id and s.branch_id=p_branch_id
      left join lateral(select c.requested_status_key from public.attendance_corrections c where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved' order by c.reviewed_at desc,c.id desc limit 1) ac on true
      where ar.tenant_id=p_tenant_id and s.attendance_date between v_date_from and v_date_to
      order by s.attendance_date,ar.person_id,ar.marked_at desc,ar.id desc
    ), scoped as(
      select a.*,e.program_id,e.group_id,pr.labels program_labels,pr.key program_key,g.labels group_labels,g.key group_key
      from effective a join public.enrollments e on e.tenant_id=p_tenant_id and e.id=a.enrollment_id and e.branch_id=p_branch_id
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=e.program_id left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=e.group_id
      where (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or a.person_id=v_student_id)
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.attendance_date desc,x.program,x.class_group),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select attendance_date,coalesce(program_labels->>'en',program_key) program,coalesce(group_labels->>'en',group_key) class_group,
        count(*) filter(where status='late')::int late,count(*)::int recorded,
        round((count(*) filter(where status='late')::numeric/nullif(count(*),0))*100,1) late_rate
      from scoped group by attendance_date,program_id,group_id,program_labels,program_key,group_labels,group_key
    ) x;

  elsif p_report_key='new_admissions' then
    v_columns:='["joined_on","student_number","admission_number","student_name","program","class_group","status"]'::jsonb;
    select coalesce(jsonb_agg(row_to_json(x) order by x.joined_on desc,x.student_name),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select sp.joined_on,sp.student_number,sp.admission_number,p.display_name student_name,coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,sp.status
      from public.student_profiles sp join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
      left join lateral(select e.* from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=sp.person_id and e.status<>'cancelled' order by e.starts_on desc nulls last,e.id desc limit 1) e on true
      left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=e.program_id left join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=e.group_id
      where sp.tenant_id=p_tenant_id and sp.joined_on between v_date_from and v_date_to and e.id is not null
        and (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or sp.person_id=v_student_id)
    ) x;

  elsif p_report_key='group_program_comparison' then
    v_columns:='["program","class_group","students","attendance_records","present","absent","late","attendance_rate","progress_events","exam_average"]'::jsonb;
    with current_students as(
      select distinct on(e.student_person_id) e.student_person_id,e.session_id,e.program_id,e.group_id
      from public.enrollments e
      where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status<>'cancelled' and coalesce(e.starts_on,v_date_to)<=v_date_to and (e.ends_on is null or e.ends_on>=v_date_to)
        and (v_session_id is null or e.session_id=v_session_id) and (v_program_id is null or e.program_id=v_program_id) and (v_group_id is null or e.group_id=v_group_id) and (v_student_id is null or e.student_person_id=v_student_id)
      order by e.student_person_id,(e.status='active') desc,e.starts_on desc nulls last,e.id desc
    ), strength as(
      select program_id,group_id,count(*)::int students from current_students group by program_id,group_id
    ), att_effective as(
      select distinct on(s.attendance_date,ar.person_id) s.attendance_date,ar.person_id,ar.enrollment_id,coalesce(ac.requested_status_key,ar.status_key) status
      from public.attendance_records ar join public.attendance_sessions s on s.tenant_id=ar.tenant_id and s.id=ar.attendance_session_id and s.branch_id=p_branch_id
      left join lateral(select c.requested_status_key from public.attendance_corrections c where c.tenant_id=p_tenant_id and c.attendance_record_id=ar.id and c.state='approved' order by c.reviewed_at desc,c.id desc limit 1) ac on true
      where ar.tenant_id=p_tenant_id and s.attendance_date between v_date_from and v_date_to order by s.attendance_date,ar.person_id,ar.marked_at desc,ar.id desc
    ), att as(
      select cs.program_id,cs.group_id,count(a.person_id)::int attendance_records,count(*) filter(where a.status='present')::int present,count(*) filter(where a.status='absent')::int absent,count(*) filter(where a.status='late')::int late
      from current_students cs left join att_effective a on a.person_id=cs.student_person_id and exists(select 1 from public.enrollments ae where ae.tenant_id=p_tenant_id and ae.id=a.enrollment_id and ae.session_id=cs.session_id and ae.program_id=cs.program_id and ae.group_id is not distinct from cs.group_id) group by cs.program_id,cs.group_id
    ), prog as(
      select cs.program_id,cs.group_id,coalesce(sum(px.progress_events),0)::int progress_events
      from current_students cs
      left join lateral(
        select count(*)::int progress_events
        from public.student_curriculum_progress scp
        join public.curriculum_teaching_assignments ta on ta.tenant_id=scp.tenant_id and ta.id=scp.teaching_assignment_id
        join lateral(
          select e.* from public.enrollments e
          where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=scp.student_person_id
            and e.session_id=ta.session_id and e.program_id=ta.program_id and e.status<>'cancelled'
            and e.starts_on<=scp.occurred_at::date and (e.ends_on is null or e.ends_on>=scp.occurred_at::date)
            and (ta.group_id is null or e.group_id=ta.group_id)
          order by e.starts_on desc,e.id desc limit 1
        ) pe on true
        where scp.tenant_id=p_tenant_id and scp.student_person_id=cs.student_person_id and scp.occurred_at::date between v_date_from and v_date_to
          and ta.session_id=cs.session_id and ta.program_id=cs.program_id and pe.group_id is not distinct from cs.group_id
          and ta.starts_on<=scp.occurred_at::date and (ta.ends_on is null or ta.ends_on>=scp.occurred_at::date)
          and ((ta.student_person_id is not null and ta.student_person_id=scp.student_person_id) or (ta.group_id is not null and pe.group_id=ta.group_id))
          and ta.source_branch_id=p_branch_id
          and scp.source_branch_id=p_branch_id and scp.source_branch_id=ta.source_branch_id
      ) px on true
      group by cs.program_id,cs.group_id
    ), exams as(
      select cs.program_id,cs.group_id,round(avg(case when ex.id is null or me.entry_status<>'present' or me.raw_marks is null or es.maximum_marks=0 then null else (me.raw_marks/es.maximum_marks)*100 end),1) exam_average
      from current_students cs left join public.mark_entries me on me.tenant_id=p_tenant_id and me.student_person_id=cs.student_person_id
      left join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id left join public.exam_subjects es on es.tenant_id=ms.tenant_id and es.id=ms.exam_subject_id
      left join public.exam_series ex on ex.tenant_id=es.tenant_id and ex.id=es.exam_series_id and ex.branch_id=p_branch_id and ex.session_id=cs.session_id and ex.program_id=cs.program_id and (ex.group_id is null or ex.group_id is not distinct from cs.group_id) and ex.starts_on<=v_date_to and ex.ends_on>=v_date_from
      group by cs.program_id,cs.group_id
    )
    select coalesce(jsonb_agg(row_to_json(x) order by x.program,x.class_group),'[]'::jsonb),count(*) into v_rows,v_count
    from(
      select coalesce(pr.labels->>'en',pr.key) program,coalesce(g.labels->>'en',g.key) class_group,s.students,a.attendance_records,a.present,a.absent,a.late,
        case when a.attendance_records=0 then null else round(((a.present+a.late)::numeric/a.attendance_records)*100,1) end attendance_rate,pg.progress_events,ex.exam_average
      from strength s join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=s.program_id join public.academic_groups g on g.tenant_id=p_tenant_id and g.id=s.group_id
      left join att a on a.program_id=s.program_id and a.group_id=s.group_id left join prog pg on pg.program_id=s.program_id and pg.group_id=s.group_id left join exams ex on ex.program_id=s.program_id and ex.group_id=s.group_id
    ) x;
  else
    raise exception 'unsupported operational report';
  end if;

  select rr.id into v_existing from public.report_runs rr where rr.tenant_id=p_tenant_id and rr.idempotency_key=p_request_key limit 1;
  if v_existing is null then
    insert into public.report_runs(tenant_id,report_definition_id,parameters,scope_snapshot,output_format,state,row_count,output_digest,requested_by_membership_id,idempotency_key,completed_at)
    values(p_tenant_id,v_definition.id,p_parameters,jsonb_build_object('branch_id',p_branch_id),p_output_format,'completed',v_count,md5(v_rows::text),v_membership,p_request_key,clock_timestamp()) returning id into v_run_id;
  else v_run_id:=v_existing; end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'report.run.execute','succeeded','report_run',v_run_id::text,gen_random_uuid(),jsonb_build_object('report_key',p_report_key,'output_format',p_output_format,'row_count',v_count));

  return jsonb_build_object('run_id',v_run_id,'report_key',p_report_key,'labels',v_definition.labels,'columns',v_columns,'rows',v_rows,'row_count',v_count,'parameters',p_parameters,'output_format',p_output_format);
end;
$fn$;

revoke all on function public.run_operational_report_v1(uuid,bigint,bigint,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.run_operational_report_v1(uuid,bigint,bigint,text,jsonb,text,text) to service_role;

commit;
