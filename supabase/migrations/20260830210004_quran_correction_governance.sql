create table public.recitation_attempt_corrections (
  id bigint generated always as identity primary key,
  tenant_id bigint not null,
  branch_id bigint not null,
  recitation_attempt_id bigint not null,
  request_key text not null,
  corrected_by_identity_id uuid not null,
  corrected_by_membership_id bigint not null,
  reason text not null,
  accuracy_score numeric,
  fluency_score numeric,
  tajweed_score numeric,
  overall_score numeric,
  prompts integer,
  outcome text not null,
  teacher_remark text,
  parent_visible_remark text,
  private_note text,
  created_at timestamptz not null default clock_timestamp(),
  constraint recitation_attempt_corrections_tenant_fk foreign key (tenant_id) references public.tenants(id) on delete restrict,
  constraint recitation_attempt_corrections_branch_fk foreign key (tenant_id,branch_id) references public.branches(tenant_id,id) on delete restrict,
  constraint recitation_attempt_corrections_attempt_fk foreign key (tenant_id,recitation_attempt_id) references public.recitation_attempts(tenant_id,id) on delete restrict,
  constraint recitation_attempt_corrections_membership_fk foreign key (tenant_id,corrected_by_membership_id) references public.memberships(tenant_id,id) on delete restrict,
  constraint recitation_attempt_corrections_request_key_unique unique (tenant_id,branch_id,request_key),
  constraint recitation_attempt_corrections_reason_check check (length(btrim(reason)) between 5 and 500),
  constraint recitation_attempt_corrections_outcome_check check (outcome in ('passed','partial','repeat','excused','not_attempted')),
  constraint recitation_attempt_corrections_accuracy_check check (accuracy_score is null or accuracy_score between 0 and 100),
  constraint recitation_attempt_corrections_fluency_check check (fluency_score is null or fluency_score between 0 and 100),
  constraint recitation_attempt_corrections_tajweed_check check (tajweed_score is null or tajweed_score between 0 and 100),
  constraint recitation_attempt_corrections_overall_check check (overall_score is null or overall_score between 0 and 100),
  constraint recitation_attempt_corrections_prompts_check check (prompts is null or prompts >= 0),
  constraint recitation_attempt_corrections_teacher_remark_check check (teacher_remark is null or length(teacher_remark) <= 1000),
  constraint recitation_attempt_corrections_parent_remark_check check (parent_visible_remark is null or length(parent_visible_remark) <= 1000),
  constraint recitation_attempt_corrections_private_note_check check (private_note is null or length(private_note) <= 1000)
);

create index recitation_attempt_corrections_attempt_idx
  on public.recitation_attempt_corrections(tenant_id,recitation_attempt_id,created_at desc,id desc);
create index recitation_attempt_corrections_branch_date_idx
  on public.recitation_attempt_corrections(tenant_id,branch_id,created_at desc);

alter table public.recitation_attempt_corrections enable row level security;

create trigger recitation_attempt_corrections_append_only
before update or delete on public.recitation_attempt_corrections
for each row execute function private.reject_append_only_mutation();

revoke all on table public.recitation_attempt_corrections from public,anon,authenticated;
grant select,insert on table public.recitation_attempt_corrections to service_role;
grant usage,select on sequence public.recitation_attempt_corrections_id_seq to service_role;

create or replace function public.correct_quran_recitation_attempt_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_request_key text,
  p_recitation_attempt_id bigint,
  p_reason text,
  p_accuracy_score numeric,
  p_fluency_score numeric,
  p_tajweed_score numeric,
  p_overall_score numeric,
  p_prompts integer,
  p_outcome text,
  p_teacher_remark text default null,
  p_parent_visible_remark text default null,
  p_private_note text default null
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_stable_key text;
  v_existing_id bigint;
  v_existing_attempt_id bigint;
  v_student_person_id bigint;
  v_juz_number smallint;
  v_start_surah smallint;
  v_start_ayah integer;
  v_end_surah smallint;
  v_end_ayah integer;
  v_page_start integer;
  v_page_end integer;
  v_start_reference_id bigint;
  v_end_reference_id bigint;
  v_range_key text;
  v_outcome text := lower(btrim(coalesce(p_outcome,'')));
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_correction_id bigint;
  v_completed integer := 0;
  v_created_revision_id bigint;
  v_local_date date := public.institution_local_date(p_tenant_id);
