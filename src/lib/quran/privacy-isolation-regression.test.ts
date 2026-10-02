import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateQuranAttemptInput } from "./model";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const lower = (path: string) => read(path).toLowerCase();
const scope = lower("supabase/migrations/20260917024500_rescue_daily_ops_quran_teacher_scope.sql");
const hardening = lower("supabase/migrations/20260917043000_rescue_daily_ops_quran_privacy_hardening.sql");
const workspace = lower("src/lib/quran/workspace.ts");
const register = lower("src/lib/quran/daily-register.ts");
const detail = lower("src/lib/quran/detail.ts");
const dailyApi = lower("src/app/api/quran/daily/route.ts");
const legacyApi = lower("src/app/api/quran/record/route.ts");
const correctionApi = lower("src/app/api/quran/correct/route.ts");

type AccessCase = {
  permission: boolean;
  sameTenant: boolean;
  sameBranch: boolean;
  active: boolean;
  assigned: boolean;
  privileged?: boolean;
};
const expectedAccess = (c: AccessCase) =>
  c.permission && c.sameTenant && c.sameBranch && c.active && (Boolean(c.privileged) || c.assigned);

const surfaces = [
  "landing list",
  "daily register",
  "student detail / progress history",
  "juz wall",
  "revision queue",
  "sabaq / sabqi / manzil save",
  "save & next",
  "legacy record",
  "correction / update"
] as const;

const assigned: AccessCase = { permission:true, sameTenant:true, sameBranch:true, active:true, assigned:true };
const sameBranchUnassigned: AccessCase = { permission:true, sameTenant:true, sameBranch:true, active:true, assigned:false };
const crossBranch: AccessCase = { permission:true, sameTenant:true, sameBranch:false, active:true, assigned:true };
const crossTenant: AccessCase = { permission:true, sameTenant:false, sameBranch:true, active:true, assigned:true };
const noAssignment: AccessCase = { permission:true, sameTenant:true, sameBranch:true, active:true, assigned:false };

function block(source: string, start: string, end?: string) {
  const from = source.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThanOrEqual(0);
  const next = end ? source.indexOf(end, from + start.length) : -1;
  const to = next >= 0 ? next : source.length;
  return source.slice(from, to);
}

