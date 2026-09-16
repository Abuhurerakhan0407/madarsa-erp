import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/lib/students/my-students.ts"), "utf8");

describe("My Students assignment scope", () => {
  it("requires teacher audience and verified employee identity", () => {
    expect(source).toContain('getNavigationAudience(workspace) !== "teacher"');
    expect(source).toContain('.eq("link_type", "employee")');
    expect(source).toContain('.eq("status", "verified")');
  });

  it("resolves all real teacher assignment sources", () => {
    expect(source).toContain('from("academic_groups")');
    expect(source).toContain('primary_teacher_person_id');
    expect(source).toContain('from("curriculum_teaching_assignments")');
    expect(source).toContain('from("timetable_entries")');
  });

  it("keeps student enrollment and group reads branch scoped", () => {
    expect(source).toContain('.eq("branch_id", workspace.branchId)');
    expect(source).toContain('.eq("status", "active").in("group_id", groupIds)');
  });
});
