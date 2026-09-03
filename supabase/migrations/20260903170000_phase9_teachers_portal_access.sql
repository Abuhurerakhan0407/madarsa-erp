create or replace function public.get_teachers_workspace_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_search text default null,
  p_state text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_can_manage boolean;
begin
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.read') then
    raise exception 'teacher read permission denied';
  end if;
  v_can_manage:=public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'hr.employee.manage');

  return jsonb_build_object(
    'can_manage',v_can_manage,
    'teachers',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.display_name,x.person_id)
      from (
        select
          he.id employment_id,
          he.employee_person_id person_id,
          he.employee_number teacher_id,
          p.display_name,
          p.name_native,
          p.photo_storage_path,
          coalesce(ep.designation,replace(he.designation_key,'_',' ')) designation,
          he.designation_key,
          he.starts_on joined_on,
          he.state,
          email.value email,
          phone.value phone,
          case when account.identity_id is null then case when email.value is null then 'email_required' else 'not_created' end
               when account.link_status='verified' then 'active' else 'disabled' end account_status,
          account.last_sign_in_at last_login,
          coalesce(account.erp_managed,false) erp_managed,
          coalesce(att.total,0) attendance_total_30d,
          coalesce(att.present,0) attendance_present_30d,
          coalesce(att.absent,0) attendance_absent_30d,
          coalesce(att.late,0) attendance_late_30d,
          coalesce(programs.items,'[]'::jsonb) assigned_programs,
          coalesce(subjects.items,'[]'::jsonb) assigned_subjects,
          coalesce(groups.items,'[]'::jsonb) assigned_groups,
          coalesce(schedule.items,'[]'::jsonb) timetable
        from public.hr_employments he
        join public.persons p on p.tenant_id=he.tenant_id and p.id=he.employee_person_id
        left join public.employee_profiles ep on ep.tenant_id=he.tenant_id and ep.person_id=he.employee_person_id
        left join lateral (
          select pc.value from public.person_contacts pc
          where pc.tenant_id=he.tenant_id and pc.person_id=he.employee_person_id and pc.type='email'
          order by pc.is_primary desc,pc.is_verified desc,pc.id limit 1
        ) email on true
        left join lateral (
          select pc.value from public.person_contacts pc
          where pc.tenant_id=he.tenant_id and pc.person_id=he.employee_person_id and pc.type='phone'
          order by pc.is_primary desc,pc.is_verified desc,pc.id limit 1
        ) phone on true
        left join lateral (
          select l.identity_id,l.status link_status,u.last_sign_in_at,
                 coalesce((u.raw_user_meta_data->>'portal_account')::boolean,false) erp_managed
          from public.identity_person_links l
          join auth.users u on u.id=l.identity_id
          where l.tenant_id=he.tenant_id and l.person_id=he.employee_person_id and l.link_type='employee'
          order by (l.status='verified') desc,l.updated_at desc,l.id desc limit 1
        ) account on true
        left join lateral (
          select count(*)::int total,
                 count(*) filter(where a.status='present')::int present,
                 count(*) filter(where a.status='absent')::int absent,
                 count(*) filter(where a.status='late')::int late
          from public.hr_attendance_records a
          where a.tenant_id=he.tenant_id and a.employment_id=he.id and a.attendance_date>=current_date-30
        ) att on true
        left join lateral (
          select jsonb_agg(jsonb_build_object('id',q.id,'labels',q.labels) order by q.id) items
          from (
            select distinct pr.id,pr.labels
            from public.programs pr
            join public.academic_groups g on g.tenant_id=pr.tenant_id and g.program_id=pr.id
            where pr.tenant_id=he.tenant_id and g.branch_id=he.branch_id and g.status='active' and g.primary_teacher_person_id=he.employee_person_id
            union
            select distinct pr.id,pr.labels
            from public.curriculum_teaching_assignments c
            join public.programs pr on pr.tenant_id=c.tenant_id and pr.id=c.program_id
            where c.tenant_id=he.tenant_id and c.teacher_person_id=he.employee_person_id and c.status='active'
          ) q
        ) programs on true
        left join lateral (
          select jsonb_agg(jsonb_build_object('id',q.id,'labels',q.labels) order by q.id) items
          from (
            select distinct s.id,s.labels
            from public.curriculum_teaching_assignments c
            join public.curriculum_version_items i on i.tenant_id=c.tenant_id and i.id=c.curriculum_item_id
            join public.subjects s on s.tenant_id=i.tenant_id and s.id=i.subject_id
            where c.tenant_id=he.tenant_id and c.teacher_person_id=he.employee_person_id and c.status='active'
            union
            select distinct s.id,s.labels
            from public.timetable_entries te
            join public.subjects s on s.tenant_id=te.tenant_id and s.id=te.subject_id
            where te.tenant_id=he.tenant_id and te.branch_id=he.branch_id and te.teacher_person_id=he.employee_person_id and te.status='active'
          ) q
        ) subjects on true
        left join lateral (
          select jsonb_agg(jsonb_build_object('id',q.id,'labels',q.labels) order by q.id) items
          from (
            select distinct g.id,g.labels from public.academic_groups g
            where g.tenant_id=he.tenant_id and g.branch_id=he.branch_id and g.status='active' and g.primary_teacher_person_id=he.employee_person_id
            union
            select distinct g.id,g.labels from public.curriculum_teaching_assignments c
            join public.academic_groups g on g.tenant_id=c.tenant_id and g.id=c.group_id
            where c.tenant_id=he.tenant_id and c.teacher_person_id=he.employee_person_id and c.status='active' and c.group_id is not null
            union
            select distinct g.id,g.labels from public.timetable_entries te
            join public.academic_groups g on g.tenant_id=te.tenant_id and g.id=te.group_id
            where te.tenant_id=he.tenant_id and te.branch_id=he.branch_id and te.teacher_person_id=he.employee_person_id and te.status='active'
          ) q
        ) groups on true
        left join lateral (
          select jsonb_agg(jsonb_build_object(
            'weekday',te.weekday,'starts_at',ts.starts_at,'ends_at',ts.ends_at,
            'group_id',g.id,'group_labels',g.labels,'subject_id',s.id,'subject_labels',s.labels,'room',te.room_key
          ) order by te.weekday,ts.sequence,te.id) items
          from public.timetable_entries te
          join public.timetable_slots ts on ts.tenant_id=te.tenant_id and ts.id=te.slot_id
          join public.academic_groups g on g.tenant_id=te.tenant_id and g.id=te.group_id
          join public.subjects s on s.tenant_id=te.tenant_id and s.id=te.subject_id
          where te.tenant_id=he.tenant_id and te.branch_id=he.branch_id and te.teacher_person_id=he.employee_person_id and te.status='active'
        ) schedule on true
        where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id
          and he.state in('active','on_leave','suspended')
          and (p_state is null or btrim(p_state)='' or he.state=p_state)
          and (p_search is null or btrim(p_search)='' or p.display_name ilike '%'||btrim(p_search)||'%' or he.employee_number ilike '%'||btrim(p_search)||'%')
      ) x
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_portal_access_center_v2(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_membership bigint;
begin
  v_membership:=public.resolve_portal_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'portal administration permission denied';end if;

  return jsonb_build_object(
    'parents',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.person_id) from (
      select distinct gp.person_id,p.display_name name,
        email.value email,
        case when a.identity_id is null then case when email.value is null then 'email_required' else 'not_created' end when a.link_status='verified' then 'active' else 'disabled' end account_status,
        a.last_sign_in_at last_login,coalesce(a.erp_managed,false) erp_managed,
        coalesce(children.items,'[]'::jsonb) linked_scope,
        codes.last_code_at
      from public.guardian_profiles gp
      join public.persons p on p.tenant_id=gp.tenant_id and p.id=gp.person_id and p.status='active'
      join public.person_relationships pr on pr.tenant_id=gp.tenant_id and pr.source_person_id=gp.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
      join public.enrollments e on e.tenant_id=pr.tenant_id and e.student_person_id=pr.target_person_id and e.branch_id=p_branch_id and e.status in('active','paused')
      left join lateral (select pc.value from public.person_contacts pc where pc.tenant_id=gp.tenant_id and pc.person_id=gp.person_id and pc.type='email' order by pc.is_primary desc,pc.is_verified desc,pc.id limit 1) email on true
      left join lateral (
        select l.identity_id,l.status link_status,u.last_sign_in_at,coalesce((u.raw_user_meta_data->>'portal_account')::boolean,false) erp_managed
        from public.identity_person_links l join auth.users u on u.id=l.identity_id
        where l.tenant_id=gp.tenant_id and l.person_id=gp.person_id and l.link_type='guardian'
        order by (l.status='verified') desc,l.updated_at desc,l.id desc limit 1
      ) a on true
      left join lateral (
        select jsonb_agg(jsonb_build_object('student_person_id',q.person_id,'student_number',q.student_number,'name',q.name,'group_id',q.group_id,'group_labels',q.group_labels) order by q.name) items
        from (
          select distinct sp.person_id,sp.student_number,cp.display_name name,g.id group_id,g.labels group_labels
          from public.person_relationships pr2
          join public.student_profiles sp on sp.tenant_id=pr2.tenant_id and sp.person_id=pr2.target_person_id and sp.status in('active','admitted')
          join public.persons cp on cp.tenant_id=sp.tenant_id and cp.id=sp.person_id
          join public.enrollments e2 on e2.tenant_id=sp.tenant_id and e2.student_person_id=sp.person_id and e2.branch_id=p_branch_id and e2.status in('active','paused')
          left join public.academic_groups g on g.tenant_id=e2.tenant_id and g.id=e2.group_id
          where pr2.tenant_id=gp.tenant_id and pr2.source_person_id=gp.person_id and pr2.status='verified' and pr2.portal_visibility in('limited','standard')
        ) q
      ) children on true
      left join lateral (select max(c.created_at) last_code_at from public.portal_access_codes c where c.tenant_id=gp.tenant_id and c.person_id=gp.person_id and c.link_type='guardian') codes on true
      where gp.tenant_id=p_tenant_id
    ) x),'[]'::jsonb),
    'teachers',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.person_id) from (
      select he.employee_person_id person_id,p.display_name name,he.employee_number reference,
        email.value email,
        case when a.identity_id is null then case when email.value is null then 'email_required' else 'not_created' end when a.link_status='verified' then 'active' else 'disabled' end account_status,
        a.last_sign_in_at last_login,coalesce(a.erp_managed,false) erp_managed,
        coalesce(scope.items,'[]'::jsonb) linked_scope,codes.last_code_at
      from public.hr_employments he
      join public.persons p on p.tenant_id=he.tenant_id and p.id=he.employee_person_id and p.status='active'
      left join lateral (select pc.value from public.person_contacts pc where pc.tenant_id=he.tenant_id and pc.person_id=he.employee_person_id and pc.type='email' order by pc.is_primary desc,pc.is_verified desc,pc.id limit 1) email on true
      left join lateral (
        select l.identity_id,l.status link_status,u.last_sign_in_at,coalesce((u.raw_user_meta_data->>'portal_account')::boolean,false) erp_managed
        from public.identity_person_links l join auth.users u on u.id=l.identity_id
        where l.tenant_id=he.tenant_id and l.person_id=he.employee_person_id and l.link_type='employee'
        order by (l.status='verified') desc,l.updated_at desc,l.id desc limit 1
      ) a on true
      left join lateral (
        select jsonb_agg(jsonb_build_object('group_id',q.id,'group_labels',q.labels) order by q.id) items from (
          select distinct g.id,g.labels from public.academic_groups g where g.tenant_id=he.tenant_id and g.branch_id=he.branch_id and g.status='active' and g.primary_teacher_person_id=he.employee_person_id
          union
          select distinct g.id,g.labels from public.curriculum_teaching_assignments c join public.academic_groups g on g.tenant_id=c.tenant_id and g.id=c.group_id where c.tenant_id=he.tenant_id and c.teacher_person_id=he.employee_person_id and c.status='active' and c.group_id is not null
          union
          select distinct g.id,g.labels from public.timetable_entries te join public.academic_groups g on g.tenant_id=te.tenant_id and g.id=te.group_id where te.tenant_id=he.tenant_id and te.branch_id=he.branch_id and te.teacher_person_id=he.employee_person_id and te.status='active'
        ) q
      ) scope on true
      left join lateral (select max(c.created_at) last_code_at from public.portal_access_codes c where c.tenant_id=he.tenant_id and c.person_id=he.employee_person_id and c.link_type='employee') codes on true
      where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.state in('active','on_leave')
    ) x),'[]'::jsonb),
    'access_codes',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc) from (
      select c.id,c.person_id,c.link_type,c.state,c.expires_at,c.claimed_at,c.created_at,p.display_name name
      from public.portal_access_codes c join public.persons p on p.tenant_id=c.tenant_id and p.id=c.person_id
      where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id order by c.created_at desc,c.id desc limit 50
    ) x),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc) from (
      select n.id,n.audience_type,n.labels,n.body,n.priority,n.state,n.published_at,n.expires_at,n.created_at
      from public.portal_notices n where n.tenant_id=p_tenant_id and (n.branch_id is null or n.branch_id=p_branch_id)
      order by n.created_at desc,n.id desc limit 30
    ) x),'[]'::jsonb)
  );
