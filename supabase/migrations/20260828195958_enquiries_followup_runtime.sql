-- Phase 5 enquiry/follow-up runtime. Browser roles keep read-only RLS access;
-- trusted same-origin routes invoke these SECURITY INVOKER functions as service_role.

create or replace function private.resolve_staff_membership(
  p_identity_id uuid, p_tenant_id bigint, p_branch_id bigint, p_permissions text[]
) returns bigint language sql stable security invoker set search_path='' as $$
  select m.id from public.memberships m
  where m.identity_id=p_identity_id and m.tenant_id=p_tenant_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and coalesce(array_length(p_permissions,1),0)>0
    and not exists (
      select 1 from unnest(p_permissions) required(permission) where not (
        exists(select 1 from public.membership_roles mr
          join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
          join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
          where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code=required.permission)
        or exists(select 1 from public.delegations d where d.tenant_id=m.tenant_id
          and d.recipient_membership_id=m.id and d.permission_code=required.permission
          and d.starts_at<=now() and d.ends_at>now() and d.revoked_at is null
          and (d.branch_id is null or d.branch_id=p_branch_id))
      )
    )
  order by m.created_at,m.id limit 1;
$$;
revoke all on function private.resolve_staff_membership(uuid,bigint,bigint,text[]) from public,anon,authenticated;
grant execute on function private.resolve_staff_membership(uuid,bigint,bigint,text[]) to service_role;

create or replace function public.create_admission_enquiry(
  p_identity_id uuid, p_tenant_id bigint, p_branch_id bigint,
  p_session_id bigint, p_program_id bigint, p_applicant_name text,
  p_guardian_name text, p_phone text, p_email text, p_preferred_locale text,
  p_source text, p_consent boolean, p_notes text, p_next_follow_up_at timestamptz
) returns jsonb language plpgsql set search_path='' as $$
declare
  v_actor bigint; v_id bigint; v_followup bigint; v_phone text; v_email text;
  v_duplicates integer; v_correlation uuid:=gen_random_uuid();
begin
  v_actor:=private.resolve_staff_membership(p_identity_id,p_tenant_id,p_branch_id,array['admissions.enquiry.manage']);
  if v_actor is null then raise exception 'enquiry permission denied'; end if;
  p_applicant_name:=btrim(coalesce(p_applicant_name,''));
  p_guardian_name:=nullif(btrim(coalesce(p_guardian_name,'')),'');
  v_phone:=nullif(regexp_replace(coalesce(p_phone,''),'[\s()-]','','g'),'');
  v_email:=nullif(lower(btrim(coalesce(p_email,''))),'');
  if length(p_applicant_name) not between 2 and 160 then raise exception 'invalid applicant name'; end if;
  if p_guardian_name is not null and length(p_guardian_name)>160 then raise exception 'invalid guardian name'; end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{6,15}$' then raise exception 'invalid enquiry phone'; end if;
  if v_email is not null and (length(v_email)>320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'invalid enquiry email'; end if;
  if v_phone is null and v_email is null then raise exception 'enquiry contact required'; end if;
  if p_preferred_locale not in ('en','ur','ar') or p_consent is distinct from true then raise exception 'invalid enquiry consent or locale'; end if;
  if p_source is not null and length(btrim(p_source)) not between 2 and 80 then raise exception 'invalid enquiry source'; end if;
  if p_notes is not null and length(btrim(p_notes))>2000 then raise exception 'invalid enquiry notes'; end if;
  if p_next_follow_up_at is null or p_next_follow_up_at<=now() or p_next_follow_up_at>now()+interval '366 days' then raise exception 'invalid follow-up date'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active')
    or not exists(select 1 from public.academic_sessions s where s.tenant_id=p_tenant_id and s.id=p_session_id and s.status='active')
    or not exists(select 1 from public.programs p where p.tenant_id=p_tenant_id and p.id=p_program_id and p.status='active' and (p.branch_id is null or p.branch_id=p_branch_id))
  then raise exception 'enquiry academic selection unavailable'; end if;
  select count(*) into v_duplicates from (
    select e.id::text from public.enquiries e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id
      and ((v_phone is not null and e.normalized_phone=v_phone) or (v_email is not null and e.normalized_email=v_email))
    union all
    select 'application:'||a.id::text from public.applications a where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id
      and ((v_phone is not null and regexp_replace(coalesce(a.applicant_data->>'guardian_phone',''),'[\s()-]','','g')=v_phone)
        or (v_email is not null and lower(btrim(coalesce(a.applicant_data->>'guardian_email','')))=v_email))
  ) possible;
  insert into public.enquiries(tenant_id,branch_id,session_id,program_id,applicant_name,guardian_name,
    normalized_phone,normalized_email,preferred_locale,source,consent,owner_membership_id,status,next_follow_up_at,notes)
  values(p_tenant_id,p_branch_id,p_session_id,p_program_id,p_applicant_name,p_guardian_name,v_phone,v_email,
    p_preferred_locale,nullif(btrim(coalesce(p_source,'')),''),jsonb_build_object('privacy',true,'recorded_at',now()),v_actor,'new',p_next_follow_up_at,nullif(btrim(coalesce(p_notes,'')),'')) returning id into v_id;
  insert into public.admission_followups(tenant_id,enquiry_id,owner_membership_id,due_at)
    values(p_tenant_id,v_id,v_actor,p_next_follow_up_at) returning id into v_followup;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state,metadata)
    values(p_tenant_id,p_branch_id,p_identity_id,v_actor,'admissions.enquiry.create','succeeded','enquiry',v_id::text,v_correlation,
      jsonb_build_object('status','new','followup_id',v_followup),jsonb_build_object('possible_duplicate_count',v_duplicates,'source',nullif(btrim(coalesce(p_source,'')),'')));
  return jsonb_build_object('id',v_id,'status','new','possible_duplicates',v_duplicates,'followup_id',v_followup);
