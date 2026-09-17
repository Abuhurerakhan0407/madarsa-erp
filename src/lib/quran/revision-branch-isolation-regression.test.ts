import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();
const migrationPath = "supabase/migrations/20260917060000_rescue_daily_ops_quran_revision_branch_isolation.sql";
const migration = read(migrationPath);
const scopeMigration = read("supabase/migrations/20260917024500_rescue_daily_ops_quran_teacher_scope.sql");
const preScope = scopeMigration;
const preDetail = read("supabase/migrations/20260830210005_quran_effective_read_models.sql");
const preIdempotent = read("supabase/migrations/20260830210002_quran_student_detail_revision.sql");
const preCorrection = read("supabase/migrations/20260830210004_quran_correction_governance.sql");

function sourceBlock(source: string, start: string, end?: string) {
  const from = source.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThanOrEqual(0);
  const next = end ? source.indexOf(end, from + start.length) : -1;
  return source.slice(from, next >= 0 ? next : source.length);
}

function block(start: string, end?: string) {
  const from = migration.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThanOrEqual(0);
  const next = end ? migration.indexOf(end, from + start.length) : -1;
  return migration.slice(from, next >= 0 ? next : migration.length);
}

type RevisionAccessCase = {
  permission: boolean;
  sameTenant: boolean;
  activeBranch: boolean;
  studentInBranch: boolean;
  assigned: boolean;
  privileged?: boolean;
  provenanceValid: boolean;
  sourceBranchMatches: boolean;
};

const canAccessRevision = (c: RevisionAccessCase) =>
  c.permission && c.sameTenant && c.activeBranch && c.studentInBranch &&
  c.provenanceValid && c.sourceBranchMatches && (c.assigned || Boolean(c.privileged));

