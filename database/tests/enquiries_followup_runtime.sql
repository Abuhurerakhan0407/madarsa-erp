-- Full enquiry -> follow-up -> application -> enrollment transaction plus denial cases.
-- All records, audits, counters and permission changes roll back.
begin;
do $test$
declare
  actor public.memberships%rowtype; branch bigint; session bigint; program bigint;
  enquiry jsonb; duplicate jsonb; followup jsonb; application jsonb; converted jsonb;
  scenarios text[]:=array['unscoped','future','expired','revoked','inactive_role','no_permission','wrong_identity','wrong_tenant'];
  scenario text; passed integer:=0; before_counts jsonb; after_counts jsonb;
begin
  select m.* into strict actor from public.memberships m where m.status='active' and m.all_branches
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='admissions.enquiry.manage')
    order by m.id limit 1;
  select b.id into strict branch from public.branches b where b.tenant_id=actor.tenant_id and b.status='active' order by b.id limit 1;
  select s.id into strict session from public.academic_sessions s where s.tenant_id=actor.tenant_id and s.status='active' order by s.id limit 1;
  select p.id into strict program from public.programs p where p.tenant_id=actor.tenant_id and p.status='active' and (p.branch_id is null or p.branch_id=branch) order by p.id limit 1;
  select jsonb_build_object('enquiries',(select count(*) from public.enquiries),'followups',(select count(*) from public.admission_followups),'applications',(select count(*) from public.applications),'versions',(select count(*) from public.application_versions),'workflows',(select count(*) from public.workflow_instances),'audits',(select count(*) from public.audit_events),'persons',(select count(*) from public.persons),'profiles',(select count(*) from public.student_profiles),'enrollments',(select count(*) from public.enrollments),'conversions',(select count(*) from public.admission_conversions)) into before_counts;

  set local role service_role;
  select public.create_admission_enquiry(actor.identity_id,actor.tenant_id,branch,session,program,
    'Enquiry Rollback Student','Rollback Guardian','+910000000001',null,'en','audit-test',true,'Rollback-only integration fixture',now()+interval '1 day') into enquiry;
  if enquiry->>'status'<>'new' or (enquiry->>'possible_duplicates')::integer<>0 then raise exception 'Initial enquiry failed'; end if;
  select public.create_admission_enquiry(actor.identity_id,actor.tenant_id,branch,session,program,
    'Enquiry Duplicate Fixture','Rollback Guardian','+910000000001',null,'en','audit-test',true,'Rollback-only duplicate fixture',now()+interval '1 day') into duplicate;
  if (duplicate->>'possible_duplicates')::integer<1 then raise exception 'Duplicate hint failed'; end if;
  select public.record_admission_followup(actor.identity_id,actor.tenant_id,(enquiry->>'id')::bigint,'phone','Qualified after initial call','qualified',null) into followup;
  if followup->>'status'<>'qualified' then raise exception 'Qualification failed'; end if;
  select public.start_application_from_enquiry(actor.identity_id,actor.tenant_id,(enquiry->>'id')::bigint,repeat('0',64),false,null) into application;
  if application->>'state'<>'submitted' or (application->>'duplicate_review_required')::boolean then raise exception 'Application start failed'; end if;
  perform public.progress_admission_staff(actor.identity_id,actor.tenant_id,(application->>'application_id')::bigint,'start_review',null);
  perform public.progress_admission_staff(actor.identity_id,actor.tenant_id,(application->>'application_id')::bigint,'complete_review','Rollback verification complete');
  perform public.progress_admission_staff(actor.identity_id,actor.tenant_id,(application->>'application_id')::bigint,'offer','Rollback acceptance test only');
  select public.convert_admission_to_student(actor.identity_id,actor.tenant_id,(application->>'application_id')::bigint,false) into converted;
  if converted->>'converted'<>'true' or not exists(select 1 from public.enquiries e where e.tenant_id=actor.tenant_id and e.id=(enquiry->>'id')::bigint and e.status='converted') then raise exception 'Enquiry conversion sync failed'; end if;
  select public.convert_admission_to_student(actor.identity_id,actor.tenant_id,(application->>'application_id')::bigint,false) into converted;
  if converted->>'idempotent'<>'true' then raise exception 'Conversion retry failed'; end if;
  passed:=passed+8;
  reset role;

  foreach scenario in array scenarios loop
    begin
      if scenario='unscoped' then
        update public.memberships set all_branches=false where tenant_id=actor.tenant_id and id=actor.id;
        delete from public.membership_branch_scopes where tenant_id=actor.tenant_id and membership_id=actor.id;
      elsif scenario='future' then update public.memberships set starts_at=now()+interval '1 day' where tenant_id=actor.tenant_id and id=actor.id;
      elsif scenario='expired' then update public.memberships set ends_at=now()-interval '1 second' where tenant_id=actor.tenant_id and id=actor.id;
      elsif scenario='revoked' then update public.memberships set status='revoked' where tenant_id=actor.tenant_id and id=actor.id;
      elsif scenario='inactive_role' then update public.roles set status='inactive' where tenant_id=actor.tenant_id and id in(select role_id from public.membership_roles where tenant_id=actor.tenant_id and membership_id=actor.id);
      elsif scenario='no_permission' then delete from public.membership_roles where tenant_id=actor.tenant_id and membership_id=actor.id;
      end if;
      set local role service_role;
      begin
        perform public.create_admission_enquiry(
          case when scenario='wrong_identity' then '00000000-0000-0000-0000-000000000000'::uuid else actor.identity_id end,
          case when scenario='wrong_tenant' then -90001 else actor.tenant_id end,branch,session,program,
          'Denied Rollback Student',null,'+910000000009',null,'en','audit-test',true,null,now()+interval '1 day');
        raise exception 'Expected enquiry permission denial: %',scenario;
      exception when others then
        if position('permission denied' in sqlerrm)=0 then raise; end if;
        passed:=passed+1;
      end;
      reset role;
      raise exception using errcode='P1000',message='scenario passed';
    exception when sqlstate 'P1000' then null;
    end;
  end loop;
  perform set_config('madarsa_test.enquiry_result',jsonb_build_object('passed',passed,'full_flow_steps',8,'denial_scenarios',8)::text,true);
end;
$test$;
select jsonb_build_object(
  'flow',current_setting('madarsa_test.enquiry_result')::jsonb,
  'privileges',jsonb_build_object(
    'authenticated_helper_execute',has_function_privilege('authenticated','private.resolve_staff_membership(uuid,bigint,bigint,text[])','execute'),
    'authenticated_create_execute',has_function_privilege('authenticated','public.create_admission_enquiry(uuid,bigint,bigint,bigint,bigint,text,text,text,text,text,text,boolean,text,timestamptz)','execute'),
    'service_create_execute',has_function_privilege('service_role','public.create_admission_enquiry(uuid,bigint,bigint,bigint,bigint,text,text,text,text,text,text,boolean,text,timestamptz)','execute')
  )
) as enquiry_test_results;
rollback;
