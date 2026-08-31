alter table public.notification_recipient_resolutions
  alter column recipient_identity_id drop not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='notification_recipient_subject_required'
      and conrelid='public.notification_recipient_resolutions'::regclass
  ) then
    alter table public.notification_recipient_resolutions
      add constraint notification_recipient_subject_required
      check (recipient_identity_id is not null or related_person_id is not null);
  end if;
end $$;

create unique index if not exists notification_recipient_person_event_unique
  on public.notification_recipient_resolutions(tenant_id,event_id,related_person_id)
  where recipient_identity_id is null and related_person_id is not null;

create or replace function public.get_whatsapp_center_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint
) returns jsonb
language plpgsql stable set search_path to pg_catalog, extensions
as $fn$
declare
  v_membership bigint;v_config jsonb;v_templates jsonb;v_recipients jsonb;v_dispatches jsonb;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id
        and rp.permission_code in('notification.policy.manage','notification.message.send','notification.usage.read')
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'WhatsApp workspace permission denied';end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required';end if;

  select to_jsonb(c) - 'encrypted_config_reference' into v_config
  from public.notification_channel_configs c
  where c.tenant_id=p_tenant_id and c.channel='whatsapp';

  select coalesce(jsonb_agg(row_to_json(x) order by x.locale,x.id),'[]'::jsonb) into v_templates
  from (
    select t.id,t.policy_id,t.locale,t.provider_template_reference,t.category,t.body_template,t.required_variables,t.state,t.published_at,p.event_key
    from public.notification_templates t join public.notification_policies p on p.tenant_id=t.tenant_id and p.id=t.policy_id
    where t.tenant_id=p_tenant_id and t.channel='whatsapp' and t.state<>'archived'
  ) x;

  with active_students as (
    select distinct on(e.student_person_id) e.student_person_id,sp.student_number,ps.display_name student_name
    from public.enrollments e
    join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id and sp.status in('active','admitted')
    join public.persons ps on ps.tenant_id=e.tenant_id and ps.id=e.student_person_id
    where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.status='active'
    order by e.student_person_id,e.starts_on desc nulls last,e.id desc
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.student_name),'[]'::jsonb) into v_recipients
  from (
    select s.student_person_id,s.student_number,s.student_name,g.id guardian_person_id,g.display_name guardian_name,
      case when pc.normalized_value is null then null else '••••'||right(pc.normalized_value,4) end phone_hint,
      coalesce(pc.consent#>>'{whatsapp,status}','not_recorded') whatsapp_consent_status,
      pc.consent#>>'{whatsapp,captured_at}' whatsapp_consent_at
    from active_students s
    left join public.person_relationships pr on pr.tenant_id=p_tenant_id and pr.target_person_id=s.student_person_id and pr.status='verified' and pr.is_primary=true
    left join public.persons g on g.tenant_id=p_tenant_id and g.id=pr.source_person_id
    left join lateral (
      select c.* from public.person_contacts c
      where c.tenant_id=p_tenant_id and c.person_id=pr.source_person_id and c.type='phone' and c.is_primary=true
      order by c.id limit 1
    ) pc on true
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_dispatches
  from (
    select d.id,d.state,d.provider_message_id,d.attempt_count,d.created_at,d.sent_at,d.last_error,
      t.locale,t.provider_template_reference,p.event_key,
      r.related_person_id,g.display_name guardian_name,
      e.payload->>'student_name' student_name,e.payload->>'student_number' student_number
    from public.notification_dispatches d
    join public.notification_templates t on t.tenant_id=d.tenant_id and t.id=d.template_id
    join public.notification_policies p on p.tenant_id=t.tenant_id and p.id=t.policy_id
    join public.notification_recipient_resolutions r on r.tenant_id=d.tenant_id and r.id=d.recipient_resolution_id
    left join public.persons g on g.tenant_id=r.tenant_id and g.id=r.related_person_id
    join public.domain_notification_events e on e.tenant_id=d.tenant_id and e.id=d.event_id
    where d.tenant_id=p_tenant_id and d.channel='whatsapp' and coalesce((e.payload->>'branch_id')::bigint,p_branch_id)=p_branch_id
    order by d.created_at desc,d.id desc limit 50
  )x;
  return jsonb_build_object('config',v_config,'templates',v_templates,'recipients',v_recipients,'dispatches',v_dispatches);
end;$fn$;

create or replace function public.configure_whatsapp_channel_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_provider text,p_sender_reference text,p_encrypted_config_reference text,p_state text
) returns jsonb
language plpgsql set search_path to pg_catalog, extensions
as $fn$
declare v_membership bigint;v_provider text:=lower(btrim(coalesce(p_provider,'')));v_sender text:=nullif(btrim(coalesce(p_sender_reference,'')),'');v_ref text:=nullif(btrim(coalesce(p_encrypted_config_reference,'')),'');v_state text:=lower(btrim(coalesce(p_state,'')));v_id bigint;begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='notification.policy.manage')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'WhatsApp configuration permission denied';end if;
  if v_provider not in('meta_cloud','360dialog','twilio','custom') then raise exception 'unsupported WhatsApp provider';end if;
  if v_state not in('active','inactive','suspended') then raise exception 'invalid WhatsApp channel state';end if;
  if v_state='active' and (v_sender is null or v_ref is null) then raise exception 'active WhatsApp channel requires sender and encrypted config reference';end if;
  insert into public.notification_channel_configs(tenant_id,channel,provider,sender_reference,encrypted_config_reference,state)
  values(p_tenant_id,'whatsapp',v_provider,v_sender,v_ref,v_state)
  on conflict(tenant_id,channel) do update set provider=excluded.provider,sender_reference=excluded.sender_reference,encrypted_config_reference=excluded.encrypted_config_reference,state=excluded.state
  returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'notification.whatsapp.configure','succeeded','notification_channel_config',v_id::text,gen_random_uuid(),jsonb_build_object('provider',v_provider,'sender_reference',v_sender,'state',v_state,'has_config_reference',v_ref is not null));
  return jsonb_build_object('config_id',v_id,'provider',v_provider,'sender_reference',v_sender,'state',v_state,'has_config_reference',v_ref is not null);