end; $$;
revoke all on function public.create_admission_enquiry(uuid,bigint,bigint,bigint,bigint,text,text,text,text,text,text,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.create_admission_enquiry(uuid,bigint,bigint,bigint,bigint,text,text,text,text,text,text,boolean,text,timestamptz) to service_role;

create or replace function public.record_admission_followup(
  p_identity_id uuid,p_tenant_id bigint,p_enquiry_id bigint,p_channel text,p_outcome text,
  p_new_status text,p_next_follow_up_at timestamptz
) returns jsonb language plpgsql set search_path='' as $$
declare v_actor bigint; v_enquiry public.enquiries%rowtype; v_followup bigint; v_next bigint; v_from text; v_correlation uuid:=gen_random_uuid();
begin
  select * into v_enquiry from public.enquiries where tenant_id=p_tenant_id and id=p_enquiry_id for update;
  if v_enquiry.id is null then raise exception 'enquiry not found'; end if;
  v_actor:=private.resolve_staff_membership(p_identity_id,p_tenant_id,v_enquiry.branch_id,array['admissions.enquiry.manage']);
  if v_actor is null then raise exception 'enquiry permission denied'; end if;
  p_outcome:=btrim(coalesce(p_outcome,''));
  if p_channel not in ('phone','email','whatsapp','in_person') or length(p_outcome) not between 2 and 2000 then raise exception 'invalid follow-up result'; end if;
  if p_new_status not in ('contacted','qualified','lost','archived') then raise exception 'invalid enquiry status'; end if;
  if (v_enquiry.status='new' and p_new_status not in ('contacted','qualified','lost','archived'))
    or (v_enquiry.status='contacted' and p_new_status not in ('contacted','qualified','lost','archived'))
    or (v_enquiry.status='qualified' and p_new_status not in ('qualified','lost','archived'))
    or (v_enquiry.status='lost' and p_new_status not in ('contacted','archived'))
    or v_enquiry.status in ('application_started','converted','archived') then raise exception 'enquiry transition unavailable'; end if;
  if p_new_status in ('lost','archived') and p_next_follow_up_at is not null then raise exception 'closed enquiry cannot schedule follow-up'; end if;
  if p_next_follow_up_at is not null and (p_next_follow_up_at<=now() or p_next_follow_up_at>now()+interval '366 days') then raise exception 'invalid next follow-up date'; end if;
  select id into v_followup from public.admission_followups where tenant_id=p_tenant_id and enquiry_id=p_enquiry_id and completed_at is null order by due_at,id limit 1 for update;
  if v_followup is null then raise exception 'open enquiry follow-up required'; end if;
  update public.admission_followups set channel=p_channel,outcome=p_outcome,completed_at=now(),updated_at=now() where tenant_id=p_tenant_id and id=v_followup;
  if p_next_follow_up_at is not null and p_new_status not in ('lost','archived') then
    insert into public.admission_followups(tenant_id,enquiry_id,owner_membership_id,due_at) values(p_tenant_id,p_enquiry_id,v_actor,p_next_follow_up_at) returning id into v_next;
  end if;
  v_from:=v_enquiry.status;
  update public.enquiries set status=p_new_status,next_follow_up_at=p_next_follow_up_at,owner_membership_id=v_actor,updated_at=now() where tenant_id=p_tenant_id and id=p_enquiry_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state,metadata)
    values(p_tenant_id,v_enquiry.branch_id,p_identity_id,v_actor,'admissions.enquiry.followup','succeeded','enquiry',p_enquiry_id::text,v_correlation,
      jsonb_build_object('status',v_from),jsonb_build_object('status',p_new_status,'next_followup_id',v_next),jsonb_build_object('channel',p_channel,'completed_followup_id',v_followup));
  return jsonb_build_object('id',p_enquiry_id,'status',p_new_status,'completed_followup_id',v_followup,'next_followup_id',v_next);