end;
$$;

create or replace function public.link_portal_identity_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_person_id bigint,
  p_link_type text,
  p_portal_identity_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_membership bigint;
  v_link_type text:=lower(btrim(coalesce(p_link_type,'')));
begin
  v_membership:=public.resolve_portal_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'portal administration permission denied';end if;
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'portal.credentials.create') then raise exception 'portal credential permission denied';end if;
  if v_link_type not in('guardian','employee') then raise exception 'portal link type must be guardian or employee';end if;
  if not exists(select 1 from auth.users u where u.id=p_portal_identity_id) then raise exception 'portal identity not found';end if;

  if v_link_type='guardian' then
    if not exists(
      select 1 from public.guardian_profiles gp
      join public.person_relationships pr on pr.tenant_id=gp.tenant_id and pr.source_person_id=gp.person_id and pr.status='verified' and pr.portal_visibility in('limited','standard')
      join public.enrollments e on e.tenant_id=pr.tenant_id and e.student_person_id=pr.target_person_id and e.branch_id=p_branch_id and e.status in('active','paused')
      where gp.tenant_id=p_tenant_id and gp.person_id=p_person_id
    ) then raise exception 'guardian is not portal-eligible in this branch';end if;
  else
    if not exists(select 1 from public.hr_employments he where he.tenant_id=p_tenant_id and he.branch_id=p_branch_id and he.employee_person_id=p_person_id and he.state in('active','on_leave')) then raise exception 'employee is not portal-eligible in this branch';end if;
  end if;

  if exists(select 1 from public.identity_person_links l where l.tenant_id=p_tenant_id and l.identity_id=p_portal_identity_id and l.status='verified' and l.person_id<>p_person_id) then
    raise exception 'identity is already linked to another person in this institution';
  end if;

  insert into public.identity_person_links(tenant_id,identity_id,person_id,link_type,status,verified_at,verified_by_membership_id)
  values(p_tenant_id,p_portal_identity_id,p_person_id,v_link_type,'verified',now(),v_membership)
  on conflict(tenant_id,identity_id,person_id,link_type) do update set status='verified',verified_at=excluded.verified_at,verified_by_membership_id=excluded.verified_by_membership_id,updated_at=now();

  update public.portal_access_codes set state='revoked',updated_at=now()
  where tenant_id=p_tenant_id and person_id=p_person_id and link_type=v_link_type and state='issued';
  if v_link_type='guardian' then update public.guardian_profiles set portal_invitation_status='active',updated_at=now() where tenant_id=p_tenant_id and person_id=p_person_id;end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'portal.identity.link','succeeded','person',p_person_id::text,gen_random_uuid(),jsonb_build_object('link_type',v_link_type,'portal_identity_id',p_portal_identity_id));
  return jsonb_build_object('person_id',p_person_id,'link_type',v_link_type,'state','verified');