end;$fn$;

create or replace function public.upsert_guardian_whatsapp_template_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_locale text,p_body_template text,p_provider_template_reference text,p_required_variables text[] default array[]::text[]
) returns jsonb
language plpgsql set search_path to pg_catalog, extensions
as $fn$
declare v_membership bigint;v_policy bigint;v_template bigint;v_locale text:=lower(btrim(coalesce(p_locale,'')));v_body text:=btrim(coalesce(p_body_template,''));v_provider_ref text:=nullif(btrim(coalesce(p_provider_template_reference,'')),'');begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='notification.policy.manage')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'WhatsApp template permission denied';end if;
  if v_locale not in('en','ur','ar') then raise exception 'unsupported template locale';end if;
  if length(v_body) not between 2 and 4096 then raise exception 'valid WhatsApp template body required';end if;
  insert into public.notification_policies(tenant_id,event_key,version,channels,audience_rules,consent_basis,quiet_hours,retry_policy,state,published_at)
  values(p_tenant_id,'guardian.manual_message',1,array['whatsapp']::text[],jsonb_build_object('recipient','primary_guardian'),jsonb_build_object('whatsapp','explicit_opt_in'),jsonb_build_object('mode','respect_institution'),jsonb_build_object('max_attempts',3),'published',now())
  on conflict(tenant_id,event_key,version) do update set channels=excluded.channels,audience_rules=excluded.audience_rules,consent_basis=excluded.consent_basis,state='published',published_at=coalesce(public.notification_policies.published_at,now())
  returning id into v_policy;
  insert into public.notification_templates(tenant_id,policy_id,channel,locale,provider_template_reference,category,body_template,required_variables,state,validation_result,published_at)
  values(p_tenant_id,v_policy,'whatsapp',v_locale,v_provider_ref,'utility',v_body,coalesce(p_required_variables,array[]::text[]),'published',jsonb_build_object('valid',true,'validated_by','runtime-v1'),now())
  on conflict(tenant_id,policy_id,channel,locale) do update set provider_template_reference=excluded.provider_template_reference,body_template=excluded.body_template,required_variables=excluded.required_variables,state='published',validation_result=excluded.validation_result,published_at=now()
  returning id into v_template;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'notification.whatsapp.template.publish','succeeded','notification_template',v_template::text,gen_random_uuid(),jsonb_build_object('locale',v_locale,'provider_template_reference',v_provider_ref));
  return jsonb_build_object('template_id',v_template,'policy_id',v_policy,'locale',v_locale,'provider_template_reference',v_provider_ref,'state','published');
end;$fn$;

