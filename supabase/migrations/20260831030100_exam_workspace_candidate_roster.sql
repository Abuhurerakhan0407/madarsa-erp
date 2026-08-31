create or replace function public.get_exam_results_workspace_v2(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_membership bigint;
  v_exam bigint;
  v_result jsonb;
  v_can_enter boolean:=false;
  v_can_moderate boolean:=false;
  v_can_approve boolean:=false;
  v_can_publish boolean:=false;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id
    ))
  order by m.created_at asc limit 1;
  if v_membership is null then raise exception 'active branch membership required'; end if;

  select exists(
    select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
    where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code='assessment.marks.enter'
  ) into v_can_enter;
  select exists(
    select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
    where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code='assessment.marks.moderate'
  ) into v_can_moderate;
  select exists(
    select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
    where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code='assessment.results.approve'
  ) into v_can_approve;
  select exists(
    select 1 from public.membership_roles mr join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
    where mr.tenant_id=p_tenant_id and mr.membership_id=v_membership and rp.permission_code='assessment.results.publish'
  ) into v_can_publish;
  if not (v_can_enter or v_can_moderate or v_can_approve or v_can_publish) then raise exception 'exam workspace permission denied'; end if;

  select es.id into v_exam
  from public.exam_series es
  where es.tenant_id=p_tenant_id and es.branch_id=p_branch_id
  order by (es.state<>'archived') desc,es.starts_on desc,es.id desc limit 1;

  if v_exam is null then
    return jsonb_build_object(
      'exam',null,'subjects','[]'::jsonb,
      'summary',jsonb_build_object('candidates',0,'subjects',0,'marks_recorded',0,'marks_expected',0,'average_percentage',null),
      'latest_result',null,'can_enter',v_can_enter,'can_moderate',v_can_moderate,'can_approve',v_can_approve,'can_publish',v_can_publish
    );
  end if;

  select jsonb_build_object(
    'exam',jsonb_build_object(
      'id',es.id,'key',es.key,'label',coalesce(es.labels->>'en',es.key),'labels',es.labels,'state',es.state,
      'starts_on',es.starts_on,'ends_on',es.ends_on,'group_id',es.group_id,'group_label',coalesce(g.labels->>'en',g.key)
    ),
    'summary',jsonb_build_object(
      'candidates',(
        select count(*) from public.enrollments e
        where e.tenant_id=es.tenant_id and e.branch_id=es.branch_id and e.session_id=es.session_id and e.program_id=es.program_id
          and (es.group_id is null or e.group_id=es.group_id) and e.status='active'
      ),
      'subjects',(select count(*) from public.exam_subjects x where x.tenant_id=es.tenant_id and x.exam_series_id=es.id),
      'marks_recorded',(
        select count(*) from public.mark_entries me
        join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id
        join public.exam_subjects x on x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id
        where me.tenant_id=es.tenant_id and x.exam_series_id=es.id
      ),
      'marks_expected',(
        (select count(*) from public.enrollments e
         where e.tenant_id=es.tenant_id and e.branch_id=es.branch_id and e.session_id=es.session_id and e.program_id=es.program_id
           and (es.group_id is null or e.group_id=es.group_id) and e.status='active')
        *
        (select count(*) from public.exam_subjects x where x.tenant_id=es.tenant_id and x.exam_series_id=es.id)
      ),
      'average_percentage',(
        select round(avg((me.raw_marks/nullif(ac.maximum_marks,0))*100),1)
        from public.mark_entries me
        join public.assessment_components ac on ac.tenant_id=me.tenant_id and ac.id=me.assessment_component_id
        join public.marksheets ms on ms.tenant_id=me.tenant_id and ms.id=me.marksheet_id
        join public.exam_subjects x on x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id
        where me.tenant_id=es.tenant_id and x.exam_series_id=es.id and me.entry_status='present'
      )
    ),
    'subjects',coalesce((
      select jsonb_agg(jsonb_build_object(
        'exam_subject_id',x.id,
        'subject_id',s.id,
        'subject_key',s.key,
        'subject_name',coalesce(s.labels->>'en',s.key),
        'labels',s.labels,
        'maximum_marks',x.maximum_marks,
        'pass_marks',x.pass_marks,
        'marksheet_id',ms.id,
        'marksheet_state',ms.state,
        'evaluator',teacher.display_name,
        'marks',coalesce((
          select jsonb_agg(jsonb_build_object(
            'mark_entry_id',coalesce(me.id,0),
            'student_person_id',e.student_person_id,
            'student_name',pe.display_name,
            'student_number',sp.student_number,
            'entry_status',coalesce(me.entry_status,'incomplete'),
            'raw_marks',me.raw_marks,
            'comment',me.comment,
            'current_version',coalesce(me.current_version,0)
          ) order by pe.display_name)
          from public.enrollments e
          join public.persons pe on pe.tenant_id=e.tenant_id and pe.id=e.student_person_id
          join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id
          left join public.mark_entries me on me.tenant_id=e.tenant_id and me.marksheet_id=ms.id
            and me.assessment_component_id=ac.id and me.enrollment_id=e.id
          where e.tenant_id=es.tenant_id and e.branch_id=es.branch_id and e.session_id=es.session_id and e.program_id=es.program_id
            and (es.group_id is null or e.group_id=es.group_id) and e.status='active'
        ),'[]'::jsonb)
      ) order by s.key)
      from public.exam_subjects x
      join public.subjects s on s.tenant_id=x.tenant_id and s.id=x.subject_id
      left join lateral (
        select z.* from public.marksheets z
        where z.tenant_id=x.tenant_id and z.exam_subject_id=x.id
          and (z.group_id=es.group_id or (z.group_id is null and es.group_id is null))
        order by z.version desc,z.id desc limit 1
      ) ms on true
      left join lateral (
        select z.* from public.assessment_components z
        where z.tenant_id=x.tenant_id and z.exam_subject_id=x.id and z.entry_mode='marks'
        order by z.sequence,z.id limit 1
      ) ac on true
      left join public.persons teacher on teacher.tenant_id=x.tenant_id and teacher.id=x.evaluator_person_id
      where x.tenant_id=es.tenant_id and x.exam_series_id=es.id
    ),'[]'::jsonb),
    'latest_result',(
      select jsonb_build_object(
        'run_id',rr.id,'run_number',rr.run_number,'state',rr.state,'calculated_at',rr.calculated_at,'approved_at',rr.approved_at,
        'publication_id',pub.id,'published_at',pub.published_at,
        'snapshot',case when rs.id is null then null else jsonb_build_object(
          'id',rs.id,'student_person_id',rs.student_person_id,'percentage',rs.percentage,'aggregate_status',rs.aggregate_status,
          'grade_key',rs.grade_key,'rank_value',rs.rank_value
        ) end
      )
      from public.result_runs rr
      left join lateral (
        select z.* from public.result_publications z
        where z.tenant_id=rr.tenant_id and z.result_run_id=rr.id and z.revoked_at is null
        order by z.id desc limit 1
      ) pub on true
      left join lateral (
        select z.* from public.result_snapshots z
        where z.tenant_id=rr.tenant_id and z.result_run_id=rr.id order by z.id limit 1
      ) rs on true
      where rr.tenant_id=es.tenant_id and rr.exam_series_id=es.id
      order by rr.run_number desc limit 1
    ),
    'can_enter',v_can_enter,'can_moderate',v_can_moderate,'can_approve',v_can_approve,'can_publish',v_can_publish
  ) into v_result
  from public.exam_series es
  left join public.academic_groups g on g.tenant_id=es.tenant_id and g.id=es.group_id
  where es.tenant_id=p_tenant_id and es.id=v_exam;

  return v_result;
end;
$function$;

revoke all on function public.get_exam_results_workspace_v2(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.get_exam_results_workspace_v2(uuid,bigint,bigint) to service_role;
