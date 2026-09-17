import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detailSource = readFileSync(new URL("./detail.ts", import.meta.url), "utf8");

describe("student detail protected guardian reads", () => {
  it("checks authoritative permissions and teacher assignment before privileged guardian reads", () => {
    const studentPermissionIndex = detailSource.indexOf('operatorHasPermissions(workspace, ["students.profile.read"])');
    const assignmentIndex = detailSource.indexOf("if (!assignedEnrollment.data) return null;");
    const guardianIndex = detailSource.indexOf('admin.from("person_relationships")');

    expect(studentPermissionIndex).toBeGreaterThanOrEqual(0);
    expect(detailSource).toContain('operatorHasPermissions(workspace, ["people.person.read"])');
    expect(detailSource).toContain('getTeacherAssignedEnrollment(workspace, teacherPersonId, personId, admin)');
    expect(detailSource).toContain('getVerifiedTeacherPersonId(workspace, admin)');
    expect(detailSource).not.toContain('admin.from("timetable_entries")');
    expect(assignmentIndex).toBeGreaterThan(studentPermissionIndex);
    expect(guardianIndex).toBeGreaterThan(assignmentIndex);
    expect(detailSource).not.toContain("getNavigationAudience");
  });

  it("uses the server-only admin client for tables intentionally unavailable to authenticated users", () => {
    expect(detailSource).toContain('admin.from("person_relationships")');
    expect(detailSource).toContain('admin.from("person_contacts")');
    expect(detailSource).not.toContain('supabase.from("person_relationships")');
    expect(detailSource).not.toContain('supabase.from("person_contacts")');
  });

  it("keeps ordinary student identity reads on the scoped authenticated client", () => {
    expect(detailSource).toContain('supabase.from("persons")');
    expect(detailSource).toContain('supabase.from("student_profiles")');
  });
});