create or replace function public.set_guardian_whatsapp_consent_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_status text,p_source text,p_evidence_reference text default null
) returns jsonb
language plpgsql set search_path to pg_catalog, extensions
as $fn$
declare v_membership bigint;v_guardian bigint;v_contact bigint;v_status text:=lower(btrim(coalesce(p_status,'')));v_source text:=lower(btrim(coalesce(p_source,'')));v_evidence text:=nullif(btrim(coalesce(p_evidence_reference,'')),'');v_hint text;begin
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code in('notification.message.send','notification.policy.manage'))
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'WhatsApp consent permission denied';end if;
  if v_status not in('opted_in','opted_out') then raise exception 'invalid WhatsApp consent status';end if;
  if v_source not in('written','verbal','digital','provider') then raise exception 'invalid WhatsApp consent source';end if;
  if not exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active') then raise exception 'student is not active in branch';end if;
  select pr.source_person_id into v_guardian from public.person_relationships pr where pr.tenant_id=p_tenant_id and pr.target_person_id=p_student_person_id and pr.status='verified' and pr.is_primary=true order by pr.id limit 1;
  if v_guardian is null then raise exception 'primary verified guardian required';end if;
  select pc.id,'••••'||right(coalesce(pc.normalized_value,pc.value),4) into v_contact,v_hint from public.person_contacts pc where pc.tenant_id=p_tenant_id and pc.person_id=v_guardian and pc.type='phone' and pc.is_primary=true order by pc.id limit 1;
  if v_contact is null then raise exception 'primary guardian phone required';end if;
  update public.person_contacts set consent=jsonb_set(coalesce(consent,'{}'::jsonb),'{whatsapp}',jsonb_build_object('status',v_status,'captured_at',now(),'source',v_source,'evidence_reference',v_evidence,'captured_by_membership_id',v_membership),true),updated_at=now() where tenant_id=p_tenant_id and id=v_contact;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'notification.whatsapp.consent.record','succeeded','person_contact',v_contact::text,gen_random_uuid(),jsonb_build_object('guardian_person_id',v_guardian,'student_person_id',p_student_person_id,'status',v_status,'source',v_source,'phone_hint',v_hint));
  return jsonb_build_object('guardian_person_id',v_guardian,'student_person_id',p_student_person_id,'status',v_status,'phone_hint',v_hint);
end;$fn$;

create or replace function public.queue_guardian_whatsapp_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_template_id bigint,p_variables jsonb,p_request_key text
) returns jsonb
language plpgsql set search_path to pg_catalog, extensions
as $fn$
declare
  v_membership bigint;v_guardian bigint;v_guardian_identity uuid;v_contact public.person_contacts%rowtype;v_student record;v_template public.notification_templates%rowtype;v_policy public.notification_policies%rowtype;v_config public.notification_channel_configs%rowtype;v_event bigint;v_resolution bigint;v_dispatch bigint;v_state text;v_reason text;v_consent text;v_locale text;v_payload jsonb;v_existing public.notification_dispatches%rowtype;
