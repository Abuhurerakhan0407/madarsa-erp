import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260917113000_portal_guardian_report_card_read.sql").toLowerCase();
const helper = read("src/lib/portal/report-card.ts");
const route = read("src/app/api/portal/report-card/[personId]/pdf/route.ts");
const overview = read("src/components/portal-parent-priority-overview.tsx");

describe("guardian report card portal contract", () => {
  it("requires the exact verified guardian-child relationship", () => {
    expect(migration).toContain("l.identity_id=p_identity_id");
    expect(migration).toContain("l.link_type='guardian'");
    expect(migration).toContain("l.status='verified'");
    expect(migration).toContain("pr.target_person_id=p_student_person_id");
    expect(migration).toContain("pr.status='verified'");
    expect(migration).toContain("pr.portal_visibility in('limited','standard')");
  });

  it("returns only an active published result with an issued report card", () => {
    expect(migration).toContain("rs.state='published'");
    expect(migration).toContain("rp.revoked_at is null");
    expect(migration).toContain("public.report_card_issues");
    expect(migration).toContain("rr.exam_series_id=p_exam_series_id");
  });
  it("keeps the guardian report-card RPC service-role only", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path to 'pg_catalog','extensions'");
    expect(migration).toContain("revoke all on function public.get_guardian_report_card_v1(uuid,bigint,bigint,bigint) from public,anon,authenticated");
    expect(migration).toContain("grant execute on function public.get_guardian_report_card_v1(uuid,bigint,bigint,bigint) to service_role");
  });

  it("generates the parent download through the guardian-scoped RPC without office membership", () => {
    expect(helper).toContain('admin.rpc("get_guardian_report_card_v1"');
    expect(route).toContain("getPortalReportCard(tenantId, personId, examId)");
    expect(route).not.toContain("getTenantContext");
    expect(route).toContain('"cache-control": "private, no-store"');
  });

  it("links each published result to its own student and exam", () => {
    expect(overview).toContain("/api/portal/report-card/${num(item.student_person_id)}/pdf?tenant=${tenantId}&exam=${num(item.exam_id)}");
    expect(overview).toContain("Download report card");
    expect(overview).toContain("رپورٹ کارڈ ڈاؤن لوڈ کریں");
  });
});
