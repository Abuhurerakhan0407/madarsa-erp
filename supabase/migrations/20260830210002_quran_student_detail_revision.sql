create or replace function public.record_quran_hifz_attempt_idempotent(
  p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_request_key text,p_student_person_id bigint,p_work_category text,
  p_juz_number smallint default null,p_start_surah_number smallint default null,p_start_ayah_number integer default null,
  p_end_surah_number smallint default null,p_end_ayah_number integer default null,p_page_start integer default null,p_page_end integer default null,
  p_accuracy_score numeric default null,p_fluency_score numeric default null,p_tajweed_score numeric default null,p_overall_score numeric default null,
  p_prompts integer default null,p_outcome text default 'passed',p_teacher_person_id bigint default null,p_teacher_remark text default null,
  p_parent_visible_remark text default null,p_private_note text default null,p_mistakes jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_key text := nullif(btrim(coalesce(p_request_key,'')),'');
  v_stable_key text;v_existing_session_id bigint;v_existing_attempt_id bigint;v_result jsonb;v_session_id bigint;v_attempt_id bigint;v_revision_id bigint;
  v_local_date date;v_outcome text := lower(btrim(coalesce(p_outcome,'')));v_range_key text;v_completed integer:=0;
begin
  if v_key is null or length(v_key)<16 or length(v_key)>96 then raise exception 'request key must be between 16 and 96 characters'; end if;
  v_stable_key := 'quran-client:'||v_key;v_local_date:=public.institution_local_date(p_tenant_id);
  perform pg_advisory_xact_lock(hashtextextended(format('quran-attempt:%s:%s:%s',p_tenant_id,p_branch_id,v_stable_key),0));
  select rs.id into v_existing_session_id from public.recitation_sessions rs where rs.tenant_id=p_tenant_id and rs.branch_id=p_branch_id and rs.idempotency_key=v_stable_key limit 1;
  if v_existing_session_id is not null then
    select a.id into v_existing_attempt_id from public.recitation_attempts a where a.tenant_id=p_tenant_id and a.recitation_session_id=v_existing_session_id order by a.id asc limit 1;
    return jsonb_build_object('attempt_id',v_existing_attempt_id,'session_id',v_existing_session_id,'replayed',true);
  end if;
  v_result:=public.record_quran_hifz_attempt(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id,p_work_category,p_juz_number,p_start_surah_number,p_start_ayah_number,p_end_surah_number,p_end_ayah_number,p_page_start,p_page_end,p_accuracy_score,p_fluency_score,p_tajweed_score,p_overall_score,p_prompts,p_outcome,p_teacher_person_id,p_teacher_remark,p_parent_visible_remark,p_private_note,p_mistakes);
  v_session_id:=nullif(v_result->>'session_id','')::bigint;v_attempt_id:=nullif(v_result->>'attempt_id','')::bigint;v_revision_id:=nullif(v_result->>'revision_obligation_id','')::bigint;
  update public.recitation_sessions set idempotency_key=v_stable_key,session_date=v_local_date,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_session_id;
  if v_revision_id is not null then update public.revision_obligations set due_on=v_local_date+case when v_outcome='repeat' then 1 else 3 end,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_revision_id;end if;
  v_range_key:=case when p_juz_number is not null then 'juz:'||p_juz_number when p_start_surah_number is not null then format('surah:%s:%s-%s:%s',p_start_surah_number,p_start_ayah_number,p_end_surah_number,p_end_ayah_number) else format('pages:%s-%s',p_page_start,p_page_end) end;
  if v_outcome='passed' then
    update public.revision_obligations set state='completed',completed_by_attempt_id=v_attempt_id,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and student_person_id=p_student_person_id and source_key=v_range_key and state in ('due','assigned','attempted');
    get diagnostics v_completed=row_count;
  end if;
  return v_result||jsonb_build_object('replayed',false,'local_date',v_local_date,'revisions_completed',v_completed);
end;
$function$;

create or replace function public.get_quran_student_detail_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_student_person_id bigint,p_limit integer default 60)
returns jsonb language plpgsql set search_path to '' as $function$
declare
  v_membership_id bigint;v_limit integer:=least(greatest(coalesce(p_limit,60),1),200);v_student jsonb;v_summary jsonb;v_juz_wall jsonb;v_attempts jsonb;v_mistakes jsonb;v_revisions jsonb;
