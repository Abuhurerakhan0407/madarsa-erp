import { readFileSync } from "node:fs";
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

  it("provides Parents and Teachers claim-code access without staff-issued passwords", () => {
    const center = read("src/components/portal-admin-center.tsx");
    expect(center).toContain("Parents");
    expect(center).toContain("Teachers");
    expect(center).toContain("lastLogin");
    expect(center).toContain("/api/portals/access");
    expect(center).toContain("/api/portals/access-state");
    expect(center).toContain("body.code");
    expect(center).toContain("claimPath");
    expect(center).not.toContain("/api/portals/credentials");
    expect(center).not.toContain("temporaryPassword");
  });

  it("retires staff credential provisioning while keeping legacy self-service password change guarded", () => {
    const route = read("src/app/api/portals/credentials/route.ts");
    const change = read("src/app/api/portal/password/change/route.ts");
    const portal = read("src/app/portal/page.tsx");
    expect(route).toContain("PORTAL_CREDENTIALS_RETIRED");
    expect(route).toContain("status: 410");
    expect(route).not.toContain("createUser");
    expect(route).not.toContain("updateUserById");
    expect(route).not.toContain("temporaryPassword");
    expect(change).toContain("isSameOriginRequest(request)");
    expect(change).toContain("getVerifiedIdentity()");
    expect(change).toContain("app_metadata?.portal_account !== true");
    expect(change).toContain("app_metadata?.must_change_password !== true");
    expect(change).toContain("updateUserById(identity.id");
    expect(change).not.toContain("user_metadata");
    expect(portal).toContain("app_metadata?.must_change_password === true");
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
