import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("teacher My Students route", () => {
  it("has a concrete page for the teacher navigation destination", () => {
    const nav = read("src/lib/navigation/client-v3-navigation.ts");
    const page = read("src/app/[locale]/my-students/page.tsx");
    expect(nav).toContain("/my-students");
    expect(page).toContain("getMyStudents");
    expect(page).toContain("My Students");
    expect(page).toContain("میرے طلبہ");
  });

  it("fails closed to the verified teacher audience and assignment scope", () => {
    const loader = read("src/lib/students/my-students.ts");
    expect(loader).toContain('getNavigationAudience(workspace) !== "teacher"');
    expect(loader).toContain("getVerifiedTeacherPersonId");
    expect(loader).toContain("getTeacherAssignedEnrollments");
    expect(loader).toContain('.eq("branch_id", workspace.branchId)');
  });

  it("links only resolved assigned people into the governed student detail route", () => {
    const page = read("src/app/[locale]/my-students/page.tsx");
    expect(page).toContain("student.personId");
    expect(page).toContain("/students/");
    expect(page).not.toContain("[personId]");
  });
});
