begin;

create or replace function public.get_academics_timetable_students_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint
)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_membership_id bigint;
  v_rows jsonb:='[]'::jsonb;
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
  if v_membership_id is null then raise exception 'Academic student roster membership denied'; end if;
  if not exists(
    select 1 from public.membership_roles mr
    join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
    join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
    where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id
      and rp.permission_code in ('academics.structure.read','academics.homework.read')
  ) then raise exception 'Academic student roster read permission denied'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'person_id',e.student_person_id,'student_number',sp.student_number,'name',p.display_name,'name_native',p.name_native,
    'session_id',e.session_id,'program_id',e.program_id,'group_id',e.group_id,'group_labels',g.labels
  ) order by p.display_name,e.student_person_id,e.starts_on desc,e.id desc),'[]'::jsonb)
  into v_rows
  from public.enrollments e
  join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in ('active','admitted')
  join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id and p.status='active'
  left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active';

  return v_rows;
end;
$$;

revoke all on function public.get_academics_timetable_students_v1(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_academics_timetable_students_v1(uuid,bigint,bigint) to service_role;

commit;
