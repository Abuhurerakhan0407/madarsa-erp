-- Direct student creation runtime for the authenticated SIS workspace.
-- The browser never writes people, guardians, profiles, enrollments, numbering, or audit rows directly.

create or replace function public.create_student_direct(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_display_name text,
  p_name_native text default null,
  p_date_of_birth date default null,
  p_gender text default null,
  p_preferred_locale text default 'en',
  p_session_id bigint default null,
  p_program_id bigint default null,
  p_group_id bigint default null,
  p_joined_on date default current_date,
  p_medical_summary text default null,
  p_accessibility_needs text default null,
  p_pickup_restrictions text default null,
  p_guardian jsonb default null,
  p_confirm_new_person boolean default false
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membership_id bigint; v_session_start date; v_session_end date; v_session_status text; v_program_branch_id bigint; v_program_status text; v_group_session_id bigint; v_group_program_id bigint; v_group_branch_id bigint; v_group_status text;
  v_display_name text := btrim(coalesce(p_display_name, '')); v_name_native text := nullif(btrim(coalesce(p_name_native, '')), ''); v_normalized_name text; v_joined_on date := coalesce(p_joined_on, current_date); v_candidate_count integer := 0; v_person_id bigint; v_student_number text; v_enrollment_id bigint; v_guardian_name text; v_guardian_relationship text; v_guardian_phone text; v_guardian_person_id bigint; v_correlation_id uuid := gen_random_uuid();
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null then raise exception 'identity, tenant, and branch are required'; end if;
  if length(v_display_name) not between 2 and 160 then raise exception 'student name must be between 2 and 160 characters'; end if;
  if p_preferred_locale not in ('en','ur','ar') then raise exception 'preferred language is invalid'; end if;
  if p_gender is not null and p_gender not in ('male','female','other','undisclosed') then raise exception 'gender is invalid'; end if;
  if p_date_of_birth is not null and p_date_of_birth > current_date then raise exception 'date of birth cannot be in the future'; end if;
  select m.id into v_membership_id from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now()) and (m.all_branches or exists(select 1 from public.membership_branch_scopes mbs where mbs.tenant_id=m.tenant_id and mbs.membership_id=m.id and mbs.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in ('people.person.manage','students.profile.update','academics.enrollment.manage') group by mr.membership_id having count(distinct rp.permission_code)=3) order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'student creation permission denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch is required'; end if;
  select s.starts_on,s.ends_on,s.status into v_session_start,v_session_end,v_session_status from public.academic_sessions s where s.tenant_id=p_tenant_id and s.id=p_session_id;
  if v_session_start is null or v_session_status<>'active' then raise exception 'active academic session is required'; end if;
  if v_joined_on<v_session_start or v_joined_on>v_session_end then raise exception 'joining date must fall within the academic session'; end if;
  select p.branch_id,p.status into v_program_branch_id,v_program_status from public.programs p where p.tenant_id=p_tenant_id and p.id=p_program_id;
  if v_program_status is null or v_program_status<>'active' or (v_program_branch_id is not null and v_program_branch_id<>p_branch_id) then raise exception 'active program is not valid for this branch'; end if;
  if p_group_id is not null then select g.session_id,g.program_id,g.branch_id,g.status into v_group_session_id,v_group_program_id,v_group_branch_id,v_group_status from public.academic_groups g where g.tenant_id=p_tenant_id and g.id=p_group_id; if v_group_status is null or v_group_status<>'active' or v_group_session_id<>p_session_id or v_group_program_id<>p_program_id or v_group_branch_id<>p_branch_id then raise exception 'selected class or group is not valid for this enrollment'; end if; end if;
  if not exists(select 1 from public.number_sequences ns where ns.tenant_id=p_tenant_id and ns.branch_id is not distinct from p_branch_id and ns.key='student_default' and ns.entity_type='student' and ns.status='published' and ns.effective_at is not null and ns.effective_at<=now()) then raise exception 'published student numbering is required'; end if;
  v_normalized_name:=lower(regexp_replace(v_display_name,'\s+',' ','g')); perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('student-create:'||p_tenant_id::text||':'||v_normalized_name,0));
  select count(*)::integer into v_candidate_count from public.persons p join public.student_profiles sp on sp.tenant_id=p.tenant_id and sp.person_id=p.id where p.tenant_id=p_tenant_id and p.status not in ('merged','archived') and sp.status not in ('archived') and lower(regexp_replace(btrim(p.display_name),'\s+',' ','g'))=v_normalized_name and (p_date_of_birth is null or p.date_of_birth is not distinct from p_date_of_birth);
  if v_candidate_count>0 and not coalesce(p_confirm_new_person,false) then return jsonb_build_object('created',false,'duplicate_review_required',true,'candidate_count',v_candidate_count); end if;
  insert into public.persons(tenant_id,display_name,name_native,date_of_birth,gender,preferred_locale,status,metadata) values(p_tenant_id,v_display_name,v_name_native,p_date_of_birth,p_gender,p_preferred_locale,'active',jsonb_build_object('created_via','student_workspace')) returning id into v_person_id;
  v_student_number:=private.reserve_formatted_number(p_tenant_id,'student_default',p_branch_id,p_session_id,v_joined_on);
  insert into public.student_profiles(person_id,tenant_id,student_number,joined_on,status,medical_summary,accessibility_needs,pickup_restrictions) values(v_person_id,p_tenant_id,v_student_number,v_joined_on,'active',nullif(btrim(coalesce(p_medical_summary,'')),''),nullif(btrim(coalesce(p_accessibility_needs,'')),''),nullif(btrim(coalesce(p_pickup_restrictions,'')),''));
  insert into public.enrollments(tenant_id,branch_id,student_person_id,session_id,program_id,group_id,starts_on,status) values(p_tenant_id,p_branch_id,v_person_id,p_session_id,p_program_id,p_group_id,v_joined_on,'active') returning id into v_enrollment_id;
  insert into public.enrollment_events(tenant_id,enrollment_id,event_type,to_state,actor_membership_id,correlation_id) values(p_tenant_id,v_enrollment_id,'created',jsonb_build_object('status','active','branch_id',p_branch_id,'session_id',p_session_id,'program_id',p_program_id,'group_id',p_group_id),v_membership_id,v_correlation_id);
  if p_guardian is not null then v_guardian_name:=btrim(coalesce(p_guardian->>'name','')); v_guardian_relationship:=coalesce(p_guardian->>'relationship','guardian'); v_guardian_phone:=nullif(btrim(coalesce(p_guardian->>'phone','')),''); if length(v_guardian_name) not between 2 and 160 then raise exception 'guardian name must be between 2 and 160 characters'; end if; if v_guardian_relationship not in ('father','mother','guardian') then raise exception 'guardian relationship is invalid'; end if; if v_guardian_phone is not null and length(v_guardian_phone)>80 then raise exception 'guardian phone is too long'; end if; insert into public.persons(tenant_id,display_name,preferred_locale,status,metadata) values(p_tenant_id,v_guardian_name,p_preferred_locale,'active',jsonb_build_object('created_via','student_workspace','relationship',v_guardian_relationship)) returning id into v_guardian_person_id; insert into public.guardian_profiles(person_id,tenant_id,preferred_contact_type,portal_invitation_status) values(v_guardian_person_id,p_tenant_id,case when v_guardian_phone is null then null else 'phone' end,'not_invited'); if v_guardian_phone is not null then insert into public.person_contacts(tenant_id,person_id,type,label,value,normalized_value,is_primary,visibility) values(p_tenant_id,v_guardian_person_id,'phone','Primary',v_guardian_phone,regexp_replace(v_guardian_phone,'[^0-9+]','','g'),true,'staff'); end if; insert into public.person_relationships(tenant_id,source_person_id,target_person_id,relationship_type,status,is_primary,can_collect_student,portal_visibility,verified_at,verified_by_membership_id) values(p_tenant_id,v_guardian_person_id,v_person_id,v_guardian_relationship,'verified',true,true,'standard',now(),v_membership_id); end if;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state,metadata) values(p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'students.profile.create','succeeded','student',v_person_id::text,v_correlation_id,jsonb_build_object('student_number',v_student_number,'enrollment_id',v_enrollment_id,'status','active'),jsonb_build_object('session_id',p_session_id,'program_id',p_program_id,'group_id',p_group_id,'guardian_created',v_guardian_person_id is not null));
  return jsonb_build_object('created',true,'duplicate_review_required',false,'person_id',v_person_id,'student_number',v_student_number,'enrollment_id',v_enrollment_id,'guardian_person_id',v_guardian_person_id);
end;
$$;
revoke all on function public.create_student_direct(uuid,bigint,bigint,text,text,date,text,text,bigint,bigint,bigint,date,text,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.create_student_direct(uuid,bigint,bigint,text,text,date,text,text,bigint,bigint,bigint,date,text,text,text,jsonb,boolean) to service_role;
