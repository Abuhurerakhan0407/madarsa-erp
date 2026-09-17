import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const sql = root("supabase/migrations/20260917210000_portal_guardian_fees.sql");
const lib = root("src/lib/portal/fees.ts");
const portal = root("src/app/portal/page.tsx");
const receipt = root("src/app/portal/fees/receipt/[paymentId]/page.tsx");

describe("guardian fee portal privacy contract", () => {
  it("derives fee visibility from verified guardian relationships and active enrollment", () => {
    expect(sql).toContain("l.link_type = 'guardian'");
    expect(sql).toContain("l.status = 'verified'");
    expect(sql).toContain("rel.status = 'verified'");
    expect(sql).toContain("rel.portal_visibility in ('limited','standard')");
    expect(sql).toContain("e.status in ('active','paused')");
    expect(sql).toContain("a.student_person_id = ls.student_person_id");
    expect(sql).toContain("a.branch_id = ls.branch_id");
  });

  it("keeps guardian finance reads service-role only", () => {
    expect(sql).toMatch(/security definer/i);
    expect(sql).toContain("set search_path = ''");
    expect(sql).toMatch(/revoke all on function public\.get_portal_guardian_fees_v1\(uuid,bigint\)/i);
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/grant execute[\s\S]+to authenticated/i);
  });

  it("requires a verified identity in the server mapper and uses guardian-scoped data for receipts", () => {
    expect(lib).toContain("getVerifiedIdentity");
    expect(lib).toContain("get_portal_guardian_fees_v1");
    expect(receipt).toContain("getPortalGuardianFees");
    expect(receipt).toContain("if (!found) notFound()");
  });

  it("renders guardian fee balances from the parent portal", () => {
    expect(portal).toContain("PortalParentFees");
    expect(portal).toContain("getPortalGuardianFees");
  });
});
