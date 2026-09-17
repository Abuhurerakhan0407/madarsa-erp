import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(resolve(process.cwd(), "src/app/api/quran/daily/route.ts"), "utf8");
const scopeMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260917024500_rescue_daily_ops_quran_teacher_scope.sql"), "utf8").toLowerCase();

describe("Qur'an daily register API contract", () => {
  it("keeps mutation boundaries ahead of privileged work", () => {
    expect(route).toContain("isSameOriginRequest(request)");
    expect(route).toContain("isJsonRequest(request)");
    expect(route).toContain("readBoundedJson(request, 24_576)");
    expect(route.indexOf("validateQuranDailyQuickInput")).toBeLessThan(route.indexOf("getVerifiedIdentity()"));
  });

  it("derives tenant and branch from verified workspace rather than browser input", () => {
    expect(route).toContain("p_tenant_id: workspace.tenantId");
    expect(route).toContain("p_branch_id: workspace.branchId");
    expect(route).toContain("p_identity_id: identity.id");
    expect(route).not.toContain("parsed.value.tenantId");
    expect(route).not.toContain("parsed.value.branchId");
  });

  it("authorizes assignment before checking later active targets", () => {
    expect(route).not.toContain('.from("quran_student_targets")');
    expect(scopeMigration).toContain("quran_operator_can_access_student_v1");
    expect(scopeMigration).toContain("later active quran target exists");
    expect(scopeMigration.indexOf("quran_operator_can_access_student_v1")).toBeLessThan(scopeMigration.indexOf("later active quran target exists"));
    expect(route).toContain("A later active Qur'an target already exists");
  });

  it("uses the governed Phase 4 database RPC", () => {
    expect(route).toContain('admin.rpc("record_quran_hifz_daily_quick_v2"');
    expect(route).toContain('"cache-control": "no-store"');
  });
});
