begin;

create or replace function public.import_students_batch_v2(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_session_id bigint,
  p_program_id bigint,
  p_group_id bigint,
  p_joined_on date,
  p_rows jsonb,
  p_request_key text
) returns jsonb
language plpgsql
set search_path to 'pg_catalog','extensions'
as $fn$
declare
  v_membership bigint;
  v_job bigint;
  v_existing public.student_bulk_operation_jobs%rowtype;
  v_entry record;
  v_row jsonb;
  v_result jsonb;
  v_name text;
  v_person bigint;
  v_total integer;

  v_success integer:=0;
  v_blocked integer:=0;
  v_failed integer:=0;
  v_guardian_linked integer:=0;
  v_state text;
  v_item_state text;
  v_item_result jsonb;
  v_guardian jsonb;
  v_guardian_name text;
  v_guardian_relationship text;
  v_guardian_phone text;
  v_guardian_phone_norm text;
  v_guardian_email text;
  v_guardian_person bigint;
  v_guardian_matches integer;
  v_membership_required integer;
begin
  if p_request_key is null or length(p_request_key) not between 16 and 128 then
    raise exception 'valid import request key required';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then
    raise exception 'student import rows must be an array';
  end if;
  v_total:=jsonb_array_length(p_rows);
  if v_total<1 or v_total>100 then raise exception 'student import supports 1 to 100 rows per batch';end if;

  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id
    and m.identity_id=p_identity_id
    and m.status='active'
    and (
      m.all_branches
      or exists(
        select 1 from public.membership_branch_scopes s
        where s.tenant_id=m.tenant_id
          and s.membership_id=m.id
          and s.branch_id=p_branch_id
      )
    )
    and exists(
      select 1
      from public.membership_roles mr
      join public.role_permissions rp
        on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id
        and mr.membership_id=m.id
        and rp.permission_code in('people.person.manage','students.profile.update','academics.enrollment.manage')
      group by mr.membership_id
      having count(distinct rp.permission_code)=3
    )
  order by m.created_at
  limit 1;

  if v_membership is null then raise exception 'student import permission denied';end if;

  select * into v_existing
  from public.student_bulk_operation_jobs j
  where j.tenant_id=p_tenant_id and j.idempotency_key=p_request_key;
  if v_existing.id is not null then
    return jsonb_build_object(
      'job_id',v_existing.id,
      'state',v_existing.state,
      'total_items',v_existing.total_items,
      'succeeded_items',v_existing.succeeded_items,
      'blocked_items',v_existing.blocked_items,
      'failed_items',v_existing.failed_items,
      'guardian_linked_items',coalesce((v_existing.summary->>'guardian_linked')::integer,0),
      'unchanged',true
    );
  end if;

  insert into public.student_bulk_operation_jobs(
    tenant_id,branch_id,operation_type,idempotency_key,state,total_items,actor_membership_id,summary
  ) values(
    p_tenant_id,p_branch_id,'import',p_request_key,'processing',v_total,v_membership,
    jsonb_build_object('session_id',p_session_id,'program_id',p_program_id,'group_id',p_group_id,'joined_on',p_joined_on)
  ) returning id into v_job;

  for v_entry in
    select value,ordinality from jsonb_array_elements(p_rows) with ordinality
  loop
    v_row:=v_entry.value;
    v_name:=btrim(coalesce(v_row->>'display_name',''));
    v_person:=null;
    v_guardian_person:=null;
    v_item_result:='{}'::jsonb;

    begin
      if jsonb_typeof(v_row)<>'object' then raise exception 'row must be an object';end if;
      v_guardian:=case
        when v_row ? 'guardian' and jsonb_typeof(v_row->'guardian')='object' then v_row->'guardian'
        else null
      end;

      select public.create_student_direct(
        p_identity_id,p_tenant_id,p_branch_id,v_name,
        nullif(btrim(coalesce(v_row->>'name_native','')),''),
        nullif(v_row->>'date_of_birth','')::date,
        nullif(v_row->>'gender',''),
        coalesce(nullif(v_row->>'preferred_locale',''),'en'),
        p_session_id,p_program_id,p_group_id,p_joined_on,
        null,null,null,null,false
      ) into v_result;

      if coalesce((v_result->>'duplicate_review_required')::boolean,false) then
        v_item_state:='blocked';
        v_blocked:=v_blocked+1;
        v_item_result:=jsonb_build_object(
          'reason','duplicate_review_required',
          'candidate_count',coalesce((v_result->>'candidate_count')::integer,0)
        );
      elsif coalesce((v_result->>'created')::boolean,false) then
        v_person:=(v_result->>'person_id')::bigint;
        v_item_result:=v_result;

        if v_guardian is not null then
          v_guardian_name:=btrim(coalesce(v_guardian->>'name',''));
          v_guardian_relationship:=lower(btrim(coalesce(v_guardian->>'relationship','guardian')));
          v_guardian_phone:=nullif(btrim(coalesce(v_guardian->>'phone','')),'');
          v_guardian_phone_norm:=case when v_guardian_phone is null then null else regexp_replace(v_guardian_phone,'[^0-9+]','','g') end;
          v_guardian_email:=nullif(lower(btrim(coalesce(v_guardian->>'email',''))),'');

          if length(v_guardian_name) not between 2 and 160 then
            raise exception 'guardian name is invalid';
          end if;
          if v_guardian_relationship not in('father','mother','guardian') then
            raise exception 'guardian relationship is invalid';
          end if;
          if v_guardian_phone is not null and length(v_guardian_phone)>40 then
            raise exception 'guardian phone is too long';
          end if;
          if v_guardian_email is not null and length(v_guardian_email)>254 then
            raise exception 'guardian email is too long';
          end if;

          select count(distinct gp.person_id),min(gp.person_id)
          into v_guardian_matches,v_guardian_person
          from public.guardian_profiles gp
          where gp.tenant_id=p_tenant_id
            and (
              (v_guardian_email is not null and exists(
                select 1 from public.person_contacts pc
                where pc.tenant_id=gp.tenant_id and pc.person_id=gp.person_id
                  and pc.type='email' and lower(coalesce(pc.normalized_value,pc.value))=v_guardian_email
              ))

              or
              (v_guardian_phone_norm is not null and exists(
                select 1 from public.person_contacts pc
                where pc.tenant_id=gp.tenant_id and pc.person_id=gp.person_id
                  and pc.type='phone' and coalesce(pc.normalized_value,pc.value)=v_guardian_phone_norm
              ))
            );

          if v_guardian_matches>1 then
            raise exception 'guardian contacts match multiple records';
          end if;

          if v_guardian_person is null then
            insert into public.persons(tenant_id,display_name,preferred_locale,status,metadata)
            values(
              p_tenant_id,v_guardian_name,coalesce(nullif(v_row->>'preferred_locale',''),'en'),
              'active',jsonb_build_object('created_via','student_bulk_import')
            )
            returning id into v_guardian_person;

            insert into public.guardian_profiles(
              person_id,tenant_id,preferred_contact_type,portal_invitation_status
            ) values(
              v_guardian_person,p_tenant_id,
              case when v_guardian_email is not null then 'email' when v_guardian_phone is not null then 'phone' else null end,
              'not_invited'
            );

          else
            v_guardian_linked:=v_guardian_linked+1;
            update public.guardian_profiles
            set preferred_contact_type=case
                  when v_guardian_email is not null then 'email'
                  when preferred_contact_type is null and v_guardian_phone is not null then 'phone'
                  else preferred_contact_type
                end,
                updated_at=now()
            where tenant_id=p_tenant_id and person_id=v_guardian_person;
          end if;

          if v_guardian_email is not null and not exists(
            select 1 from public.person_contacts pc
            where pc.tenant_id=p_tenant_id and pc.person_id=v_guardian_person
              and pc.type='email' and lower(coalesce(pc.normalized_value,pc.value))=v_guardian_email
          ) then
            insert into public.person_contacts(
              tenant_id,person_id,type,label,value,normalized_value,is_primary,is_verified,visibility
            ) values(
              p_tenant_id,v_guardian_person,'email','Primary',v_guardian_email,v_guardian_email,
              true,false,'staff'
            );
          end if;

          if v_guardian_phone is not null and not exists(
            select 1 from public.person_contacts pc
            where pc.tenant_id=p_tenant_id and pc.person_id=v_guardian_person
              and pc.type='phone' and coalesce(pc.normalized_value,pc.value)=v_guardian_phone_norm
          ) then
            insert into public.person_contacts(
              tenant_id,person_id,type,label,value,normalized_value,is_primary,is_verified,visibility
            ) values(
              p_tenant_id,v_guardian_person,'phone','Primary',v_guardian_phone,v_guardian_phone_norm,
              v_guardian_email is null,false,'staff'
            );
          end if;

          insert into public.person_relationships(
            tenant_id,source_person_id,target_person_id,relationship_type,status,
            is_primary,can_collect_student,portal_visibility,verified_at,verified_by_membership_id
          ) values(
            p_tenant_id,v_guardian_person,v_person,v_guardian_relationship,'verified',
            true,true,'standard',now(),v_membership
          )
          on conflict(tenant_id,source_person_id,target_person_id,relationship_type)
          do update set
            status='verified',is_primary=true,can_collect_student=true,
            portal_visibility='standard',verified_at=now(),
            verified_by_membership_id=v_membership,updated_at=now();

          v_item_result:=v_item_result||jsonb_build_object(
            'guardian_person_id',v_guardian_person,
            'guardian_linked_existing',v_guardian_matches=1
          );
        end if;

        v_item_state:='created';
        v_success:=v_success+1;
      else
        v_item_state:='failed';
        v_failed:=v_failed+1;
        v_item_result:=jsonb_build_object('reason','student runtime did not create a record');
      end if;
    exception when others then
      v_item_state:='failed';
      v_failed:=v_failed+1;
      v_item_result:=jsonb_build_object('reason',sqlerrm);
      v_person:=null;
    end;

    insert into public.student_bulk_operation_items(
      tenant_id,job_id,item_number,student_person_id,input_label,state,result
    ) values(
      p_tenant_id,v_job,v_entry.ordinality::integer,v_person,
      left(nullif(v_name,''),160),v_item_state,v_item_result
    );
  end loop;

  v_state:=case
    when v_success=v_total then 'completed'
    when v_success=0 and v_failed>0 then 'failed'
    when v_success=0 and v_blocked>0 and v_failed=0 then 'needs_review'
    else 'partial'
  end;

  update public.student_bulk_operation_jobs
  set state=v_state,
      succeeded_items=v_success,
      blocked_items=v_blocked,
      failed_items=v_failed,
      completed_at=now(),
      summary=summary||jsonb_build_object(
        'created',v_success,
        'needs_review',v_blocked,
        'failed',v_failed,
        'guardian_linked',v_guardian_linked
      )
  where tenant_id=p_tenant_id and id=v_job;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,
    entity_type,entity_id,correlation_id,after_state
  ) values(

    p_tenant_id,p_branch_id,p_identity_id,v_membership,
    'students.bulk.import','succeeded','student_bulk_operation_job',
    v_job::text,gen_random_uuid(),
    jsonb_build_object(
      'state',v_state,'total',v_total,'created',v_success,
      'blocked',v_blocked,'failed',v_failed,'guardian_linked',v_guardian_linked
    )
  );

  return jsonb_build_object(
    'job_id',v_job,
    'state',v_state,
    'total_items',v_total,
    'succeeded_items',v_success,
    'blocked_items',v_blocked,
    'failed_items',v_failed,
    'guardian_linked_items',v_guardian_linked,
    'unchanged',false
  );
end;
$fn$;

revoke all on function public.import_students_batch_v2(
  uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text
) from public,anon,authenticated;
grant execute on function public.import_students_batch_v2(
  uuid,bigint,bigint,bigint,bigint,bigint,date,jsonb,text
) to service_role;

commit;