begin
  if p_identity_id is null or p_tenant_id is null or p_branch_id is null or p_recitation_attempt_id is null then
    raise exception 'identity, tenant, branch, and attempt are required';
  end if;
  if p_request_key is null or length(btrim(p_request_key)) < 16 or length(btrim(p_request_key)) > 96 then
    raise exception 'request key must be between 16 and 96 characters';
  end if;
  if v_reason is null or length(v_reason) < 5 or length(v_reason) > 500 then raise exception 'correction reason must be between 5 and 500 characters'; end if;
  if v_outcome not in ('passed','partial','repeat','excused','not_attempted') then raise exception 'recitation outcome is invalid'; end if;
  if p_accuracy_score is not null and (p_accuracy_score < 0 or p_accuracy_score > 100) then raise exception 'accuracy score is invalid'; end if;
  if p_fluency_score is not null and (p_fluency_score < 0 or p_fluency_score > 100) then raise exception 'fluency score is invalid'; end if;
  if p_tajweed_score is not null and (p_tajweed_score < 0 or p_tajweed_score > 100) then raise exception 'tajweed score is invalid'; end if;
  if p_overall_score is not null and (p_overall_score < 0 or p_overall_score > 100) then raise exception 'overall score is invalid'; end if;
  if p_prompts is not null and p_prompts < 0 then raise exception 'prompts cannot be negative'; end if;
  if p_teacher_remark is not null and length(p_teacher_remark) > 1000 then raise exception 'teacher remark is too long'; end if;
  if p_parent_visible_remark is not null and length(p_parent_visible_remark) > 1000 then raise exception 'parent remark is too long'; end if;
  if p_private_note is not null and length(p_private_note) > 1000 then raise exception 'private note is too long'; end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id=p_tenant_id and m.identity_id=p_identity_id and m.status='active'
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    and (m.all_branches or exists(select 1 from public.membership_branch_scopes s where s.tenant_id=m.tenant_id and s.membership_id=m.id and s.branch_id=p_branch_id))
    and exists(
      select 1 from public.membership_roles mr
      join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id and r.status='active'
      join public.role_permissions rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id
      where mr.tenant_id=m.tenant_id and mr.membership_id=m.id and rp.permission_code='learning.recitation.correct'
    )
  order by m.created_at asc limit 1;
  if v_membership_id is null then raise exception 'Quran recitation correction permission denied'; end if;

  v_stable_key := 'quran-correction:' || btrim(p_request_key);
  perform pg_advisory_xact_lock(hashtextextended(format('quran-correction:%s:%s:%s',p_tenant_id,p_branch_id,v_stable_key),0));

  select c.id,c.recitation_attempt_id into v_existing_id,v_existing_attempt_id
  from public.recitation_attempt_corrections c
  where c.tenant_id=p_tenant_id and c.branch_id=p_branch_id and c.request_key=v_stable_key
  order by c.id desc limit 1;
  if v_existing_id is not null then
    return jsonb_build_object('correction_id',v_existing_id,'attempt_id',v_existing_attempt_id,'replayed',true);
  end if;

  select a.student_person_id,a.juz_number,a.start_surah_number,a.start_ayah_number,a.end_surah_number,a.end_ayah_number,a.page_start,a.page_end,a.start_reference_id,a.end_reference_id
  into v_student_person_id,v_juz_number,v_start_surah,v_start_ayah,v_end_surah,v_end_ayah,v_page_start,v_page_end,v_start_reference_id,v_end_reference_id
  from public.recitation_attempts a
  join public.recitation_sessions s on s.tenant_id=a.tenant_id and s.id=a.recitation_session_id
  where a.tenant_id=p_tenant_id and a.id=p_recitation_attempt_id and s.branch_id=p_branch_id
  limit 1;
  if v_student_person_id is null then raise exception 'recitation attempt was not found in this branch'; end if;

  insert into public.recitation_attempt_corrections(
    tenant_id,branch_id,recitation_attempt_id,request_key,corrected_by_identity_id,corrected_by_membership_id,reason,
    accuracy_score,fluency_score,tajweed_score,overall_score,prompts,outcome,teacher_remark,parent_visible_remark,private_note
  ) values(
    p_tenant_id,p_branch_id,p_recitation_attempt_id,v_stable_key,p_identity_id,v_membership_id,v_reason,
    p_accuracy_score,p_fluency_score,p_tajweed_score,p_overall_score,p_prompts,v_outcome,
    nullif(btrim(coalesce(p_teacher_remark,'')),''),nullif(btrim(coalesce(p_parent_visible_remark,'')),''),nullif(btrim(coalesce(p_private_note,'')),'')
  ) returning id into v_correction_id;

  v_range_key := case
    when v_juz_number is not null then 'juz:'||v_juz_number
    when v_start_surah is not null then format('surah:%s:%s-%s:%s',v_start_surah,v_start_ayah,v_end_surah,v_end_ayah)
    else format('pages:%s-%s',v_page_start,v_page_end)
  end;

  if v_outcome='passed' then
    update public.revision_obligations
    set state='completed',completed_by_attempt_id=p_recitation_attempt_id,updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and student_person_id=v_student_person_id and source_key=v_range_key and state in ('due','assigned','attempted');
    get diagnostics v_completed=row_count;
  elsif v_outcome='repeat' or (p_overall_score is not null and p_overall_score<70) then
    if not exists(
      select 1 from public.revision_obligations r
      where r.tenant_id=p_tenant_id and r.student_person_id=v_student_person_id and r.source_key=v_range_key and r.state in ('due','assigned','attempted')
    ) then
      insert into public.revision_obligations(tenant_id,student_person_id,learning_plan_id,source_type,source_key,start_reference_id,end_reference_id,reading_unit_id,due_on,state)
      values(p_tenant_id,v_student_person_id,null,case when v_outcome='repeat' then 'missed_work' else 'weak_score' end,v_range_key,v_start_reference_id,v_end_reference_id,null,v_local_date+case when v_outcome='repeat' then 1 else 3 end,'due')
      returning id into v_created_revision_id;
    end if;
  end if;

  insert into public.audit_events(tenant_id,branch_id,actor_identity_id,actor_membership_id,action,outcome,entity_type,entity_id,correlation_id,before_state,after_state)
  select p_tenant_id,p_branch_id,p_identity_id,v_membership_id,'learning.recitation.correct','succeeded','recitation_attempt',p_recitation_attempt_id::text,gen_random_uuid(),
    jsonb_build_object('accuracy_score',a.accuracy_score,'fluency_score',a.fluency_score,'tajweed_score',a.tajweed_score,'overall_score',a.overall_score,'prompts',a.prompts,'outcome',a.outcome,'teacher_remark',a.teacher_remark,'parent_visible_remark',a.parent_visible_remark),
    jsonb_build_object('correction_id',v_correction_id,'reason',v_reason,'accuracy_score',p_accuracy_score,'fluency_score',p_fluency_score,'tajweed_score',p_tajweed_score,'overall_score',p_overall_score,'prompts',p_prompts,'outcome',v_outcome,'teacher_remark',p_teacher_remark,'parent_visible_remark',p_parent_visible_remark,'revision_completed',v_completed,'revision_created',v_created_revision_id)
  from public.recitation_attempts a where a.tenant_id=p_tenant_id and a.id=p_recitation_attempt_id;

  return jsonb_build_object('correction_id',v_correction_id,'attempt_id',p_recitation_attempt_id,'outcome',v_outcome,'replayed',false,'revisions_completed',v_completed,'revision_created',v_created_revision_id);
end;
$function$;

revoke execute on function public.correct_quran_recitation_attempt_v1(uuid,bigint,bigint,text,bigint,text,numeric,numeric,numeric,numeric,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.correct_quran_recitation_attempt_v1(uuid,bigint,bigint,text,bigint,text,numeric,numeric,numeric,numeric,integer,text,text,text,text) to service_role;
