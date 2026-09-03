begin;

alter function private.ensure_program_curriculum_draft_v1(bigint,bigint) security invoker;
revoke all on function private.ensure_program_curriculum_draft_v1(bigint,bigint) from public, anon, authenticated, service_role;

commit;
