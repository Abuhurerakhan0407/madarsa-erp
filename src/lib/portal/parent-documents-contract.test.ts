import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260917114500_portal_guardian_documents.sql");
const service = read("src/lib/portal/documents.ts");
const idRoute = read("src/app/api/portal/id-card/[personId]/pdf/route.ts");
const statusRoute = read("src/app/api/portal/student-status/[personId]/pdf/route.ts");
const component = read("src/components/portal-parent-documents.tsx");
const page = read("src/app/portal/page.tsx");

describe("parent portal documents contract", () => {
  it("derives document access only from verified guardian relationships", () => {
    expect(migration).toContain("l.link_type = 'guardian'");
    expect(migration).toContain("l.status = 'verified'");
    expect(migration).toContain("rel.status = 'verified'");
    expect(migration).toContain("rel.portal_visibility in ('limited','standard')");
    expect(migration).toContain("rel.target_person_id");
  });

  it("keeps current student ID context branch-safe and active", () => {
    expect(migration).toContain("ee.status in ('active','paused')");
    expect(migration).toContain("b.status = 'active'");
    expect(migration).toContain("order by ee.starts_on desc, ee.id desc");
  });
  it("only exposes active issued status certificates and keeps the RPC server-only", () => {
    expect(migration).toContain("idr.state = 'active'");
    expect(migration).toContain("d.status = 'active'");
    expect(migration).toContain("revoke all on function public.get_portal_guardian_documents_v1(uuid,bigint)");
    expect(migration).toContain("to service_role");
    expect(migration).not.toMatch(/grant\s+execute[^;]+to\s+(anon|authenticated)/i);
  });

  it("generates guardian-scoped ID and status PDFs without requiring an ERP membership", () => {
    expect(service).toContain("get_portal_guardian_documents_v1");
    expect(idRoute).toContain("getPortalGuardianDocuments(tenantId)");
    expect(statusRoute).toContain("getPortalGuardianDocuments(tenantId)");
    expect(idRoute).not.toContain("getTenantContext");
    expect(statusRoute).not.toContain("getTenantContext");
    expect(idRoute).toContain("createUnicodeStudentIdCardSheetPdf");
    expect(statusRoute).toContain("createUnicodeStudentStatusCertificatePdf");
  });

  it("renders private downloads only inside the verified guardian portal", () => {
    expect(page).toContain("<PortalParentDocuments");
    expect(page).toContain("guardianView ? <>");
    expect(component).toContain("/api/portal/id-card/");
    expect(component).toContain("/api/portal/student-status/");
    expect(component.toLowerCase()).not.toContain("student portal");
  });
});
