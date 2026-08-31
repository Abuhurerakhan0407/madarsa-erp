create or replace function public.issue_student_status_certificate_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint,
  p_request_key text
) returns jsonb
language plpgsql
set search_path to ''
as $fn$
declare
  v_membership_id bigint;
  v_template_id bigint;
  v_template_version_id bigint;
  v_job_id bigint;
  v_document_id bigint;
  v_issue_id bigint;
  v_revision integer;
  v_verification_code text;
  v_snapshot jsonb;
  v_input_digest text;
  v_existing_issue public.issued_document_records%rowtype;
  v_today date;
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_student_person_id is null then
    raise exception 'identity, tenant, branch, and student are required';
  end if;
  p_request_key := btrim(coalesce(p_request_key,''));
  if length(p_request_key) not between 16 and 128 then raise exception 'valid certificate request key is required'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(
      select 1 from public.membership_branch_scopes s
      where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id
    ))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='document.job.manage'
    )
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='documents.file.manage'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'certificate issuance permission denied'; end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then
    raise exception 'active branch required';
  end if;

  select id into v_job_id
  from public.document_generation_jobs
  where tenant_id=p_tenant_id and idempotency_key=p_request_key;
  if v_job_id is not null then
    select * into v_existing_issue
    from public.issued_document_records
    where tenant_id=p_tenant_id and generation_job_id=v_job_id
    order by id desc limit 1;
    if v_existing_issue.id is null then raise exception 'certificate request is already in progress'; end if;
    select d.metadata->'content_snapshot' into v_snapshot
    from public.documents d
    where d.tenant_id=p_tenant_id and d.id=v_existing_issue.document_id;
    return jsonb_build_object(
      'issue_id',v_existing_issue.id,'document_id',v_existing_issue.document_id,
      'revision',v_existing_issue.revision,'verification_code',v_existing_issue.verification_code,
      'issued_at',v_existing_issue.issued_at,'snapshot',coalesce(v_snapshot,'{}'::jsonb)
    );
  end if;

  v_today := public.institution_local_date(p_tenant_id);
  select jsonb_build_object(
    'student_person_id',sp.person_id,
    'student_number',sp.student_number,
    'student_name',p.display_name,
    'student_name_native',p.name_native,
    'student_status',sp.status,
    'joined_on',sp.joined_on,
    'tenant_name',t.name,
    'branch_name',b.name,
    'program',coalesce(pr.labels->>'en',pr.key),
    'class_group',coalesce(g.labels->>'en',g.key),
    'academic_session',coalesce(s.labels->>'en',s.key),
    'issued_on',v_today
  ) into v_snapshot
  from public.student_profiles sp
  join public.persons p on p.tenant_id=sp.tenant_id and p.id=sp.person_id
  join public.enrollments e on e.tenant_id=sp.tenant_id and e.student_person_id=sp.person_id and e.branch_id=p_branch_id and e.status='active'
  join public.tenants t on t.id=sp.tenant_id
  join public.branches b on b.tenant_id=sp.tenant_id and b.id=e.branch_id and b.status='active'
  left join public.programs pr on pr.tenant_id=e.tenant_id and pr.id=e.program_id
  left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
  left join public.academic_sessions s on s.tenant_id=e.tenant_id and s.id=e.session_id
  where sp.tenant_id=p_tenant_id and sp.person_id=p_student_person_id and sp.status in('active','admitted')
  order by e.starts_on desc nulls last,e.id desc limit 1;
  if v_snapshot is null then raise exception 'active branch student enrollment required'; end if;

  insert into public.document_templates(tenant_id,key,document_type,labels,state)
  values(p_tenant_id,'student_status_certificate','student_status_certificate',
    jsonb_build_object('en','Student Status Certificate','ur','طالب علم حیثیت سرٹیفکیٹ','ar','شهادة حالة الطالب'),'active')
  on conflict(tenant_id,key) do nothing;
  select id into v_template_id from public.document_templates
  where tenant_id=p_tenant_id and key='student_status_certificate' and state='active';
  if v_template_id is null then raise exception 'student status certificate template is unavailable'; end if;

  insert into public.document_template_versions(
    tenant_id,template_id,version,locale,direction,renderer,source,variables,font_manifest,layout_rules,state,validation_result,published_at
  ) values(
    p_tenant_id,v_template_id,1,'en','ltr','html_pdf','runtime:student_status_certificate_v1',
    jsonb_build_object('required',jsonb_build_array('student_number','student_name','tenant_name','branch_name','program','class_group','issued_on','verification_code')),
    '{}'::jsonb,jsonb_build_object('page','A4','orientation','portrait'),'published',jsonb_build_object('valid',true),now()
  ) on conflict(tenant_id,template_id,version,locale) do nothing;
  select id into v_template_version_id from public.document_template_versions
  where tenant_id=p_tenant_id and template_id=v_template_id and version=1 and locale='en' and state='published';
  if v_template_version_id is null then raise exception 'published student status certificate template is unavailable'; end if;

  select coalesce(max(revision),0)+1 into v_revision
  from public.issued_document_records
  where tenant_id=p_tenant_id and subject_type='student_status_certificate' and subject_id=p_student_person_id::text;
  v_verification_code := 'SSC-'||upper(substr(md5(gen_random_uuid()::text),1,16));
  v_input_digest := md5(v_snapshot::text||':'||v_revision::text);

  insert into public.document_generation_jobs(
    tenant_id,branch_id,template_version_id,job_type,requested_by_membership_id,input_digest,input_reference,
    state,total_items,completed_items,error_summary,idempotency_key,started_at,completed_at
  ) values(
    p_tenant_id,p_branch_id,v_template_version_id,'single',v_membership_id,v_input_digest,
    jsonb_build_object('subject_type','student_status_certificate','student_person_id',p_student_person_id,'revision',v_revision),
    'completed',1,1,'{}'::jsonb,p_request_key,now(),now()
  ) returning id into v_job_id;

  update public.issued_document_records
  set state='superseded',state_reason='Newer student status certificate revision issued'
  where tenant_id=p_tenant_id and subject_type='student_status_certificate' and subject_id=p_student_person_id::text and state='active';

  insert into public.documents(tenant_id,branch_id,category,title,status,visibility,issued_on,metadata)
  values(
    p_tenant_id,p_branch_id,'student_status_certificate',
    'Student Status Certificate — '||coalesce(v_snapshot->>'student_name',v_snapshot->>'student_number'),
    'active','public_verification',v_today,
    jsonb_build_object('content_snapshot',v_snapshot,'renderer','student_status_certificate_v1','revision',v_revision)
  ) returning id into v_document_id;

  insert into public.issued_document_records(
    tenant_id,generation_job_id,template_version_id,document_id,subject_type,subject_id,revision,
    verification_code,content_digest,state,issued_at
  ) values(
    p_tenant_id,v_job_id,v_template_version_id,v_document_id,'student_status_certificate',p_student_person_id::text,v_revision,
    v_verification_code,md5(v_snapshot::text||':'||v_verification_code||':'||v_revision::text),'active',now()
  ) returning id into v_issue_id;

  return jsonb_build_object(
    'issue_id',v_issue_id,'document_id',v_document_id,'revision',v_revision,
    'verification_code',v_verification_code,'issued_at',now(),'snapshot',v_snapshot
  );
