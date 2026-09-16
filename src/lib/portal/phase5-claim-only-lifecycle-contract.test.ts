import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 5 claim-only portal lifecycle", () => {
  it("retires the legacy credential endpoint without any password or Auth-admin mutation", () => {
    const route = read("src/app/api/portals/credentials/route.ts");
    expect(route).toContain("PORTAL_CREDENTIALS_RETIRED");
    expect(route).toContain("status: 410");
    for (const forbidden of ["randomBytes", "createUser", "updateUserById", "temporaryPassword", "find_auth_identity_by_email_v1"]) {
      expect(route).not.toContain(forbidden);
    }
  });

  it("makes Portal Admin Center claim-code only", () => {
    const center = read("src/components/portal-admin-center.tsx");
    expect(center).toContain("/api/portals/access");
    expect(center).toContain("Issue claim code");
    expect(center).toContain("Staff never creates, resets, or shares a portal password");
    expect(center).not.toContain("/api/portals/credentials");
    expect(center).not.toContain("temporaryPassword");
    expect(center).not.toContain("Reset password");
  });

  it("converts admissions through v3 without creating or resetting an Auth user", () => {
    const route = read("src/app/api/admissions/convert/route.ts");
    expect(route).toContain('admin.rpc("convert_admission_to_student_v3"');
    expect(route).toContain("issuePortalAccess");
    expect(route).toContain("claim_code_issued");
    expect(route).toContain("existing_account");
    for (const forbidden of ["randomBytes", "auth.admin.createUser", "auth.admin.updateUserById", "temporaryPassword", "find_auth_identity_by_email_v1"]) {
      expect(route).not.toContain(forbidden);
    }
  });

  it("shows only claim activation details after admission conversion", () => {
    const panel = read("src/components/admission-conversion-panel.tsx");
    expect(panel).toContain("One-time claim code");
    expect(panel).toContain("claimPath");
    expect(panel).toContain("staff never creates or shares a password");
    expect(panel).not.toContain("temporaryPassword");
    expect(panel).not.toContain("Temporary password");
  });

  it("keeps guardian preparation identity-free until the claim step", () => {
    const migration = read("supabase/migrations/20260916173000_phase5_claim_only_portal_lifecycle.sql");
    expect(migration).toContain("convert_admission_to_student_v3");
    expect(migration).toContain("portal_invitation_status");
    expect(migration).toContain("'not_invited'");
    expect(migration).toContain("admissions.guardian.prepared");
    expect(migration).toContain("'portal_claim_required',true");
    expect(migration).toContain("grant execute on function public.convert_admission_to_student_v3(uuid,bigint,bigint,boolean) to service_role");
    expect(migration).not.toContain("auth.users");
    expect(migration).not.toContain("identity_person_links");
    expect(migration).not.toContain("p_guardian_identity_id");
  });
});
