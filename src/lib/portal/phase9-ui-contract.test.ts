import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phase 9 Teachers + Portals UI contracts", () => {
  it("renames the client-facing staff surface to Teachers and exposes required teacher fields", () => {
    const page = read("src/app/[locale]/staff/page.tsx");
    const list = read("src/components/teachers-workspace.tsx");
    const detail = read("src/app/[locale]/staff/[employmentId]/page.tsx");
    expect(page).toContain("Teachers");
    expect(list).toContain("teacherId");
    expect(list).toContain("designation");
    expect(detail).toContain("assignedPrograms");
    expect(detail).toContain("assignedSubjects");
    expect(detail).toContain("assignedGroups");
    expect(detail).toContain("teacher.attendance");
    expect(detail).not.toContain("teacher.timetable");
    expect(detail).not.toContain('data-testid="teacher-detail-timetable"');
    expect(detail).toContain("/api/teachers/photo/");
    expect(detail).toContain('href={`/${locale}/portals`}');
  });

  it("keeps the client-facing teacher editor away from private payroll and qualification controls", () => {
    const form = read("src/components/teacher-profile-form.tsx");
    expect(form).toContain("email");
    expect(form).toContain("phone");
    expect(form).toContain("joinedOn");
    expect(form).not.toContain("payrollEligible");
    expect(form).not.toContain("qualificationSummary");
    expect(form).not.toContain("contractType");
  });

  it("keeps teacher / staff creation scoped away from private HR controls", () => {
    const page = read("src/app/[locale]/staff/new/page.tsx");
    const list = read("src/components/teachers-workspace.tsx");
    const form = read("src/components/teacher-create-form.tsx");
    const route = read("src/app/api/teachers/create/route.ts");
    expect(page).toContain("requireOfficeAudience(locale)");
    expect(page).toContain("workspace.canManage");
    expect(list).toContain('href={`/${locale}/staff/new`}');
    expect(form).toContain('/api/teachers/create');
    expect(form).not.toMatch(/contractType|qualificationSummary|payrollEligible/);
    expect(route).toContain("Private HR fields are not accepted here.");
    expect(route.indexOf("getVerifiedIdentity()")).toBeLessThan(route.indexOf("Private HR fields are not accepted here."));
    expect(route.indexOf("getTenantContext()")).toBeLessThan(route.indexOf("Private HR fields are not accepted here."));
    expect(route).toContain('p_contract_type: "permanent"');
    expect(route).toContain("p_qualification_summary: null");
    expect(route).toContain("p_payroll_eligible: true");
    expect(existsSync(resolve(process.cwd(), "src/components/hr-employee-form.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/components/hr-employees-workspace.tsx"))).toBe(false);
  });
  it("keeps teacher detail and leave management office-only", () => {
    const detail = read("src/app/[locale]/staff/[employmentId]/page.tsx");
    const leave = read("src/app/[locale]/staff/leave/page.tsx");
    expect(detail).toContain("requireOfficeAudience(locale)");
    expect(leave).toContain("requireOfficeAudience(locale)");
  });
  it("provides simple Parent and Teacher credential administration without claim-code UI", () => {
    const center = read("src/components/portal-admin-center.tsx");
    const manager = read("src/components/portal-credential-manager.tsx");
    expect(center).toContain("PortalCredentialManager");
    expect(manager).toContain("Parent");
    expect(manager).toContain("Teacher / Staff");
    expect(manager).toContain("/api/portals/credentials");
    expect(manager).toContain("/api/portals/access-state");
    expect(manager).toContain("temporaryPassword");
    expect(manager).toContain("confirmPassword");
    expect(manager).toContain("confirmEmail");
    expect(manager).not.toContain('fetch("/api/portals/access",');
    expect(manager).not.toContain("claimPath");
  });

  it("keeps legacy claim-code routes physically retired", () => {
    for (const path of [
      "src/app/api/portals/access/route.ts",
      "src/app/api/portal/claim/route.ts",
      "src/app/portal/claim/page.tsx",
      "src/components/portal-claim-form.tsx"
    ]) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(false);
    }
  });
  it("keeps privileged provisioning audited and first-login password change guarded", () => {
    const route = read("src/app/api/portals/credentials/route.ts");
    const change = read("src/app/api/portal/password/change/route.ts");
    const portal = read("src/app/portal/page.tsx");
    expect(route).toContain("portal.credentials.create");
    expect(route).toContain("record_portal_credential_audit_v1");
    expect(route).toContain("createUser");
    expect(route).toContain("updateUserById");
    expect(route).toContain("must_change_password: true");
    expect(change).toContain("isSameOriginRequest(request)");
    expect(change).toContain("getVerifiedIdentity()");
    expect(change).toContain("app_metadata?.portal_account !== true");
    expect(change).toContain("app_metadata?.must_change_password !== true");
    expect(change).toContain("updateUserById(identity.id");
    expect(change).not.toContain("user_metadata");
    expect(portal).toContain("app_metadata?.must_change_password === true");
    expect(portal).not.toContain('portalHref("/portal/claim"');
  });

  it("renders parent overview in the handoff priority order", () => {
    const view = read("src/components/portal-parent-priority-overview.tsx");
    const priorities = ["1-urgent-notices", "2-today-schedule", "3-attendance", "4-homework", "5-teaching-progress", "6-results", "7-events"];
    let previous = -1;
    for (const key of priorities) {
      const position = view.indexOf(key);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
  });

  it("keeps parent teacher photo access guardian-scoped instead of granting HR read", () => {
    const route = read("src/app/api/portal/teachers/photo/[personId]/route.ts");
    expect(route).toContain("getPortalHome(tenantId)");
    expect(route).toContain("home.overview");
    expect(route).not.toContain("hr.employee.read");
    expect(route).toContain("createSignedUrl(path,60)");
  });
});