end; $$;
revoke all on function public.record_admission_followup(uuid,bigint,bigint,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_admission_followup(uuid,bigint,bigint,text,text,text,timestamptz) to service_role;

create or replace function private.sync_enquiry_application_state() returns trigger language plpgsql set search_path='' as $$
begin
  if new.enquiry_id is not null then
    update public.enquiries set status=case when new.state='enrolled' then 'converted' else 'application_started' end,
      updated_at=now() where tenant_id=new.tenant_id and id=new.enquiry_id
      and status not in ('converted','archived');
  end if;
  return new;
end; $$;
revoke all on function private.sync_enquiry_application_state() from public,anon,authenticated;
drop trigger if exists applications_sync_enquiry on public.applications;
create trigger applications_sync_enquiry after insert or update of state,enquiry_id on public.applications
  for each row execute function private.sync_enquiry_application_state();

create or replace function public.start_application_from_enquiry(
  p_identity_id uuid,p_tenant_id bigint,p_enquiry_id bigint,p_tracking_secret_hash text,
  p_confirm_duplicate boolean default false,p_override_reason text default null
) returns jsonb language plpgsql set search_path='' as $$
declare
  v_actor bigint; v_override_actor bigint; e public.enquiries%rowtype; v_form bigint; v_sections jsonb; v_workflow bigint; v_required text;
  v_application bigint; v_tracking uuid; v_instance bigint; v_duplicates integer; v_answers jsonb; v_correlation uuid:=gen_random_uuid();
begin
  select * into e from public.enquiries where tenant_id=p_tenant_id and id=p_enquiry_id for update;
  if e.id is null then raise exception 'enquiry not found'; end if;
  v_actor:=private.resolve_staff_membership(p_identity_id,p_tenant_id,e.branch_id,array['admissions.enquiry.manage','admissions.application.review']);
  if v_actor is null then raise exception 'enquiry application permission denied'; end if;
  if e.status<>'qualified' or exists(select 1 from public.applications a where a.tenant_id=e.tenant_id and a.enquiry_id=e.id) then raise exception 'enquiry application transition unavailable'; end if;
  if p_tracking_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid tracking hash'; end if;
  select count(*) into v_duplicates from public.applications a where a.tenant_id=e.tenant_id and a.branch_id=e.branch_id and
    ((e.normalized_phone is not null and regexp_replace(coalesce(a.applicant_data->>'guardian_phone',''),'[\s()-]','','g')=e.normalized_phone) or
     (e.normalized_email is not null and lower(btrim(coalesce(a.applicant_data->>'guardian_email','')))=e.normalized_email));
  if v_duplicates>0 and not coalesce(p_confirm_duplicate,false) then return jsonb_build_object('duplicate_review_required',true,'possible_duplicates',v_duplicates); end if;
  if v_duplicates>0 then
    v_override_actor:=private.resolve_staff_membership(p_identity_id,p_tenant_id,e.branch_id,array['admissions.application.override']);
    if v_override_actor is null or length(btrim(coalesce(p_override_reason,'')))<20 then raise exception 'duplicate override permission and reason required'; end if;
  end if;
  select fv.id,fv.sections into v_form,v_sections from public.form_definitions fd join public.form_versions fv on fv.tenant_id=fd.tenant_id and fv.form_definition_id=fd.id
    where fd.tenant_id=e.tenant_id and fd.key='admission_application' and fd.entity_type='admission_application' and fd.audience='public' and fd.status='active' and fv.status='published'
      and fv.effective_at is not null and fv.published_at is not null order by fv.version desc limit 1;
  select wv.id into v_workflow from public.workflow_definitions wd join public.workflow_versions wv on wv.tenant_id=wd.tenant_id and wv.workflow_definition_id=wd.id
    where wd.tenant_id=e.tenant_id and wd.key='admission_default' and wd.status='active' and wv.status='published'
      and wv.effective_at is not null and wv.published_at is not null and coalesce((wv.validation_result->>'valid')::boolean,false)
      and wv.validation_result->>'start_key'='submitted' order by wv.version desc limit 1;
  if v_form is null or v_workflow is null then raise exception 'published admission configuration unavailable'; end if;
  v_answers:=jsonb_strip_nulls(jsonb_build_object('applicant_name',e.applicant_name,'guardian_name',e.guardian_name,
    'guardian_phone',e.normalized_phone,'guardian_email',e.normalized_email));
  for v_required in select field.value->>'key' from jsonb_array_elements(v_sections) section(value)
    cross join lateral jsonb_array_elements(section.value->'fields') field(value)
    where coalesce((field.value->>'required')::boolean,false)
  loop
    if length(btrim(coalesce(v_answers->>v_required,'')))=0 then raise exception 'enquiry missing required admission fields'; end if;
  end loop;
  insert into public.applications(tenant_id,branch_id,enquiry_id,session_id,program_id,form_version_id,workflow_version_id,
    tracking_secret_hash,applicant_data,state,revision,preferred_locale,consent,duplicate_review_status,submitted_at)
  values(e.tenant_id,e.branch_id,e.id,e.session_id,e.program_id,v_form,v_workflow,p_tracking_secret_hash,v_answers,'submitted',1,
    e.preferred_locale,e.consent,case when v_duplicates>0 then 'resolved' else 'clear' end,now()) returning id,tracking_id into v_application,v_tracking;
  insert into public.application_versions(tenant_id,application_id,revision,core_answers,validation_snapshot)
    values(e.tenant_id,v_application,1,v_answers,jsonb_build_object('valid',true,'form_version_id',v_form,'source','staff_enquiry'));
  insert into public.workflow_instances(tenant_id,branch_id,workflow_version_id,subject_type,subject_key,current_node_key,status,context)
    values(e.tenant_id,e.branch_id,v_workflow,'admission_application',v_tracking::text,'submitted','active',jsonb_build_object('application_id',v_application,'tracking_id',v_tracking,'enquiry_id',e.id)) returning id into v_instance;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state,metadata)
    values(e.tenant_id,e.branch_id,p_identity_id,v_actor,'admissions.enquiry.start_application','succeeded','application',v_application::text,v_correlation,
      jsonb_build_object('state','submitted','revision',1),jsonb_build_object('enquiry_id',e.id,'workflow_instance_id',v_instance,'possible_duplicate_count',v_duplicates,'override_reason',case when v_duplicates>0 then btrim(p_override_reason) else null end));
  return jsonb_build_object('application_id',v_application,'tracking_id',v_tracking,'state','submitted','duplicate_review_required',false);
end; $$;
revoke all on function public.start_application_from_enquiry(uuid,bigint,bigint,text,boolean,text) from public,anon,authenticated;
grant execute on function public.start_application_from_enquiry(uuid,bigint,bigint,text,boolean,text) to service_role;