describe("Qur'an revision branch provenance", () => {
  it("reproduces the pre-fix branchless authorization contract", () => {
    const queue = sourceBlock(preScope, "create or replace function public.get_quran_revision_queue_v2", "create or replace function public.correct_quran_recitation_attempt_scoped_v1");
    const detail = sourceBlock(preDetail, "create or replace function public.get_quran_student_detail_v2");
    const idempotent = sourceBlock(preIdempotent, "create or replace function public.record_quran_hifz_attempt_idempotent", "create or replace function public.get_quran_student_detail_v1");
    const correction = sourceBlock(preCorrection, "create or replace function public.correct_quran_recitation_attempt_v1");
    expect(queue).toContain("quran_operator_can_access_student_v1");
    expect(queue).not.toContain("recitation_sessions");
    expect(detail).toContain("from public.revision_obligations r where r.tenant_id=p_tenant_id and r.student_person_id=p_student_person_id");
    expect(detail).not.toContain("source_recitation_attempt_id");
    expect(idempotent).toContain("student_person_id=p_student_person_id and source_key=v_range_key");
    expect(idempotent).not.toContain("source_recitation_attempt_id");
    expect(correction).toContain("student_person_id=v_student_person_id and source_key=v_range_key");
    expect(correction).not.toContain("source_recitation_attempt_id");
  });
  it("models the Chat-05 branch-isolation matrix and the pre-fix transfer failure", () => {
    const base: RevisionAccessCase = {
      permission:true, sameTenant:true, activeBranch:true, studentInBranch:true,
      assigned:true, provenanceValid:true, sourceBranchMatches:true
    };
    expect(canAccessRevision(base)).toBe(true); // assigned same-branch
    expect(canAccessRevision({ ...base, assigned:false })).toBe(false); // unassigned same-branch / permission-only
    expect(canAccessRevision({ ...base, sourceBranchMatches:false })).toBe(false); // branch-B source
    expect(canAccessRevision({ ...base, sourceBranchMatches:false, studentInBranch:true })).toBe(false); // transferred student, historical B source
    expect(canAccessRevision({ ...base, sameTenant:false })).toBe(false);
    expect(canAccessRevision({ ...base, provenanceValid:false })).toBe(false); // forged/ambiguous identifier
    expect(canAccessRevision({ ...base, assigned:false, privileged:true })).toBe(true);
    expect(canAccessRevision({ ...base, assigned:false, privileged:true, sourceBranchMatches:false })).toBe(false);

    // Old policy used current student assignment only, so this transfer case was incorrectly reachable.
    const oldStudentOnlyPolicy = base.permission && base.sameTenant && base.activeBranch && base.studentInBranch && base.assigned;
    expect(oldStudentOnlyPolicy).toBe(true);
    expect(canAccessRevision({ ...base, sourceBranchMatches:false })).toBe(false);
  });

  it("stores immutable source-attempt provenance instead of inferring branch from current enrollment", () => {
    expect(migration).toContain("add column if not exists source_recitation_attempt_id bigint");
    expect(migration).toContain("foreign key (tenant_id,source_recitation_attempt_id)");
    expect(migration).toContain("references public.recitation_attempts(tenant_id,id)");
    const helper = block("create or replace function public.quran_revision_obligation_in_branch_v1", "create or replace function public.record_quran_hifz_attempt");
    expect(helper).toContain("a.id=r.source_recitation_attempt_id");
    expect(helper).toContain("a.student_person_id=r.student_person_id");
    expect(helper).toContain("s.id=a.recitation_session_id");
    expect(helper).toContain("s.branch_id=p_branch_id");
    expect(helper).not.toContain("public.enrollments");
  });

  it("filters every revision read by proven source branch", () => {
    const queue = block("create or replace function public.get_quran_revision_queue_v2", "create or replace function public.get_quran_student_detail_v2");
    const detail = block("create or replace function public.get_quran_student_detail_v2", "create or replace function public.get_quran_hifz_workspace_v4");
    const workspace = block("create or replace function public.get_quran_hifz_workspace_v4", "create or replace function public.get_quran_hifz_daily_register_v2");
    const register = block("create or replace function public.get_quran_hifz_daily_register_v2", "create or replace function public.correct_quran_recitation_attempt_v1");
    for (const sql of [queue, detail, workspace, register]) {
      expect(sql).toContain("quran_revision_obligation_in_branch_v1");
    }
    expect(queue).toContain("quran_operator_can_access_student_v1");
    expect(detail).toContain("r.student_person_id=p_student_person_id");
  });

  it("binds newly created revisions to the exact attempt and session branch", () => {
    const record = block("create or replace function public.record_quran_hifz_attempt", "create or replace function public.record_quran_hifz_attempt_idempotent");
    expect(record).toContain("source_recitation_attempt_id");
    expect(record).toContain("v_attempt_id");
    expect(record).toContain("recitation_sessions");
    expect(record).toContain("branch_id");
  });

  it("prevents source-key collisions from completing another branch's revision", () => {
    const idempotent = block("create or replace function public.record_quran_hifz_attempt_idempotent", "create or replace function public.get_quran_revision_queue_v2");
    expect(idempotent).toContain("source_key=v_range_key");
    expect(idempotent).toContain("quran_revision_obligation_in_branch_v1");
    expect(idempotent).toContain("p_branch_id");
  });

  it("keeps correction target and revision mutations on the same proven branch", () => {
    const correction = block("create or replace function public.correct_quran_recitation_attempt_v1", "create or replace function public.correct_quran_recitation_attempt_scoped_v1");
    expect(correction).toContain("s.branch_id=p_branch_id");
    expect(correction).toContain("source_recitation_attempt_id");
    expect(correction).toContain("quran_revision_obligation_in_branch_v1");
    const wrapper = block("create or replace function public.correct_quran_recitation_attempt_scoped_v1", "revoke all on function public.quran_revision_obligation_in_branch_v1");
    expect(wrapper).toContain("rs.branch_id=p_branch_id");
    expect(wrapper).toContain("a.id=p_recitation_attempt_id");
    expect(wrapper).toContain("quran_operator_can_access_student_v1");
  });

  it("binds legacy record replay keys to the exact student and source target", () => {
    const idempotent = block("create or replace function public.record_quran_hifz_attempt_idempotent", "create or replace function public.record_quran_hifz_daily_quick_v1");
    expect(idempotent).toContain("request key is already bound to another quran target");
    expect(idempotent).toContain("a.student_person_id=p_student_person_id");
    expect(idempotent).toContain("a.work_category=lower(btrim(coalesce(p_work_category,'')))");
    expect(idempotent).toContain("a.juz_number is not distinct from p_juz_number");
    expect(idempotent).toContain("a.page_end is not distinct from p_page_end");
  });

  it("binds correction replay keys to the exact attempt", () => {
    const correction = block("create or replace function public.correct_quran_recitation_attempt_v1", "create or replace function public.correct_quran_recitation_attempt_scoped_v1");
    expect(correction).toContain("v_existing_attempt_id<>p_recitation_attempt_id");
    expect(correction).toContain("request key is already bound to another recitation attempt");
  });

  it("keeps legacy record and correction wrappers bound to the validated tenant/branch/student target", () => {
    const legacyWrapperStart = scopeMigration.indexOf("create or replace function public.record_quran_hifz_attempt_scoped_v1");
    const legacyWrapperEnd = scopeMigration.indexOf("create or replace function public.get_quran_student_detail_scoped_v1", legacyWrapperStart);
    const legacyWrapper = scopeMigration.slice(legacyWrapperStart, legacyWrapperEnd);
    expect(legacyWrapper).toContain("quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id)");
    expect(legacyWrapper).toContain("record_quran_hifz_attempt_idempotent(p_identity_id,p_tenant_id,p_branch_id,p_request_key,p_student_person_id");

    const idempotent = block("create or replace function public.record_quran_hifz_attempt_idempotent", "create or replace function public.record_quran_hifz_daily_quick_v1");
    expect(idempotent).toContain("record_quran_hifz_attempt(p_identity_id,p_tenant_id,p_branch_id,p_student_person_id");
    const record = block("create or replace function public.record_quran_hifz_attempt", "create or replace function public.record_quran_hifz_attempt_idempotent");
    expect(record).toContain("e.tenant_id=p_tenant_id and e.branch_id=p_branch_id and e.student_person_id=p_student_person_id");

    const correctionWrapper = block("create or replace function public.correct_quran_recitation_attempt_scoped_v1", "revoke all on function public.enforce_quran_revision_source_provenance_v1");
    expect(correctionWrapper).toContain("a.id=p_recitation_attempt_id and rs.branch_id=p_branch_id");
    expect(correctionWrapper).toContain("correct_quran_recitation_attempt_v1(p_identity_id,p_tenant_id,p_branch_id,p_request_key,p_recitation_attempt_id");
  });

  it("fails closed for legacy obligations whose source branch cannot be proven", () => {
    const helper = block("create or replace function public.quran_revision_obligation_in_branch_v1", "create or replace function public.record_quran_hifz_attempt");
    expect(helper).toContain("r.source_recitation_attempt_id is not null");
    expect(migration).not.toContain("update public.revision_obligations set source_recitation_attempt_id");
  });

  it("keeps administrative bypass branch-bound", () => {
    const queue = block("create or replace function public.get_quran_revision_queue_v2", "create or replace function public.get_quran_student_detail_v2");
    expect(queue).toContain("quran_revision_obligation_in_branch_v1");
    expect(queue).toContain("quran_operator_can_access_student_v1");
  });
});
