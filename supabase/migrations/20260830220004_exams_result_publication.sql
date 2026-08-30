create or replace function public.approve_exam_results_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_exam_series_id bigint
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_run bigint;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='assessment.results.approve'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'result approval permission denied'; end if;

  select rr.id into v_run
  from public.result_runs rr
  join public.exam_series es on es.tenant_id=rr.tenant_id and es.id=rr.exam_series_id
  where rr.tenant_id=p_tenant_id and rr.exam_series_id=p_exam_series_id and es.branch_id=p_branch_id and rr.state='calculated'
  order by rr.run_number desc limit 1;
  if v_run is null then raise exception 'no calculated result run is awaiting approval'; end if;

  update public.result_runs
  set state='approved',approved_by_membership_id=v_membership,approved_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=v_run;

  update public.exam_series set state='results_approved',updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=p_exam_series_id;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership,'assessment.results.approve','succeeded','result_run',v_run::text,
    gen_random_uuid(),jsonb_build_object('exam_series_id',p_exam_series_id)
  );

  return jsonb_build_object('result_run_id',v_run,'state','approved');
end;
$fn$;

create or replace function public.publish_exam_results_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_exam_series_id bigint
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_run bigint;
  v_publication bigint;
  v_number integer;
  v_snapshot record;
  v_revision integer;
begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.tenant_id=mr.tenant_id and rp.role_id=mr.role_id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='assessment.results.publish'
    )
  order by m.created_at limit 1;
  if v_membership is null then raise exception 'result publication permission denied'; end if;

  select rr.id into v_run
  from public.result_runs rr
  join public.exam_series es on es.tenant_id=rr.tenant_id and es.id=rr.exam_series_id
  where rr.tenant_id=p_tenant_id and rr.exam_series_id=p_exam_series_id and es.branch_id=p_branch_id and rr.state='approved'
  order by rr.run_number desc limit 1;
  if v_run is null then raise exception 'approved results are required before publication'; end if;

  if exists(
    select 1 from public.result_publications
    where tenant_id=p_tenant_id and result_run_id=v_run and revoked_at is null
  ) then
    select id into v_publication from public.result_publications
    where tenant_id=p_tenant_id and result_run_id=v_run and revoked_at is null
    order by id desc limit 1;
    return jsonb_build_object('publication_id',v_publication,'result_run_id',v_run,'unchanged',true);
  end if;

  v_number:=coalesce((
    select max(publication_number) from public.result_publications
    where tenant_id=p_tenant_id and exam_series_id=p_exam_series_id
  ),0)+1;

  insert into public.result_publications(
    tenant_id,exam_series_id,publication_number,result_run_id,audience,published_by_membership_id,notification_policy_snapshot
  ) values(
    p_tenant_id,p_exam_series_id,v_number,v_run,'portal',v_membership,jsonb_build_object('notify',false,'channel','portal')
  ) returning id into v_publication;

  update public.result_snapshots
  set state='published',published_at=clock_timestamp()
  where tenant_id=p_tenant_id and result_run_id=v_run;

  for v_snapshot in
    select id from public.result_snapshots where tenant_id=p_tenant_id and result_run_id=v_run
  loop
    v_revision:=coalesce((
      select max(revision) from public.report_card_issues
      where tenant_id=p_tenant_id and result_snapshot_id=v_snapshot.id
    ),0)+1;

    insert into public.report_card_issues(
      tenant_id,result_snapshot_id,document_id,revision,template_key,template_version,content_digest
    ) values(
      p_tenant_id,v_snapshot.id,null,v_revision,'standard_report_card',1,
      md5(p_tenant_id::text||':'||v_snapshot.id::text||':'||v_revision::text||':'||v_run::text)
    );
  end loop;

  update public.marksheets ms
  set state='published',published_at=clock_timestamp(),updated_at=clock_timestamp()
  from public.exam_subjects x
  where ms.tenant_id=p_tenant_id and x.tenant_id=ms.tenant_id and x.id=ms.exam_subject_id and x.exam_series_id=p_exam_series_id;

  update public.exam_series set state='results_published',updated_at=clock_timestamp()
  where tenant_id=p_tenant_id and id=p_exam_series_id;

  insert into public.audit_events(
    tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state
  ) values(
    p_tenant_id,p_branch_id,p_identity_id,v_membership,'assessment.results.publish','succeeded','result_publication',v_publication::text,
    gen_random_uuid(),jsonb_build_object('exam_series_id',p_exam_series_id,'result_run_id',v_run,'publication_number',v_number)
  );

  return jsonb_build_object('publication_id',v_publication,'result_run_id',v_run,'publication_number',v_number,'unchanged',false);
end;
$fn$;

revoke all on function public.approve_exam_results_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.publish_exam_results_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.approve_exam_results_v1(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.publish_exam_results_v1(uuid,bigint,bigint,bigint) to service_role;