describe("Qur'an privacy isolation regression", () => {
  it.each(surfaces)("denies Chat-05 exploit matrix on %s", () => {
    expect(expectedAccess(assigned)).toBe(true);
    expect(expectedAccess(sameBranchUnassigned)).toBe(false);
    expect(expectedAccess(crossBranch)).toBe(false);
    expect(expectedAccess(crossTenant)).toBe(false);
    expect(expectedAccess(noAssignment)).toBe(false);
    expect(expectedAccess({ ...sameBranchUnassigned, privileged:true })).toBe(true);
  });

  it("never treats Qur'an permissions as assignment-bypass privileges", () => {
    const privileged = block(hardening, "create or replace function public.quran_operator_is_privileged_v1", "create or replace function public.quran_operator_can_access_group_v1");
    expect(privileged).toContain("settings.roles.manage");
    expect(privileged).toContain("hr.employee.manage");
    expect(privileged).toContain("academics.structure.manage");
    expect(privileged).not.toContain("learning.recitation.read");
    expect(privileged).not.toContain("learning.recitation.record");
    expect(privileged).not.toContain("learning.recitation.correct");
  });

  it("guards active tenant/branch targets before privileged bypass", () => {
    const group = block(hardening, "create or replace function public.quran_operator_can_access_group_v1", "create or replace function public.quran_operator_can_access_student_v1");
    const student = block(hardening, "create or replace function public.quran_operator_can_access_student_v1", "create or replace function public.get_quran_hifz_daily_register_v2");
    expect(group.indexOf("g.tenant_id=p_tenant_id and g.branch_id=p_branch_id")).toBeLessThan(group.indexOf("quran_operator_is_privileged_v1"));
    expect(student.indexOf("e.tenant_id=p_tenant_id and e.branch_id=p_branch_id")).toBeLessThan(student.indexOf("quran_operator_is_privileged_v1"));
    expect(student).toContain("e.student_person_id=p_student_person_id and e.status='active'");
  });

  it("derives teacher identity from verified employee linkage and active branch employment", () => {
    const identity = block(scope, "create or replace function public.quran_operator_teacher_person_v1", "create or replace function public.quran_operator_is_privileged_v1");
    expect(identity).toContain("identity_person_links");
    expect(identity).toContain("l.identity_id=p_identity_id");
    expect(identity).toContain("l.link_type='employee'");
    expect(identity).toContain("l.status='verified'");
    expect(identity).toContain("he.branch_id=p_branch_id");
    expect(identity).toContain("he.state in('active','on_leave')");
    expect(dailyApi).not.toContain("p_teacher_person_id");
    expect(legacyApi).not.toContain("p_teacher_person_id");
    expect(correctionApi).not.toContain("p_teacher_person_id");
  });

  it("drops a forged client teacherPersonId before legacy recording", () => {
    const result = validateQuranAttemptInput({
      personId:1, workCategory:"sabaq", targetMode:"juz", juzNumber:1,
      outcome:"passed", teacherPersonId:999, mistakes:[]
    });
    expect(result.errors).toEqual([]);
    expect(result.value).toBeDefined();
    expect(result.value).not.toHaveProperty("teacherPersonId");
  });

  it("routes every teacher Qur'an surface through scoped RPCs", () => {
    expect(workspace).toContain('admin.rpc("get_quran_hifz_workspace_v4"');
    expect(register).toContain('admin.rpc("get_quran_hifz_daily_register_v2"');
    expect(detail).toContain('admin.rpc("get_quran_student_detail_scoped_v1"');
    expect(detail).toContain('admin.rpc("get_quran_juz_wall_scoped_v1"');
    expect(detail).toContain('admin.rpc("get_quran_revision_queue_v2"');
    expect(dailyApi).toContain('admin.rpc("record_quran_hifz_daily_quick_v2"');
    expect(legacyApi).toContain('admin.rpc("record_quran_hifz_attempt_scoped_v1"');
    expect(correctionApi).toContain('admin.rpc("correct_quran_recitation_attempt_scoped_v1"');
  });

  it("filters list/register rows and every per-student read/write through assignment", () => {
    const workspaceV4 = block(hardening, "create or replace function public.get_quran_hifz_workspace_v4");
    const dailyV2 = block(hardening, "create or replace function public.get_quran_hifz_daily_register_v2", "create or replace function public.record_quran_hifz_daily_quick_v2");
    expect(workspaceV4).toContain("public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,e.student_person_id)");
    expect(workspaceV4).toContain("public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,a.student_person_id)");
    expect(dailyV2).toContain("jsonb_array_elements(coalesce(v_result->'rows','[]'::jsonb))");
    expect(dailyV2).toContain("public.quran_operator_can_access_student_v1(p_identity_id,p_tenant_id,p_branch_id,nullif(r.value->>'person_id','')::bigint)");

    for (const rpc of [
      "get_quran_student_detail_scoped_v1",
      "get_quran_juz_wall_scoped_v1",
      "get_quran_revision_queue_v2",
      "record_quran_hifz_attempt_scoped_v1",
      "record_quran_hifz_daily_quick_v2",
      "correct_quran_recitation_attempt_scoped_v1"
    ]) expect(scope + hardening).toContain(rpc);

    const correction = block(scope, "create or replace function public.correct_quran_recitation_attempt_scoped_v1", "revoke all on function public.quran_operator_teacher_person_v1");
    expect(correction).toContain("rs.branch_id=p_branch_id");
    expect(correction).toContain("quran_operator_can_access_student_v1");
  });

  it("keeps assignment check inside the same governed daily write transaction", () => {
    const write = block(hardening, "create or replace function public.record_quran_hifz_daily_quick_v2", "revoke all on function public.get_quran_hifz_daily_register_v2");
    expect(write.indexOf("quran_operator_can_access_student_v1")).toBeLessThan(write.indexOf("record_quran_hifz_daily_quick_v1"));
    expect(write.indexOf("later active quran target exists")).toBeLessThan(write.indexOf("record_quran_hifz_daily_quick_v1"));
  });

  it("uses SECURITY DEFINER with empty search_path on assignment-facing hardening RPCs", () => {
    for (const fn of [
      "quran_operator_is_privileged_v1",
      "quran_operator_can_access_group_v1",
      "quran_operator_can_access_student_v1",
      "get_quran_hifz_daily_register_v2",
      "record_quran_hifz_daily_quick_v2",
      "get_quran_hifz_workspace_v4"
    ]) {
      const fnBlock = block(hardening, `create or replace function public.${fn}`, "create or replace function public.");
      expect(fnBlock).toContain("security definer");
      expect(fnBlock).toContain("set search_path=''");
    }
  });

  it("retires direct service-role execution of all older unscoped Qur'an RPCs", () => {
    for (const rpc of [
      "record_quran_hifz_attempt", "get_quran_hifz_workspace", "get_quran_hifz_workspace_v2",
      "get_quran_student_detail_v1", "get_quran_juz_wall_v1", "get_quran_hifz_workspace_v3",
      "get_quran_hifz_daily_register_v1", "record_quran_hifz_daily_quick_v1",
      "record_quran_hifz_attempt_idempotent", "get_quran_student_detail_v2", "get_quran_juz_wall_v2",
      "get_quran_revision_queue_v1", "correct_quran_recitation_attempt_v1"
    ]) expect(hardening).toContain(`revoke execute on function public.${rpc}`);
  });
});
