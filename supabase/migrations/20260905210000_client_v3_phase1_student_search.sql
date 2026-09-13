create or replace function public.get_student_register_page(p_identity_id uuid, p_tenant_id bigint, p_branch_id bigint, p_query text default null::text, p_status text default null::text, p_page integer default 1, p_page_size integer default 25)
returns jsonb language plpgsql set search_path to '' as $function$
declare
  v_membership_id bigint;
  v_query text := nullif(btrim(coalesce(p_query,'')),'');
  v_status text := nullif(btrim(coalesce(p_status,'')),'');
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := least(greatest(coalesce(p_page_size,25),1),500);
  v_total bigint; v_active bigint; v_rows jsonb; v_can_guardian_phone boolean := false;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then raise exception 'identity, tenant, and branch are required'; end if;
  if v_query is not null and length(v_query)>100 then raise exception 'search query is too long'; end if;
  if v_status is not null and v_status<>'all' and v_status not in ('applicant','active','paused','transferred','completed','withdrawn','alumni','archived') then raise exception 'student status is invalid'; end if;
  select m.id into v_membership_id from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now()) and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='students.profile.read') order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'student register permission denied'; end if;
  select exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code='people.relationship.read') and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership_id and rp.permission_code='people.person.read') into v_can_guardian_phone;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch is required'; end if;
  with candidates as (
    select sp.person_id,sp.student_number,sp.admission_number,sp.status,sp.joined_on,sp.created_at,p.display_name,p.name_native
    from public.student_profiles sp join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
    where sp.tenant_id=p_tenant_id and exists(select 1 from public.enrollments eb where eb.tenant_id=p_tenant_id and eb.student_person_id=sp.person_id and eb.branch_id=p_branch_id and eb.status<>'cancelled') and (v_status is null or v_status='all' or sp.status=v_status) and (v_query is null or p.display_name ilike '%'||v_query||'%' or coalesce(p.name_native,'') ilike '%'||v_query||'%' or sp.student_number ilike '%'||v_query||'%' or coalesce(sp.admission_number,'') ilike '%'||v_query||'%' or (v_can_guardian_phone and exists(select 1 from public.person_relationships rel join public.person_contacts pc on pc.tenant_id=rel.tenant_id and pc.person_id=rel.source_person_id where rel.tenant_id=p_tenant_id and rel.target_person_id=sp.person_id and rel.status='verified' and pc.type='phone' and pc.visibility in ('staff','public') and (pc.value ilike '%'||v_query||'%' or coalesce(pc.normalized_value,'') ilike '%'||v_query||'%'))))
  ) select count(*) into v_total from candidates;
  select count(*) into v_active from public.student_profiles sp where sp.tenant_id=p_tenant_id and sp.status='active' and exists(select 1 from public.enrollments eb where eb.tenant_id=p_tenant_id and eb.student_person_id=sp.person_id and eb.branch_id=p_branch_id and eb.status='active');
  with candidates as (
    select sp.person_id,sp.student_number,sp.admission_number,sp.status,sp.joined_on,sp.created_at,p.display_name,p.name_native
    from public.student_profiles sp join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
    where sp.tenant_id=p_tenant_id and exists(select 1 from public.enrollments eb where eb.tenant_id=p_tenant_id and eb.student_person_id=sp.person_id and eb.branch_id=p_branch_id and eb.status<>'cancelled') and (v_status is null or v_status='all' or sp.status=v_status) and (v_query is null or p.display_name ilike '%'||v_query||'%' or coalesce(p.name_native,'') ilike '%'||v_query||'%' or sp.student_number ilike '%'||v_query||'%' or coalesce(sp.admission_number,'') ilike '%'||v_query||'%' or (v_can_guardian_phone and exists(select 1 from public.person_relationships rel join public.person_contacts pc on pc.tenant_id=rel.tenant_id and pc.person_id=rel.source_person_id where rel.tenant_id=p_tenant_id and rel.target_person_id=sp.person_id and rel.status='verified' and pc.type='phone' and pc.visibility in ('staff','public') and (pc.value ilike '%'||v_query||'%' or coalesce(pc.normalized_value,'') ilike '%'||v_query||'%')))) order by sp.created_at desc,sp.person_id desc limit v_page_size offset ((v_page-1)*v_page_size)
  ), enriched as (
    select c.*,e.program_id,e.group_id,pr.labels as program_labels,pr.key as program_key,ag.labels as group_labels,ag.key as group_key from candidates c
    left join lateral(select e.program_id,e.group_id from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=c.person_id and e.status<>'cancelled' order by (e.status='active') desc,e.created_at desc,e.id desc limit 1)e on true
    left join public.programs pr on pr.tenant_id=p_tenant_id and pr.id=e.program_id left join public.academic_groups ag on ag.tenant_id=p_tenant_id and ag.id=e.group_id
  ) select coalesce(jsonb_agg(jsonb_build_object('person_id',person_id,'student_number',student_number,'admission_number',admission_number,'name',display_name,'native_name',name_native,'status',status,'joined_on',joined_on,'program_key',program_key,'program_labels',program_labels,'group_key',group_key,'group_labels',group_labels) order by created_at desc,person_id desc),'[]'::jsonb) into v_rows from enriched;
  return jsonb_build_object('rows',v_rows,'total',v_total,'active',v_active,'page',v_page,'page_size',v_page_size,'pages',greatest(ceil(v_total::numeric/v_page_size)::integer,1));
end;$function$;
