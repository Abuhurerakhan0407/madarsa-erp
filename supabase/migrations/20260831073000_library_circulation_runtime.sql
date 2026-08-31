create or replace function public.resolve_library_operator_membership_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint
) returns bigint
language plpgsql stable set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;begin
  select m.id into v_membership
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='library.loan.manage'
    )
  order by m.created_at limit 1;
  return v_membership;
end;$fn$;

create or replace function public.get_library_center_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint
) returns jsonb
language plpgsql stable set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_titles jsonb;v_copies jsonb;v_loans jsonb;v_borrowers jsonb;begin
  v_membership:=public.resolve_library_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'library circulation permission denied';end if;
  if not exists(select 1 from public.branches b where b.tenant_id=p_tenant_id and b.id=p_branch_id and b.status='active') then raise exception 'active branch required';end if;

  select coalesce(jsonb_agg(row_to_json(x) order by x.title_en,x.id),'[]'::jsonb) into v_titles from(
    select t.id,coalesce(nullif(btrim(t.labels->>'en'),''),'Untitled') title_en,t.labels,t.authors,t.publisher,t.category,t.edition,t.isbn,t.classification,t.state,
      count(c.id)::int copy_count,
      count(c.id) filter(where c.branch_id=p_branch_id and c.state='available')::int available_count
    from public.library_titles t
    left join public.library_copies c on c.tenant_id=t.tenant_id and c.title_id=t.id
    where t.tenant_id=p_tenant_id and t.state<>'archived'
    group by t.id
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.accession_number,x.id),'[]'::jsonb) into v_copies from(
    select c.id,c.title_id,c.accession_number,c.condition,
      case when c.state='issued' and exists(select 1 from public.library_loans l where l.tenant_id=c.tenant_id and l.copy_id=c.id and l.state='issued' and l.due_at<now()) then 'overdue' else c.state end state,
      coalesce(nullif(btrim(t.labels->>'en'),''),'Untitled') title_en
    from public.library_copies c join public.library_titles t on t.tenant_id=c.tenant_id and t.id=c.title_id
    where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id and c.state not in('withdrawn')
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.issued_at desc,x.id desc),'[]'::jsonb) into v_loans from(
    select l.id,l.copy_id,l.borrower_person_id,l.issued_at,l.due_at,l.returned_at,
      case when l.state='issued' and l.due_at<now() then 'overdue' else l.state end state,
      l.fine_amount,c.accession_number,coalesce(nullif(btrim(t.labels->>'en'),''),'Untitled') title_en,p.display_name borrower_name
    from public.library_loans l
    join public.library_copies c on c.tenant_id=l.tenant_id and c.id=l.copy_id and c.branch_id=p_branch_id
    join public.library_titles t on t.tenant_id=c.tenant_id and t.id=c.title_id
    join public.persons p on p.tenant_id=l.tenant_id and p.id=l.borrower_person_id
    where l.tenant_id=p_tenant_id
    order by l.issued_at desc,l.id desc limit 100
  )x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.display_name,x.person_id),'[]'::jsonb) into v_borrowers from(
    select distinct p.id person_id,p.display_name,
      sp.student_number,
      ep.employee_number,
      case when sp.person_id is not null then 'student' when ep.person_id is not null then 'employee' else 'person' end borrower_type
    from public.persons p
    left join public.student_profiles sp on sp.tenant_id=p.tenant_id and sp.person_id=p.id and sp.status in('active','admitted')
    left join public.employee_profiles ep on ep.tenant_id=p.tenant_id and ep.person_id=p.id and ep.status='active'
    where p.tenant_id=p_tenant_id and p.status='active'
      and (
        exists(select 1 from public.enrollments e where e.tenant_id=p.tenant_id and e.student_person_id=p.id and e.branch_id=p_branch_id and e.status in('active','paused'))
        or exists(select 1 from public.hr_employments he where he.tenant_id=p.tenant_id and he.employee_person_id=p.id and he.branch_id=p_branch_id and he.state in('active','on_leave'))
      )
  )x;

  return jsonb_build_object('titles',v_titles,'copies',v_copies,'loans',v_loans,'borrowers',v_borrowers);
