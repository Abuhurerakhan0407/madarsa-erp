begin;

alter table public.enrollments
  add column if not exists residence_type text not null default 'day';

alter table public.enrollments
  drop constraint if exists enrollments_residence_type_check;

alter table public.enrollments
  add constraint enrollments_residence_type_check
  check (residence_type in ('day','hostel'));

create index if not exists enrollments_hostel_residence_idx
  on public.enrollments (tenant_id, branch_id, status, residence_type, program_id, group_id)
  where status in ('active','paused');

create or replace function public.get_hostel_boys_center_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint
) returns jsonb
language plpgsql
stable
set search_path to pg_catalog,extensions
as $fn$
declare
  v_membership bigint;
  v_students jsonb := '[]'::jsonb;
  v_available jsonb := '[]'::jsonb;
begin
  if not exists (
    select 1 from public.branches b
    where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active'
  ) then
    raise exception 'active branch required';
  end if;

  v_membership := public.resolve_hostel_permission_v1(
    p_identity_id,p_tenant_id,p_branch_id,'hostel.resident.manage'
  );
  if v_membership is null then
    raise exception 'hostel resident permission denied';
  end if;

  select coalesce(jsonb_agg(row_to_json(x) order by x.program_label,x.group_label,x.display_name,x.person_id),'[]'::jsonb)
  into v_students
  from (
    select distinct on (e.student_person_id)
      e.student_person_id as person_id,
      e.id as enrollment_id,
      p.display_name,
      p.name_native,
      sp.student_number,
      e.session_id,
      e.program_id,
      coalesce(nullif(btrim(pr.labels->>'en'),''),pr.key) as program_label,
      coalesce(nullif(btrim(pr.labels->>'ur'),''),pr.key) as program_label_ur,
      e.group_id,
      coalesce(nullif(btrim(g.labels->>'en'),''),g.key) as group_label,
      coalesce(nullif(btrim(g.labels->>'ur'),''),g.key) as group_label_ur,
      e.residence_type,
      e.status
    from public.enrollments e
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    join public.programs pr on pr.tenant_id=e.tenant_id and pr.id=e.program_id
    left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
    where e.tenant_id=p_tenant_id
      and e.branch_id=p_branch_id
      and e.status in ('active','paused')
      and sp.status in ('active','admitted')
      and e.residence_type='hostel'
    order by e.student_person_id,e.starts_on desc,e.id desc
  ) x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.display_name,x.person_id),'[]'::jsonb)
  into v_available
  from (
    select distinct on (e.student_person_id)
      e.student_person_id as person_id,
      e.id as enrollment_id,
      p.display_name,
      p.name_native,
      sp.student_number,
      e.session_id,
      e.program_id,
      coalesce(nullif(btrim(pr.labels->>'en'),''),pr.key) as program_label,
      coalesce(nullif(btrim(pr.labels->>'ur'),''),pr.key) as program_label_ur,
      e.group_id,
      coalesce(nullif(btrim(g.labels->>'en'),''),g.key) as group_label,
      coalesce(nullif(btrim(g.labels->>'ur'),''),g.key) as group_label_ur,
      e.residence_type,
      e.status
    from public.enrollments e
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
    join public.programs pr on pr.tenant_id=e.tenant_id and pr.id=e.program_id
    left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
    where e.tenant_id=p_tenant_id
      and e.branch_id=p_branch_id
      and e.status in ('active','paused')
      and sp.status in ('active','admitted')
      and e.residence_type='day'
    order by e.student_person_id,e.starts_on desc,e.id desc
  ) x;

  return jsonb_build_object(
    'students',v_students,
    'available_students',v_available,
    'total',jsonb_array_length(v_students)
  );
end;
$fn$;

create or replace function public.set_student_residence_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint,
  p_residence_type text,
  p_reason text default null
) returns jsonb
language plpgsql
set search_path to pg_catalog,extensions
as $fn$
declare
  v_membership bigint;
  v_enrollment public.enrollments%rowtype;
  v_type text := lower(btrim(coalesce(p_residence_type,'')));
  v_reason text := nullif(left(btrim(coalesce(p_reason,'')),500),'');
begin
  if v_type not in ('day','hostel') then
    raise exception 'residence type must be day or hostel';
  end if;

  v_membership := public.resolve_hostel_permission_v1(
    p_identity_id,p_tenant_id,p_branch_id,'hostel.resident.manage'
  );
  if v_membership is null then
    raise exception 'hostel resident permission denied';
  end if;

  select e.* into v_enrollment
  from public.enrollments e
  where e.tenant_id=p_tenant_id
    and e.branch_id=p_branch_id
    and e.student_person_id=p_student_person_id
    and e.status in ('active','paused')
  order by e.starts_on desc,e.id desc
  limit 1
  for update;

  if v_enrollment.id is null then
    raise exception 'active student enrollment in this branch required';
  end if;

  update public.enrollments
  set residence_type=v_type,version=version+1,updated_at=now()
  where tenant_id=p_tenant_id and id=v_enrollment.id;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,
    action,outcome,entity_type,entity_id,correlation_id,after_state,metadata
  )
  values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership,
    'students.residence.update','succeeded','enrollment',v_enrollment.id::text,
    gen_random_uuid(),
    jsonb_build_object(
      'student_person_id',p_student_person_id,
      'enrollment_id',v_enrollment.id,
      'residence_type',v_type
    ),
    jsonb_build_object('reason',v_reason)
  );

  return jsonb_build_object(
    'student_person_id',p_student_person_id,
    'enrollment_id',v_enrollment.id,
    'residence_type',v_type
  );
end;
$fn$;

revoke all on function public.get_hostel_boys_center_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.set_student_residence_v1(uuid,bigint,bigint,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_hostel_boys_center_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.set_student_residence_v1(uuid,bigint,bigint,bigint,text,text) to service_role;

commit;