begin
  select m.id into v_membership_id from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.read')
    order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation read permission denied';end if;
  select jsonb_build_object('person_id',p.id,'name',p.display_name,'name_native',p.name_native,'student_number',sp.student_number,'group_id',e.group_id,'group_name',coalesce(g.labels->>'en',g.key)) into v_student
  from public.enrollments e join public.student_profiles sp on sp.tenant_id=e.tenant_id and sp.person_id=e.student_person_id join public.persons p on p.tenant_id=e.tenant_id and p.id=e.student_person_id
  left join public.academic_groups g on g.tenant_id=e.tenant_id and g.id=e.group_id
  where e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id and e.status='active' and sp.status in ('active','admitted') order by e.starts_on desc nulls last,e.id desc limit 1;
  if v_student is null then raise exception 'student is not actively enrolled in this branch';end if;
  select jsonb_build_object('attempts',count(*),'average_score',round(avg(a.overall_score),1),'passed',count(*) filter(where a.outcome='passed'),'repeat',count(*) filter(where a.outcome='repeat'),'last_recorded_at',max(a.occurred_at),'open_revision',(select count(*) from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=p_student_person_id and r.state in ('due','assigned','attempted'))) into v_summary
  from public.recitation_attempts a join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id;
  select coalesce(jsonb_agg(jsonb_build_object('juz',j,'status',coalesce(x.outcome,'not_started'),'score',x.overall_score,'recorded_at',x.occurred_at) order by j),'[]'::jsonb) into v_juz_wall
  from generate_series(1,30) j left join lateral(select a.outcome,a.overall_score,a.occurred_at from public.recitation_attempts a join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id and a.work_category='sabaq' and a.juz_number=j order by a.occurred_at desc,a.id desc limit 1)x on true;
  select coalesce(jsonb_agg(row_to_json(x) order by x.occurred_at desc,x.id desc),'[]'::jsonb) into v_attempts from(
    select a.id,a.work_category,a.outcome,a.accuracy_score,a.fluency_score,a.tajweed_score,a.overall_score,a.prompts,a.teacher_remark,a.parent_visible_remark,a.private_note,a.occurred_at,
      case when a.juz_number is not null then 'Juz '||a.juz_number when a.start_surah_number is not null then format('%s:%s–%s:%s',a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number) else format('Pages %s–%s',a.page_start,a.page_end) end target_label,
      (select coalesce(jsonb_agg(jsonb_build_object('category',m.category_key,'severity',m.severity,'count',m.count,'note',m.note) order by m.id),'[]'::jsonb) from public.recitation_mistakes m where m.tenant_id=a.tenant_id and m.recitation_attempt_id=a.id) mistakes
    from public.recitation_attempts a join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where a.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id order by a.occurred_at desc,a.id desc limit v_limit
  )x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.total_count desc,x.category),'[]'::jsonb) into v_mistakes from(select m.category_key category,sum(m.count)::integer total_count,max(m.severity) max_severity,count(distinct m.recitation_attempt_id)::integer sessions from public.recitation_mistakes m join public.recitation_attempts a on a.tenant_id=m.tenant_id and a.id=m.recitation_attempt_id join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id where m.tenant_id=p_tenant_id and a.student_person_id=p_student_person_id and s.branch_id=p_branch_id group by m.category_key)x;
  select coalesce(jsonb_agg(row_to_json(x) order by x.due_on,x.id),'[]'::jsonb) into v_revisions from(select r.id,r.source_type,r.source_key,r.due_on,r.state,r.created_at,r.completed_by_attempt_id from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=p_student_person_id and r.state<>'cancelled' order by r.due_on desc limit 100)x;
  return jsonb_build_object('student',v_student,'summary',v_summary,'juz_wall',v_juz_wall,'attempts',v_attempts,'mistake_summary',v_mistakes,'revisions',v_revisions);
end;$function$;

create or replace function public.get_quran_revision_queue_v1(p_identity_id uuid,p_tenant_id bigint,p_branch_id bigint,p_state text default 'open',p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql set search_path to '' as $function$
declare v_membership_id bigint;v_page integer:=greatest(coalesce(p_page,1),1);v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);v_local_date date:=public.institution_local_date(p_tenant_id);v_total integer;v_rows jsonb;
begin
  select m.id into v_membership_id from public.memberships m where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active' and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id)) and exists(select 1 from public.membership_roles mr join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.read') order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation read permission denied';end if;
  select count(*)::integer into v_total from public.revision_obligations r where r.tenant_id=p_tenant_id and exists(select 1 from public.enrollments e where e.tenant_id=r.tenant_id and e.student_person_id=r.student_person_id and e.branch_id=p_branch_id and e.status='active') and ((p_state='open' and r.state in('due','assigned','attempted')) or (p_state='completed' and r.state='completed') or p_state='all');
  select coalesce(jsonb_agg(row_to_json(x) order by x.due_on,x.name),'[]'::jsonb) into v_rows from(select r.id,r.student_person_id,p.display_name name,sp.student_number,r.source_type,r.source_key,r.due_on,r.state,(r.due_on<v_local_date and r.state in('due','assigned','attempted')) overdue,r.created_at
    from public.revision_obligations r join public.persons p on p.tenant_id=r.tenant_id and p.id=r.student_person_id join public.student_profiles sp on sp.tenant_id=r.tenant_id and sp.person_id=r.student_person_id
    where r.tenant_id=p_tenant_id and exists(select 1 from public.enrollments e where e.tenant_id=r.tenant_id and e.student_person_id=r.student_person_id and e.branch_id=p_branch_id and e.status='active') and ((p_state='open' and r.state in('due','assigned','attempted')) or (p_state='completed' and r.state='completed') or p_state='all') order by r.due_on,p.display_name limit v_size offset((v_page-1)*v_size))x;
  return jsonb_build_object('local_date',v_local_date,'total',v_total,'page',v_page,'page_size',v_size,'rows',v_rows);
end;$function$;

revoke execute on function public.get_quran_student_detail_v1(uuid,bigint,bigint,bigint,integer) from public,anon,authenticated;grant execute on function public.get_quran_student_detail_v1(uuid,bigint,bigint,bigint,integer) to service_role;
revoke execute on function public.get_quran_revision_queue_v1(uuid,bigint,bigint,text,integer,integer) from public,anon,authenticated;grant execute on function public.get_quran_revision_queue_v1(uuid,bigint,bigint,text,integer,integer) to service_role;