end;$fn$;

create or replace function public.create_library_title_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_labels jsonb,p_authors jsonb,p_publisher text,p_category text,p_edition text,p_isbn text,p_classification text
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;begin
  v_membership:=public.resolve_library_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'library circulation permission denied';end if;
  if p_labels is null or jsonb_typeof(p_labels)<>'object' or nullif(btrim(coalesce(p_labels->>'en','')),'') is null then raise exception 'English title is required';end if;
  if p_authors is null or jsonb_typeof(p_authors)<>'array' then raise exception 'authors must be an array';end if;
  if length(p_labels::text)>4096 or length(p_authors::text)>4096 then raise exception 'library title metadata is too large';end if;
  insert into public.library_titles(tenant_id,labels,authors,publisher,category,edition,isbn,classification,state)
  values(p_tenant_id,p_labels,p_authors,nullif(btrim(p_publisher),''),nullif(btrim(p_category),''),nullif(btrim(p_edition),''),nullif(btrim(p_isbn),''),nullif(btrim(p_classification),''),'active') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'library.title.create','succeeded','library_title',v_id::text,gen_random_uuid(),jsonb_build_object('labels',p_labels));
  return jsonb_build_object('title_id',v_id,'state','active');
end;$fn$;

create or replace function public.add_library_copy_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_title_id bigint,p_accession_number text,p_condition text
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_condition text:=lower(btrim(coalesce(p_condition,'')));v_accession text:=upper(btrim(coalesce(p_accession_number,'')));begin
  v_membership:=public.resolve_library_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'library circulation permission denied';end if;
  if not exists(select 1 from public.library_titles t where t.tenant_id=p_tenant_id and t.id=p_title_id and t.state='active') then raise exception 'active library title required';end if;
  if length(v_accession)<3 or length(v_accession)>80 then raise exception 'accession number must be 3 to 80 characters';end if;
  if v_condition not in('new','good','fair') then raise exception 'new copy condition must be new, good, or fair';end if;
  insert into public.library_copies(tenant_id,branch_id,title_id,accession_number,condition,state)
  values(p_tenant_id,p_branch_id,p_title_id,v_accession,v_condition,'available') returning id into v_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'library.copy.add','succeeded','library_copy',v_id::text,gen_random_uuid(),jsonb_build_object('title_id',p_title_id,'accession_number',v_accession,'condition',v_condition));
  return jsonb_build_object('copy_id',v_id,'state','available','accession_number',v_accession);
end;$fn$;

create or replace function public.issue_library_loan_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_copy_id bigint,p_borrower_person_id bigint,p_due_at timestamptz
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_id bigint;v_copy public.library_copies%rowtype;begin
  v_membership:=public.resolve_library_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'library circulation permission denied';end if;
  if p_due_at is null or p_due_at<=now()+interval '1 hour' or p_due_at>now()+interval '90 days' then raise exception 'due date must be between one hour and 90 days from now';end if;
  select * into v_copy from public.library_copies c where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id and c.id=p_copy_id for update;
  if v_copy.id is null then raise exception 'library copy not found in branch';end if;
  if v_copy.state<>'available' then raise exception 'library copy is not available';end if;
  if not exists(select 1 from public.persons p where p.tenant_id=p_tenant_id and p.id=p_borrower_person_id and p.status='active') then raise exception 'active borrower required';end if;
  if not (
    exists(select 1 from public.enrollments e where e.tenant_id=p_tenant_id and e.student_person_id=p_borrower_person_id and e.branch_id=p_branch_id and e.status in('active','paused'))
    or exists(select 1 from public.hr_employments he where he.tenant_id=p_tenant_id and he.employee_person_id=p_borrower_person_id and he.branch_id=p_branch_id and he.state in('active','on_leave'))
  ) then raise exception 'borrower is not active in this branch';end if;
  insert into public.library_loans(tenant_id,copy_id,borrower_person_id,issued_at,due_at,state,fine_amount)
  values(p_tenant_id,p_copy_id,p_borrower_person_id,now(),p_due_at,'issued',0) returning id into v_id;
  update public.library_copies set state='issued' where tenant_id=p_tenant_id and id=p_copy_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'library.loan.issue','succeeded','library_loan',v_id::text,gen_random_uuid(),jsonb_build_object('copy_id',p_copy_id,'borrower_person_id',p_borrower_person_id,'due_at',p_due_at));
  return jsonb_build_object('loan_id',v_id,'state','issued','due_at',p_due_at);
