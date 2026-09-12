begin;

create index if not exists timetable_entries_teacher_effective_idx
  on public.timetable_entries(tenant_id,branch_id,teacher_person_id,status,effective_from,effective_to,group_id);
create index if not exists enrollments_group_active_roster_idx
  on public.enrollments(tenant_id,branch_id,group_id,status,student_person_id);

create or replace function public.get_teacher_student_roster_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_as_of_date date default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 40
) returns jsonb
language plpgsql
stable
set search_path to ''
as $fn$
declare
  v_membership_id bigint;
  v_teacher_person_id bigint;
  v_date date:=coalesce(p_as_of_date,public.institution_local_date(p_tenant_id));
  v_search text:=nullif(btrim(coalesce(p_search,'')),'');
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_page_size integer:=least(greatest(coalesce(p_page_size,40),1),100);
  v_total integer:=0;
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
  if v_membership_id is null then raise exception 'teacher roster membership denied'; end if;

  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then
    raise exception 'active branch required';
  end if;

  select l.person_id into v_teacher_person_id
  from public.identity_person_links l
  where l.tenant_id=p_tenant_id and l.identity_id=p_identity_id
    and l.link_type='employee' and l.status='verified'
  order by l.id asc limit 1;
  if v_teacher_person_id is null then raise exception 'verified teacher identity required'; end if;

  with teacher_groups as(
    select distinct e.group_id
    from public.timetable_entries e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and e.teacher_person_id=v_teacher_person_id and e.status='active'
      and e.effective_from<=v_date and (e.effective_to is null or e.effective_to>=v_date)
  ), roster as(
    select distinct e.student_person_id,e.group_id,sp.student_number,p.display_name,p.name_native,g.key group_key,g.labels group_labels
    from teacher_groups tg
    join public.enrollments e on e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and e.group_id=tg.group_id and e.status='active'
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
      and sp.status in('active','admitted')
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id and p.status='active'
    join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id and g.status='active'
    where v_search is null
      or p.display_name ilike '%'||v_search||'%'
      or coalesce(p.name_native,'') ilike '%'||v_search||'%'
      or sp.student_number ilike '%'||v_search||'%'
      or coalesce(g.labels->>'en',g.key) ilike '%'||v_search||'%'
  )
  select count(*)::integer into v_total from roster;

  with teacher_groups as(
    select distinct e.group_id
    from public.timetable_entries e
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and e.teacher_person_id=v_teacher_person_id and e.status='active'
      and e.effective_from<=v_date and (e.effective_to is null or e.effective_to>=v_date)
  ), roster as(
    select distinct e.student_person_id,e.group_id,sp.student_number,p.display_name,p.name_native,g.key group_key,g.labels group_labels
    from teacher_groups tg
    join public.enrollments e on e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and e.group_id=tg.group_id and e.status='active'
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
      and sp.status in('active','admitted')
    join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id and p.status='active'
    join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id and g.status='active'
    where v_search is null
      or p.display_name ilike '%'||v_search||'%'
      or coalesce(p.name_native,'') ilike '%'||v_search||'%'
      or sp.student_number ilike '%'||v_search||'%'
      or coalesce(g.labels->>'en',g.key) ilike '%'||v_search||'%'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'person_id',r.student_person_id,'student_number',r.student_number,'name',r.display_name,
    'name_native',r.name_native,'group_id',r.group_id,'group_key',r.group_key,'group_labels',r.group_labels
  ) order by r.display_name,r.student_person_id,r.group_id),'[]'::jsonb)
  into v_rows
  from(
    select * from roster
    order by display_name,student_person_id,group_id
    limit v_page_size offset (v_page-1)*v_page_size
  ) r;

  return jsonb_build_object('as_of_date',v_date,'page',v_page,'page_size',v_page_size,'total',v_total,'rows',v_rows);
end;
$fn$;

revoke all on function public.get_teacher_student_roster_v1(uuid,bigint,bigint,date,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_teacher_student_roster_v1(uuid,bigint,bigint,date,text,integer,integer) to service_role;

commit;
