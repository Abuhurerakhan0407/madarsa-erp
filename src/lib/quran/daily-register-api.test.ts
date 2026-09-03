import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(resolve(process.cwd(), "src/app/api/quran/daily/route.ts"), "utf8");

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

  it("protects later active targets before a backdated real lesson mutation", () => {
    expect(route).toContain('.from("quran_student_targets")');
    expect(route).toContain('.eq("tenant_id", workspace.tenantId)');
    expect(route).toContain('.eq("branch_id", workspace.branchId)');
    expect(route).toContain('.eq("student_person_id", value.personId)');
    expect(route).toContain('.eq("work_category", value.workCategory)');
    expect(route).toContain('.gt("assigned_on", value.sessionDate)');
    expect(route).toContain("A later active Qur'an target already exists");
  });

  it("uses the governed Phase 4 database RPC", () => {
    expect(route).toContain('admin.rpc("record_quran_hifz_daily_quick_v1"');
    expect(route).toContain('"cache-control": "no-store"');
  });
});
