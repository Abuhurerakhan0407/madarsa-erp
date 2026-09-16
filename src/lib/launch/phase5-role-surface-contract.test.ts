import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const permissionHelper = source("src/lib/access/operator-permission.ts");
const officeGuard = source("src/lib/navigation/office-surface.ts");
const audienceSource = source("src/lib/navigation/audience.ts");
const studentRegister = source("src/app/[locale]/students/page.tsx");
const studentDetail = source("src/lib/students/detail.ts");
const studentPage = source("src/app/[locale]/students/[personId]/page.tsx");
const studentSearch = source("src/app/api/students/search/route.ts");
const studentExport = source("src/app/api/students/export/route.ts");
const studentPhoto = source("src/app/api/students/photo/[personId]/route.ts");

const guardedLayouts: Array<[string, string]> = [
  ["src/app/[locale]/admissions/layout.tsx", "admissions.application.read"],
  ["src/app/[locale]/programs/layout.tsx", "academics.structure.read"],
  ["src/app/[locale]/staff/layout.tsx", "hr.employee.read"],
  ["src/app/[locale]/exams/layout.tsx", "assessment.marks.read"],
  ["src/app/[locale]/documents/layout.tsx", "documents.file.read"],
  ["src/app/[locale]/reports/layout.tsx", "report.run.execute"],
  ["src/app/[locale]/settings/layout.tsx", "settings.configuration.read"],
  ["src/app/[locale]/access/layout.tsx", "settings.roles.manage"],
  ["src/app/[locale]/portals/layout.tsx", "portal.notice.manage"],
  ["src/app/[locale]/students/new/layout.tsx", "people.person.manage"],
  ["src/app/[locale]/students/lifecycle/layout.tsx", "academics.enrollment.manage"],
  ["src/app/[locale]/students/id-cards/layout.tsx", "document.job.manage"],
  ["src/app/[locale]/students/[personId]/edit/layout.tsx", "students.profile.update"],
  ["src/app/[locale]/students/[personId]/id-card/layout.tsx", "document.job.manage"],
  ["src/app/[locale]/students/[personId]/placement/layout.tsx", "academics.enrollment.manage"]
];

describe("Client V3 Phase 5 role-surface hardening", () => {
  it("authorizes sensitive surfaces with the service-only permission RPC, not navigation classification", () => {
    expect(permissionHelper).toContain('admin.rpc("operator_has_permission_v1"');
    expect(permissionHelper).toContain("workspace.identityId");
    expect(permissionHelper).toContain("workspace.tenantId");
    expect(permissionHelper).toContain("workspace.branchId");
    expect(officeGuard).toContain("operatorHasPermissions(workspace");
    expect(officeGuard).not.toContain("getNavigationAudience");
    expect(officeGuard).not.toContain("raw_user_meta_data");
    expect(officeGuard).not.toContain("user_metadata");
  });

  it("fail-closes role-less or permission-less navigation instead of presenting office controls", () => {
    expect(audienceSource).toContain('if(!roleIds.length) return "teacher"');
    expect(audienceSource).toContain('if(!permissions.length) return "teacher"');
  });

  it("server-gates each office-only route with a domain permission", () => {
    for (const [path, permission] of guardedLayouts) {
      const value = source(path);
      expect(value, path).toContain("requireOfficeSurface(locale");
      expect(value, path).toContain(permission);
    }
    expect(studentRegister).toContain("requireOfficeSurface(locale)");
  });

  it("keeps global search and full export behind authoritative office permissions", () => {
    expect(studentSearch).toContain('operatorHasPermissions(workspace,["people.person.read"])');
    expect(studentSearch).not.toContain("getNavigationAudience");
    expect(studentExport).toContain('operatorHasPermissions(workspace,["people.person.read","data.export.manage"])');
    expect(studentExport).not.toContain("getNavigationAudience");
  });

  it("requires teacher assignment before privileged student detail reads", () => {
    const assignmentIndex = studentDetail.indexOf("if (!assignedEnrollment.data) return null;");
    const guardianIndex = studentDetail.indexOf('admin.from("person_relationships")');
    expect(studentDetail).toContain('operatorHasPermissions(workspace, ["students.profile.read"])');
    expect(studentDetail).toContain('operatorHasPermissions(workspace, ["people.person.read"])');
    expect(studentDetail).toContain('.eq("teacher_person_id", teacherLink.data.person_id)');
    expect(studentDetail).toContain('.in("group_id", groupIds)');
    expect(assignmentIndex).toBeGreaterThanOrEqual(0);
    expect(guardianIndex).toBeGreaterThan(assignmentIndex);
    expect(studentDetail).not.toContain("getNavigationAudience");
  });

  it("shows assigned teachers task-safe profile actions only", () => {
    expect(studentPage).toContain('const isTeacher = audience === "teacher"');
    expect(studentPage).toContain("backTeaching");
    expect(studentPage).toContain('href: `/${locale}/my-students`');
    expect(studentPage).toContain("actionSlot={isTeacher ? undefined");
    expect(studentPage).toContain("!isTeacher ? <Link");
  });

  it("restricts photo reads to assigned groups when institution-wide read is absent", () => {
    expect(studentPhoto).toContain('operatorHasPermissions(w,["students.profile.read"])');
    expect(studentPhoto).toContain('operatorHasPermissions(w,["people.person.read"])');
    expect(studentPhoto).toContain('.eq("teacher_person_id",link.person_id)');
    expect(studentPhoto).toContain('.eq("group_id",enrollment.group_id)');
    expect(studentPhoto).not.toContain("getNavigationAudience");
  });

  it("does not use editable identity metadata for authorization", () => {
    for (const value of [permissionHelper, officeGuard, studentDetail, studentSearch, studentExport, studentPhoto]) {
      expect(value).not.toContain("raw_user_meta_data");
      expect(value).not.toContain("user_metadata");
    }
  });
});
