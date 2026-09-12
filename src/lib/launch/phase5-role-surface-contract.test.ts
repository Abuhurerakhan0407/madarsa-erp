import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const officeGuard = source("src/lib/navigation/office-surface.ts");
const studentRegister = source("src/app/[locale]/students/page.tsx");
const studentDetail = source("src/lib/students/detail.ts");
const studentPage = source("src/app/[locale]/students/[personId]/page.tsx");
const studentSearch = source("src/app/api/students/search/route.ts");
const studentExport = source("src/app/api/students/export/route.ts");
const studentPhoto = source("src/app/api/students/photo/[personId]/route.ts");

const officeLayouts = [
  "src/app/[locale]/admissions/layout.tsx",
  "src/app/[locale]/programs/layout.tsx",
  "src/app/[locale]/staff/layout.tsx",
  "src/app/[locale]/exams/layout.tsx",
  "src/app/[locale]/documents/layout.tsx",
  "src/app/[locale]/reports/layout.tsx",
  "src/app/[locale]/settings/layout.tsx",
  "src/app/[locale]/access/layout.tsx",
  "src/app/[locale]/portals/layout.tsx",
  "src/app/[locale]/students/new/layout.tsx",
  "src/app/[locale]/students/lifecycle/layout.tsx",
  "src/app/[locale]/students/id-cards/layout.tsx",
  "src/app/[locale]/students/[personId]/edit/layout.tsx",
  "src/app/[locale]/students/[personId]/id-card/layout.tsx",
  "src/app/[locale]/students/[personId]/placement/layout.tsx"
];

describe("Client V3 Phase 5 role-surface hardening", () => {
  it("derives office access on the server from authoritative navigation audience", () => {
    expect(officeGuard).toContain("getTenantContext()");
    expect(officeGuard).toContain("getNavigationAudience(workspace)");
    expect(officeGuard).toContain('audience !== "office"');
    expect(officeGuard).toContain("/forbidden");
    expect(officeGuard).not.toContain("raw_user_meta_data");
    expect(officeGuard).not.toContain("user_metadata");
  });

  it("server-gates every office-only route group", () => {
    for (const path of officeLayouts) {
      expect(source(path), path).toContain("requireOfficeSurface(locale)");
    }
    expect(studentRegister).toContain("requireOfficeSurface(locale)");
  });

  it("keeps global search and full export unavailable to teacher audience", () => {
    expect(studentSearch).toContain('getNavigationAudience(workspace) !== "office"');
    expect(studentExport).toContain('getNavigationAudience(workspace)!=="office"');
  });

  it("requires teacher assignment before privileged student detail reads", () => {
    const assignmentIndex = studentDetail.indexOf("if (!assignedEnrollment.data) return null;");
    const guardianIndex = studentDetail.indexOf('admin.from("person_relationships")');
    expect(studentDetail).toContain('if (audience === "teacher")');
    expect(studentDetail).toContain('.eq("teacher_person_id", teacherLink.data.person_id)');
    expect(studentDetail).toContain('.in("group_id", groupIds)');
    expect(assignmentIndex).toBeGreaterThanOrEqual(0);
    expect(guardianIndex).toBeGreaterThan(assignmentIndex);
  });

  it("shows assigned teachers task-safe profile actions only", () => {
    expect(studentPage).toContain('const isTeacher = audience === "teacher"');
    expect(studentPage).toContain("backTeaching");
    expect(studentPage).toContain('href: `/${locale}/my-students`');
    expect(studentPage).toContain("actionSlot={isTeacher ? undefined");
    expect(studentPage).toContain("!isTeacher ? <Link");
  });

  it("restricts student photo reads to the teacher's assigned group", () => {
    expect(studentPhoto).toContain("getNavigationAudience(w)==='teacher'");
    expect(studentPhoto).toContain(".eq('teacher_person_id',link.person_id)");
    expect(studentPhoto).toContain(".eq('group_id',enrollment.group_id)");
  });

  it("does not use editable identity metadata for role authorization", () => {
    for (const value of [studentDetail, studentPage, studentSearch, studentExport, studentPhoto]) {
      expect(value).not.toContain("raw_user_meta_data");
      expect(value).not.toContain("user_metadata");
    }
  });
});
