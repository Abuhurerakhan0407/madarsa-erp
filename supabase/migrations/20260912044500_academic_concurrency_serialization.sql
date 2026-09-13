-- Master audit remediation: FUR-AUD-012.
-- Preserve the existing validated mutation logic, but serialize the complete
-- conflict-check/write transaction at the correct boundary.

alter function public.mutate_academics_timetable_v1(uuid,bigint,bigint,text,jsonb)
  rename to mutate_academics_timetable_v1_unlocked;

create or replace function public.mutate_academics_timetable_v1(
  p_identity_id uuid,
  p_tenant_id bigint,
  p_branch_id bigint,
  p_action text,
  p_payload jsonb
) returns jsonb
language plpgsql
set search_path=''
as $$
begin
  if p_tenant_id is null or p_branch_id is null then raise exception 'tenant and branch are required'; end if;
  -- Coarse branch-level serialization is intentional for correctness. It covers
  -- timetable entries, substitutions/reschedules, slot changes and archive paths
  -- so two requests cannot both pass a stale overlap check before either writes.
  perform pg_advisory_xact_lock(hashtextextended(format('academics_schedule_mutation:%s:%s',p_tenant_id,p_branch_id),0));
  return public.mutate_academics_timetable_v1_unlocked(
    p_identity_id,p_tenant_id,p_branch_id,p_action,p_payload
  );
end;
$$;

revoke all on function public.mutate_academics_timetable_v1_unlocked(uuid,bigint,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.mutate_academics_timetable_v1(uuid,bigint,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_academics_timetable_v1_unlocked(uuid,bigint,bigint,text,jsonb) to service_role;
grant execute on function public.mutate_academics_timetable_v1(uuid,bigint,bigint,text,jsonb) to service_role;

alter function private.ensure_program_curriculum_draft_v1(bigint,bigint)
  rename to ensure_program_curriculum_draft_v1_unlocked;

create or replace function private.ensure_program_curriculum_draft_v1(
  p_tenant_id bigint,
  p_program_id bigint
) returns bigint
language plpgsql
set search_path=''
as $$
begin
  if p_tenant_id is null or p_program_id is null then raise exception 'tenant and program are required'; end if;
  -- This lock is acquired before the legacy helper checks for a draft and before
  -- it computes max(version)+1, eliminating duplicate-version draft races.
  perform pg_advisory_xact_lock(hashtextextended(format('curriculum_draft:%s:%s',p_tenant_id,p_program_id),0));
  return private.ensure_program_curriculum_draft_v1_unlocked(p_tenant_id,p_program_id);
end;
$$;

revoke all on function private.ensure_program_curriculum_draft_v1_unlocked(bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function private.ensure_program_curriculum_draft_v1(bigint,bigint) from public,anon,authenticated,service_role;