begin
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'valid WhatsApp request key required';end if;
  if p_variables is null or jsonb_typeof(p_variables)<>'object' or octet_length(p_variables::text)>8192 then raise exception 'WhatsApp variables must be a small object';end if;
  select m.id into v_membership from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='notification.message.send')
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'WhatsApp send permission denied';end if;
  select * into v_existing from public.notification_dispatches d where d.tenant_id=p_tenant_id and d.idempotency_key=p_request_key limit 1;
  if v_existing.id is not null then return jsonb_build_object('dispatch_id',v_existing.id,'state',v_existing.state,'unchanged',true);end if;
  select e.student_person_id,sp.student_number,p.display_name into v_student from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active' and sp.status in('active','admitted') order by e.id desc limit 1;
  if v_student.student_person_id is null then raise exception 'active branch student required';end if;
  select pr.source_person_id into v_guardian from public.person_relationships pr where pr.tenant_id=p_tenant_id and pr.target_person_id=p_student_person_id and pr.status='verified' and pr.is_primary=true order by pr.id limit 1;
  if v_guardian is null then raise exception 'primary verified guardian required';end if;
  select * into v_contact from public.person_contacts pc where pc.tenant_id=p_tenant_id and pc.person_id=v_guardian and pc.type='phone' and pc.is_primary=true order by pc.id limit 1;
  if v_contact.id is null or nullif(btrim(coalesce(v_contact.normalized_value,v_contact.value)), '') is null then raise exception 'guardian phone required';end if;
  select ipl.identity_id into v_guardian_identity from public.identity_person_links ipl where ipl.tenant_id=p_tenant_id and ipl.person_id=v_guardian and ipl.status='verified' order by ipl.id limit 1;
  select * into v_template from public.notification_templates t where t.tenant_id=p_tenant_id and t.id=p_template_id and t.channel='whatsapp' and t.state='published';
  if v_template.id is null then raise exception 'published WhatsApp template required';end if;
  select * into v_policy from public.notification_policies p where p.tenant_id=p_tenant_id and p.id=v_template.policy_id and p.state='published';
  if v_policy.id is null then raise exception 'published WhatsApp policy required';end if;
  select * into v_config from public.notification_channel_configs c where c.tenant_id=p_tenant_id and c.channel='whatsapp';
  v_consent:=coalesce(v_contact.consent#>>'{whatsapp,status}','not_recorded');
  v_locale:=coalesce((select p.preferred_locale from public.persons p where p.tenant_id=p_tenant_id and p.id=v_guardian),v_template.locale,'en');
  v_payload:=jsonb_build_object('branch_id',p_branch_id,'student_person_id',p_student_person_id,'student_number',v_student.student_number,'student_name',v_student.display_name,'guardian_person_id',v_guardian,'template_id',v_template.id,'variables',p_variables);
  insert into public.domain_notification_events(tenant_id,event_key,aggregate_type,aggregate_id,payload,payload_digest,occurred_at,idempotency_key)
  values(p_tenant_id,v_policy.event_key,'student',p_student_person_id::text,v_payload,encode(digest(v_payload::text,'sha256'),'hex'),now(),p_request_key)
  returning id into v_event;
  insert into public.notification_recipient_resolutions(tenant_id,event_id,recipient_identity_id,related_person_id,relationship_evidence,locale,channels,consent_snapshot)
  values(p_tenant_id,v_event,v_guardian_identity,v_guardian,jsonb_build_object('relationship','primary_guardian','student_person_id',p_student_person_id),v_locale,array['whatsapp']::text[],jsonb_build_object('whatsapp',coalesce(v_contact.consent->'whatsapp','{}'::jsonb)))
  returning id into v_resolution;
  if v_consent<>'opted_in' then v_state:='blocked';v_reason:='WhatsApp opt-in is not recorded';
  elsif v_config.id is null or v_config.state<>'active' or v_config.encrypted_config_reference is null or v_config.sender_reference is null then v_state:='blocked';v_reason:='WhatsApp provider is not fully configured';
  elsif v_template.provider_template_reference is null then v_state:='blocked';v_reason:='Provider-approved WhatsApp template reference is missing';
  else v_state:='queued';v_reason:=null;end if;
  insert into public.notification_dispatches(tenant_id,event_id,recipient_resolution_id,template_id,channel,destination_hash,rendered_digest,state,last_error,idempotency_key)
  values(p_tenant_id,v_event,v_resolution,v_template.id,'whatsapp',encode(digest(coalesce(v_contact.normalized_value,v_contact.value),'sha256'),'hex'),encode(digest(v_template.body_template||':'||p_variables::text,'sha256'),'hex'),v_state,case when v_reason is null then null else jsonb_build_object('reason',v_reason) end,p_request_key)
  returning id into v_dispatch;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'notification.whatsapp.queue','succeeded','notification_dispatch',v_dispatch::text,gen_random_uuid(),jsonb_build_object('student_person_id',p_student_person_id,'guardian_person_id',v_guardian,'template_id',v_template.id,'state',v_state,'blocked_reason',v_reason));
  return jsonb_build_object('dispatch_id',v_dispatch,'event_id',v_event,'state',v_state,'blocked_reason',v_reason,'unchanged',false);
end;$fn$;