end;
$fn$;

create or replace function public.get_student_status_certificate_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_student_person_id bigint
) returns jsonb
language plpgsql
stable
set search_path to ''
as $fn$
declare
  v_membership bigint;
  v_result jsonb;
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
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='documents.file.read'
    )
  order by m.created_at asc limit 1;
  if v_membership is null then raise exception 'document read permission denied'; end if;

  select jsonb_build_object(
    'issue_id',idr.id,'document_id',idr.document_id,'revision',idr.revision,
    'verification_code',idr.verification_code,'issued_at',idr.issued_at,'state',idr.state,
    'snapshot',coalesce(d.metadata->'content_snapshot','{}'::jsonb)
  ) into v_result
  from public.issued_document_records idr
  join public.documents d on d.tenant_id=idr.tenant_id and d.id=idr.document_id
  where idr.tenant_id=p_tenant_id and idr.subject_type='student_status_certificate'
    and idr.subject_id=p_student_person_id::text and idr.state='active'
    and d.branch_id=p_branch_id and d.status='active'
  order by idr.revision desc,idr.id desc limit 1;
  return v_result;
end;
$fn$;

create or replace function public.verify_student_status_certificate_v1(
  p_verification_code text
) returns jsonb
language sql
stable
set search_path to ''
as $fn$
  select jsonb_build_object(
    'valid',true,
    'document_type','student_status_certificate',
    'revision',idr.revision,
    'issued_at',idr.issued_at,
    'verification_code',idr.verification_code,
    'snapshot',coalesce(d.metadata->'content_snapshot','{}'::jsonb)
  )
  from public.issued_document_records idr
  join public.documents d on d.tenant_id=idr.tenant_id and d.id=idr.document_id
  where idr.verification_code=upper(btrim(coalesce(p_verification_code,'')))
    and idr.subject_type='student_status_certificate' and idr.state='active'
    and d.status='active' and d.visibility='public_verification'
  limit 1
$fn$;

revoke all on function public.issue_student_status_certificate_v1(uuid,bigint,bigint,bigint,text) from public,anon,authenticated;
revoke all on function public.get_student_status_certificate_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.verify_student_status_certificate_v1(text) from public,anon,authenticated;
grant execute on function public.issue_student_status_certificate_v1(uuid,bigint,bigint,bigint,text) to service_role;
grant execute on function public.get_student_status_certificate_v1(uuid,bigint,bigint,bigint) to service_role;
grant execute on function public.verify_student_status_certificate_v1(text) to service_role;