end;
$$;

create or replace function public.set_portal_identity_access_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_person_id bigint,
  p_link_type text,
  p_enabled boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','extensions'
as $$
declare
  v_membership bigint;
  v_link_type text:=lower(btrim(coalesce(p_link_type,'')));
  v_portal_identity uuid;
begin
  v_membership:=public.resolve_portal_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'portal administration permission denied';end if;
  if not public.operator_has_permission_v1(p_identity_id,p_tenant_id,p_branch_id,'portal.credentials.create') then raise exception 'portal credential permission denied';end if;
  if v_link_type not in('guardian','employee') then raise exception 'portal link type must be guardian or employee';end if;

  select l.identity_id into v_portal_identity from public.identity_person_links l
  where l.tenant_id=p_tenant_id and l.person_id=p_person_id and l.link_type=v_link_type
  order by (l.status='verified') desc,l.updated_at desc,l.id desc limit 1;
  if v_portal_identity is null then raise exception 'portal identity link not found';end if;

  if p_enabled and exists(select 1 from public.identity_person_links l where l.tenant_id=p_tenant_id and l.identity_id=v_portal_identity and l.status='verified' and l.person_id<>p_person_id) then
    raise exception 'identity is already linked to another person in this institution';
  end if;

  update public.identity_person_links
  set status=case when p_enabled then 'verified' else 'revoked' end,
      verified_at=case when p_enabled then now() else verified_at end,
      verified_by_membership_id=case when p_enabled then v_membership else verified_by_membership_id end,
      updated_at=now()
  where tenant_id=p_tenant_id and person_id=p_person_id and link_type=v_link_type and identity_id=v_portal_identity;

  if v_link_type='guardian' then
    update public.guardian_profiles set portal_invitation_status=case when p_enabled then 'active' else 'revoked' end,updated_at=now()
    where tenant_id=p_tenant_id and person_id=p_person_id;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,case when p_enabled then 'portal.identity.enable' else 'portal.identity.disable' end,'succeeded','person',p_person_id::text,gen_random_uuid(),jsonb_build_object('link_type',v_link_type,'enabled',p_enabled));
  return jsonb_build_object('person_id',p_person_id,'link_type',v_link_type,'enabled',p_enabled);
end;
$$;

revoke all on function public.get_teachers_workspace_v1(uuid,bigint,bigint,text,text) from public,anon,authenticated;
revoke all on function public.get_portal_access_center_v2(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.link_portal_identity_v1(uuid,bigint,bigint,bigint,text,uuid) from public,anon,authenticated;
revoke all on function public.set_portal_identity_access_v1(uuid,bigint,bigint,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.get_teachers_workspace_v1(uuid,bigint,bigint,text,text) to service_role;
grant execute on function public.get_portal_access_center_v2(uuid,bigint,bigint) to service_role;
grant execute on function public.link_portal_identity_v1(uuid,bigint,bigint,bigint,text,uuid) to service_role;
grant execute on function public.set_portal_identity_access_v1(uuid,bigint,bigint,bigint,text,boolean) to service_role;