create or replace function public.get_whatsapp_dispatch_handoff_v1(p_dispatch_id bigint)
returns jsonb language plpgsql stable set search_path to pg_catalog, extensions
as $fn$
declare v_result jsonb;begin
  select jsonb_build_object(
    'dispatch_id',d.id,'provider',c.provider,'sender_reference',c.sender_reference,'encrypted_config_reference',c.encrypted_config_reference,
    'provider_template_reference',t.provider_template_reference,'locale',t.locale,'destination',coalesce(pc.normalized_value,pc.value),
    'variables',e.payload->'variables','student_number',e.payload->>'student_number','student_name',e.payload->>'student_name'
  ) into v_result
  from public.notification_dispatches d
  join public.notification_recipient_resolutions r on r.tenant_id=d.tenant_id and r.id=d.recipient_resolution_id
  join public.person_contacts pc on pc.tenant_id=r.tenant_id and pc.person_id=r.related_person_id and pc.type='phone' and pc.is_primary=true
  join public.notification_templates t on t.tenant_id=d.tenant_id and t.id=d.template_id
  join public.domain_notification_events e on e.tenant_id=d.tenant_id and e.id=d.event_id
  join public.notification_channel_configs c on c.tenant_id=d.tenant_id and c.channel='whatsapp' and c.state='active'
  where d.id=p_dispatch_id and d.channel='whatsapp' and d.state='queued'
    and coalesce(r.consent_snapshot#>>'{whatsapp,status}','')='opted_in';
  return v_result;
end;$fn$;

create or replace function public.record_whatsapp_dispatch_result_v1(p_dispatch_id bigint,p_state text,p_provider_message_id text default null,p_error jsonb default null)
returns jsonb language plpgsql set search_path to pg_catalog, extensions
as $fn$
declare v_state text:=lower(btrim(coalesce(p_state,'')));v_dispatch public.notification_dispatches%rowtype;begin
  if v_state not in('sent','failed') then raise exception 'invalid WhatsApp dispatch result state';end if;
  update public.notification_dispatches set state=v_state,provider_message_id=nullif(btrim(coalesce(p_provider_message_id,'')),''),attempt_count=attempt_count+1,last_error=case when v_state='failed' then coalesce(p_error,'{}'::jsonb) else null end,sent_at=case when v_state='sent' then coalesce(sent_at,now()) else sent_at end where id=p_dispatch_id and channel='whatsapp' and state in('queued','sending','failed') returning * into v_dispatch;
  if v_dispatch.id is null then raise exception 'queued WhatsApp dispatch not found';end if;
  return jsonb_build_object('dispatch_id',v_dispatch.id,'state',v_dispatch.state,'provider_message_id',v_dispatch.provider_message_id,'attempt_count',v_dispatch.attempt_count);
end;$fn$;

create or replace function public.record_whatsapp_delivery_event_v1(p_dispatch_id bigint,p_provider_event_id text,p_state text,p_signature_verified boolean,p_payload_digest text,p_occurred_at timestamptz)
returns jsonb language plpgsql set search_path to pg_catalog, extensions
as $fn$
declare v_state text:=lower(btrim(coalesce(p_state,'')));v_tenant bigint;v_event_id bigint;begin
  if v_state not in('delivered','read','failed') then raise exception 'invalid WhatsApp delivery state';end if;
  select tenant_id into v_tenant from public.notification_dispatches where id=p_dispatch_id and channel='whatsapp';
  if v_tenant is null then raise exception 'WhatsApp dispatch not found';end if;
  insert into public.notification_delivery_events(tenant_id,dispatch_id,provider_event_id,state,signature_verified,payload_digest,occurred_at)
  values(v_tenant,p_dispatch_id,nullif(btrim(coalesce(p_provider_event_id,'')),''),v_state,coalesce(p_signature_verified,false),p_payload_digest,coalesce(p_occurred_at,now())) returning id into v_event_id;
  if p_signature_verified then update public.notification_dispatches set state=v_state,last_error=case when v_state='failed' then jsonb_build_object('reason','provider delivery failure') else last_error end where tenant_id=v_tenant and id=p_dispatch_id;end if;
  return jsonb_build_object('delivery_event_id',v_event_id,'dispatch_id',p_dispatch_id,'state',v_state,'signature_verified',coalesce(p_signature_verified,false));
end;$fn$;

revoke all on function public.get_whatsapp_center_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.configure_whatsapp_channel_v1(uuid,bigint,bigint,text,text,text,text) from public,anon,authenticated;
revoke all on function public.upsert_guardian_whatsapp_template_v1(uuid,bigint,bigint,text,text,text,text[]) from public,anon,authenticated;
revoke all on function public.set_guardian_whatsapp_consent_v1(uuid,bigint,bigint,bigint,text,text,text) from public,anon,authenticated;
revoke all on function public.queue_guardian_whatsapp_v1(uuid,bigint,bigint,bigint,bigint,jsonb,text) from public,anon,authenticated;
revoke all on function public.get_whatsapp_dispatch_handoff_v1(bigint) from public,anon,authenticated;
revoke all on function public.record_whatsapp_dispatch_result_v1(bigint,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.record_whatsapp_delivery_event_v1(bigint,text,text,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.get_whatsapp_center_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.configure_whatsapp_channel_v1(uuid,bigint,bigint,text,text,text,text) to service_role;
grant execute on function public.upsert_guardian_whatsapp_template_v1(uuid,bigint,bigint,text,text,text,text[]) to service_role;
grant execute on function public.set_guardian_whatsapp_consent_v1(uuid,bigint,bigint,bigint,text,text,text) to service_role;
grant execute on function public.queue_guardian_whatsapp_v1(uuid,bigint,bigint,bigint,bigint,jsonb,text) to service_role;
grant execute on function public.get_whatsapp_dispatch_handoff_v1(bigint) to service_role;
grant execute on function public.record_whatsapp_dispatch_result_v1(bigint,text,text,jsonb) to service_role;
grant execute on function public.record_whatsapp_delivery_event_v1(bigint,text,text,boolean,text,timestamptz) to service_role;