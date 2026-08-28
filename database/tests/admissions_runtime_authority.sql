-- Database-owner integration check. Requires one successfully converted application.
-- All temporary roles, memberships and the newer enrollment roll back.
begin;
do $test$
declare
  app public.applications%rowtype;
  actor public.memberships%rowtype;
  numbering public.number_sequences%rowtype;
  scenario text;
  entry record;
  calls jsonb;
  result jsonb;
  passed integer := 0;
  original_enrollment bigint;
  later_enrollment bigint;
begin
  select a.* into strict app from public.applications a
  where a.state='enrolled' and exists(select 1 from public.admission_conversions c where c.tenant_id=a.tenant_id and c.application_id=a.id)
  order by a.id limit 1;
  select m.* into strict actor from public.memberships m
  join public.admission_conversions c on c.tenant_id=m.tenant_id and c.converted_by_membership_id=m.id
  where c.tenant_id=app.tenant_id and c.application_id=app.id and m.status='active' and m.all_branches;
  select n.* into strict numbering from public.number_sequences n
  where n.tenant_id=app.tenant_id and n.branch_id=app.branch_id and n.key='student_default' and n.status='published'
  order by n.version desc limit 1;
  select enrollment_id into strict original_enrollment from public.admission_conversions
  where tenant_id=app.tenant_id and application_id=app.id;

  calls := jsonb_build_object(
    'convert',format('select public.convert_admission_to_student(%L::uuid,%s,%s,false)',actor.identity_id,app.tenant_id,app.id),
    'progress',format('select public.progress_admission_staff(%L::uuid,%s,%s,%L,null)',actor.identity_id,app.tenant_id,app.id,'start_review'),
    'numbering',format('select public.setup_student_number_sequence(%L::uuid,%s,%s,%L,%s,%s,%L)',actor.identity_id,app.tenant_id,app.branch_id,numbering.pattern,numbering.next_value,numbering.padding,numbering.reset_period),
    'foundation',format('select public.setup_admissions_foundation(%L::uuid,%s,%s,%L,%L::jsonb,current_date,current_date+365,%L,%L::jsonb,%L,%L::jsonb,%L::jsonb,%L::jsonb)',actor.identity_id,app.tenant_id,app.branch_id,'audit_test','{"en":"Test","ur":"Test","ar":"Test"}','audit_test','{"en":"Test","ur":"Test","ar":"Test"}','general','[{}]','[{},{}]','[{}]'),
    'preset',format('select public.apply_configuration_preset_drafts(%L::uuid,%s,%L,%L::jsonb,%L::jsonb)',actor.identity_id,app.tenant_id,'maktab','[{}]','[{}]')
  );
  foreach scenario in array array['inactive_role','future','expired','revoked','no_permission','wrong_identity','unscoped'] loop
    begin
      if scenario='inactive_role' then
        update public.roles set status='inactive' where tenant_id=actor.tenant_id and id in
          (select role_id from public.membership_roles where tenant_id=actor.tenant_id and membership_id=actor.id);
      elsif scenario='future' then
        update public.memberships set starts_at=now()+interval '1 day' where tenant_id=actor.tenant_id and id=actor.id;
      elsif scenario='expired' then
        update public.memberships set ends_at=now()-interval '1 second' where tenant_id=actor.tenant_id and id=actor.id;
      elsif scenario='revoked' then
        update public.memberships set status='revoked' where tenant_id=actor.tenant_id and id=actor.id;
      elsif scenario='no_permission' then
        delete from public.membership_roles where tenant_id=actor.tenant_id and membership_id=actor.id;
      elsif scenario='unscoped' then
        update public.memberships set all_branches=false where tenant_id=actor.tenant_id and id=actor.id;
        delete from public.membership_branch_scopes where tenant_id=actor.tenant_id and membership_id=actor.id;
      end if;
      execute 'set local role service_role';
      for entry in select key,value from jsonb_each_text(calls) loop
        if scenario='unscoped' and entry.key='preset' then continue; end if;
        begin
          execute case when scenario='wrong_identity' then replace(entry.value,actor.identity_id::text,'00000000-0000-0000-0000-000000000000') else entry.value end into result;
          raise exception 'Expected permission denial: % / %',scenario,entry.key;
        exception when others then
          if position('permission denied' in sqlerrm)=0 then raise; end if;
          passed := passed+1;
        end;
      end loop;
      execute 'reset role';
      raise exception using errcode='P1000',message='scenario passed';
    exception when sqlstate 'P1000' then null;
    end;
  end loop;

  -- Reproduce the future readmission case: a newer matching enrollment must not
  -- replace the immutable enrollment originally created by this application.
  select coalesce(max(id),0)+100000 into later_enrollment from public.enrollments;
  insert into public.enrollments(id,tenant_id,branch_id,student_person_id,session_id,program_id,starts_on,status,version)
    overriding system value
    select later_enrollment,tenant_id,branch_id,student_person_id,session_id,program_id,starts_on,'completed',1
    from public.enrollments where tenant_id=app.tenant_id and id=original_enrollment;
  execute 'set local role service_role';
  execute calls->>'convert' into result;
  if result->>'idempotent' is distinct from 'true' or (result->>'enrollment_id')::bigint is distinct from original_enrollment then
    raise exception 'Retry selected a later enrollment';
  end if;
  passed := passed+1;
  execute calls->>'numbering' into result;
  if result->>'created' is distinct from 'false' then raise exception 'Owner numbering setup was not idempotent'; end if;
  passed := passed+1;
  execute 'reset role';
  perform set_config('madarsa_test.runtime_result',jsonb_build_object('passed',passed,'negative_checks',34,'positive_checks',2)::text,true);
end;
$test$;
select current_setting('madarsa_test.runtime_result')::jsonb as runtime_test_results;
rollback;
