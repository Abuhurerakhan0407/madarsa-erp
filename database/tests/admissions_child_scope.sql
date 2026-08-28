-- Run as the database owner in a controlled environment with one accepted admission.
-- Every fixture/permission change rolls back. Explicit negative fixture IDs avoid
-- advancing identity sequences. Any failed assertion aborts the transaction.
begin;
do $test$
declare
  app public.applications%rowtype;
  actor public.memberships%rowtype;
  enrollment bigint;
  decision bigint;
  tab text;
  scenario text;
  baseline jsonb := '{}'::jsonb;
  actual bigint;
  expected bigint;
  passed integer := 0;
  tables text[] := array['application_versions','application_documents',
    'application_reviews','admission_assessments','admission_decisions',
    'admission_offers','waitlist_entries','admission_conversions','admission_followups'];
begin
  select a.* into strict app from public.applications a
  where a.state='enrolled' and exists (
    select 1 from public.audit_events ev
    where ev.tenant_id=a.tenant_id and ev.entity_id=a.id::text
      and ev.action='admissions.application.convert' and ev.outcome='succeeded'
  ) order by a.id limit 1;
  select m.* into strict actor from public.memberships m
  join public.audit_events ev on ev.tenant_id=m.tenant_id and ev.actor_membership_id=m.id
  where ev.tenant_id=app.tenant_id and ev.entity_id=app.id::text
    and ev.action='admissions.application.convert' and ev.outcome='succeeded'
    and m.status='active' and m.all_branches
  order by ev.occurred_at limit 1;
  select (ev.after_state->>'enrollment_id')::bigint into strict enrollment
  from public.audit_events ev where ev.tenant_id=app.tenant_id
    and ev.entity_id=app.id::text and ev.action='admissions.application.convert'
    and ev.outcome='succeeded' order by ev.occurred_at limit 1;
  select id into strict decision from public.admission_decisions
  where tenant_id=app.tenant_id and application_id=app.id order by id limit 1;

  insert into public.documents(id,tenant_id,branch_id,category,title)
    overriding system value values(-90001,app.tenant_id,app.branch_id,'test','Rollback scope fixture');
  insert into public.application_documents(id,tenant_id,application_id,document_id,requirement_key)
    overriding system value values(-90001,app.tenant_id,app.id,-90001,'scope_test');
  insert into public.admission_assessments(id,tenant_id,application_id,assessment_type)
    overriding system value values(-90001,app.tenant_id,app.id,'interview');
  insert into public.admission_offers(id,tenant_id,application_id,decision_id,offered_program_id,valid_until)
    overriding system value values(-90001,app.tenant_id,app.id,decision,app.program_id,now()+interval '1 day');
  insert into public.waitlist_entries(id,tenant_id,application_id,program_id,priority)
    overriding system value values(-90001,app.tenant_id,app.id,app.program_id,1)
    on conflict(tenant_id,application_id,program_id) do nothing;
  insert into public.admission_conversions(id,tenant_id,application_id,student_person_id,enrollment_id,idempotency_key,converted_by_membership_id)
    overriding system value values(-90001,app.tenant_id,app.id,app.applicant_person_id,enrollment,'rollback-scope-fixture',actor.id)
    on conflict(tenant_id,application_id) do nothing;
  insert into public.enquiries(id,tenant_id,branch_id,applicant_name)
    overriding system value values(-90001,app.tenant_id,app.branch_id,'Rollback scope fixture');
  insert into public.admission_followups(id,tenant_id,application_id,due_at)
    overriding system value values(-90001,app.tenant_id,app.id,now());
  insert into public.admission_followups(id,tenant_id,enquiry_id,due_at)
    overriding system value values(-90002,app.tenant_id,-90001,now());

  perform set_config('request.jwt.claim.sub',actor.identity_id::text,true);
  foreach tab in array tables loop
    if tab='admission_followups' then
      execute format('select count(*) from public.%I where tenant_id=$1 and (application_id=$2 or enquiry_id=-90001)',tab)
        into actual using app.tenant_id,app.id;
    else
      execute format('select count(*) from public.%I where tenant_id=$1 and application_id=$2',tab)
        into actual using app.tenant_id,app.id;
    end if;
    if actual=0 then raise exception 'Missing fixture for %',tab; end if;
    baseline := baseline || jsonb_build_object(tab,actual);
  end loop;

  foreach scenario in array array['owner','unscoped','scoped','future','expired','revoked','inactive_role','no_permission','wrong_identity'] loop
    begin
      if scenario in ('unscoped','scoped') then
        update public.memberships set all_branches=false where tenant_id=actor.tenant_id and id=actor.id;
        delete from public.membership_branch_scopes where tenant_id=actor.tenant_id and membership_id=actor.id;
        if scenario='scoped' then
          insert into public.membership_branch_scopes(tenant_id,membership_id,branch_id)
            values(actor.tenant_id,actor.id,app.branch_id);
        end if;
      elsif scenario='future' then
        update public.memberships set starts_at=now()+interval '1 day' where tenant_id=actor.tenant_id and id=actor.id;
      elsif scenario='expired' then
        update public.memberships set ends_at=now()-interval '1 second' where tenant_id=actor.tenant_id and id=actor.id;
      elsif scenario='revoked' then
        update public.memberships set status='revoked' where tenant_id=actor.tenant_id and id=actor.id;
      elsif scenario='inactive_role' then
        update public.roles set status='inactive' where tenant_id=actor.tenant_id and id in
          (select role_id from public.membership_roles where tenant_id=actor.tenant_id and membership_id=actor.id);
      elsif scenario='no_permission' then
        delete from public.membership_roles where tenant_id=actor.tenant_id and membership_id=actor.id;
      elsif scenario='wrong_identity' then
        perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
      end if;
      execute 'set local role authenticated';
      foreach tab in array tables loop
        if tab='admission_followups' then
          execute format('select count(*) from public.%I where tenant_id=$1 and (application_id=$2 or enquiry_id=-90001)',tab)
            into actual using app.tenant_id,app.id;
        else
          execute format('select count(*) from public.%I where tenant_id=$1 and application_id=$2',tab)
            into actual using app.tenant_id,app.id;
        end if;
        expected := case when scenario in ('owner','scoped') then (baseline->>tab)::bigint else 0 end;
        if actual<>expected then raise exception 'Scope assertion failed: % / %, expected %, got %',scenario,tab,expected,actual; end if;
        passed := passed+1;
      end loop;
      execute 'reset role';
      -- Roll back only this scenario's permission changes, keeping fixtures.
      raise exception using errcode='P1000',message='scenario passed';
    exception when sqlstate 'P1000' then null;
    end;
  end loop;
  perform set_config('madarsa_test.scope_result',jsonb_build_object('passed',passed,'scenarios',9,'tables',9)::text,true);
end;
$test$;
select current_setting('madarsa_test.scope_result')::jsonb as scope_test_results;
rollback;