end;$fn$;

create or replace function public.return_library_loan_v1(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_loan_id bigint,p_copy_condition text
) returns jsonb
language plpgsql set search_path to pg_catalog,extensions
as $fn$
declare v_membership bigint;v_loan public.library_loans%rowtype;v_condition text:=lower(btrim(coalesce(p_copy_condition,'good')));v_copy_state text;begin
  v_membership:=public.resolve_library_operator_membership_v1(p_identity_id,p_tenant_id,p_branch_id);
  if v_membership is null then raise exception 'library circulation permission denied';end if;
  if v_condition not in('new','good','fair','damaged','lost') then raise exception 'invalid returned copy condition';end if;
  select l.* into v_loan from public.library_loans l join public.library_copies c on c.tenant_id=l.tenant_id and c.id=l.copy_id
  where l.tenant_id=p_tenant_id and l.id=p_loan_id and c.branch_id=p_branch_id for update of l;
  if v_loan.id is null then raise exception 'library loan not found in branch';end if;
  if v_loan.state not in('issued','overdue') or v_loan.returned_at is not null then raise exception 'library loan is already closed';end if;
  v_copy_state:=case when v_condition='lost' then 'lost' when v_condition='damaged' then 'damaged' else 'available' end;
  update public.library_loans set returned_at=now(),state=case when v_condition='lost' then 'lost' when v_condition='damaged' then 'damaged' else 'returned' end where tenant_id=p_tenant_id and id=p_loan_id;
  update public.library_copies set condition=v_condition,state=v_copy_state where tenant_id=p_tenant_id and id=v_loan.copy_id;
  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,after_state)
  values(p_tenant_id,p_branch_id,p_identity_id,v_membership,'library.loan.return','succeeded','library_loan',p_loan_id::text,gen_random_uuid(),jsonb_build_object('copy_id',v_loan.copy_id,'copy_condition',v_condition,'copy_state',v_copy_state));
  return jsonb_build_object('loan_id',p_loan_id,'state',case when v_copy_state='available' then 'returned' else v_copy_state end,'copy_state',v_copy_state);
end;$fn$;

revoke all on function public.resolve_library_operator_membership_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.get_library_center_v1(uuid,bigint,bigint) from public,anon,authenticated;
revoke all on function public.create_library_title_v1(uuid,bigint,bigint,jsonb,jsonb,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.add_library_copy_v1(uuid,bigint,bigint,bigint,text,text) from public,anon,authenticated;
revoke all on function public.issue_library_loan_v1(uuid,bigint,bigint,bigint,bigint,timestamptz) from public,anon,authenticated;
revoke all on function public.return_library_loan_v1(uuid,bigint,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.resolve_library_operator_membership_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.get_library_center_v1(uuid,bigint,bigint) to service_role;
grant execute on function public.create_library_title_v1(uuid,bigint,bigint,jsonb,jsonb,text,text,text,text,text) to service_role;
grant execute on function public.add_library_copy_v1(uuid,bigint,bigint,bigint,text,text) to service_role;
grant execute on function public.issue_library_loan_v1(uuid,bigint,bigint,bigint,bigint,timestamptz) to service_role;
grant execute on function public.return_library_loan_v1(uuid,bigint,bigint,bigint,text) to service_role;