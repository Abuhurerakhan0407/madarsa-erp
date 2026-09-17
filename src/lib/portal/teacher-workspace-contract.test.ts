import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const service = read("src/lib/portal/teacher-workspace.ts");
const scope = read("src/lib/students/teacher-scope.ts");
const page = read("src/app/portal/page.tsx");
const component = read("src/components/portal-teacher-workspace.tsx");

describe("teacher portal completion contract", () => {
  it("requires a verified employee link and active employment before building the workspace", () => {
    expect(service).toContain('.eq("link_type", "employee")');
    expect(service).toContain('.eq("status", "verified")');
    expect(service).toContain('.in("state", ["active", "on_leave"])');
    expect(service).toContain("if (!employments.length) return null");
  });

  it("uses the canonical assignment scope instead of a broad teacher enrollment read", () => {
    expect(service).toContain("getTeacherAssignedEnrollments");
    expect(service).not.toContain('admin.from("enrollments")');
    expect(scope).toContain('.eq("branch_id", workspace.branchId)');
    expect(scope).toContain("validDirectAssignments");
  });

  it("keeps Quran context teacher-owned, branch-scoped, and assigned-student scoped", () => {
    expect(service).toContain('admin.from("recitation_sessions")');
    expect(service).toContain("Number(item.teacher_person_id) === teacherPersonId");
    expect(service).toContain("branchIds.includes(Number(item.branch_id))");
    expect(service).toContain("studentNameById.has(studentPersonId)");
  });

  it("only exposes ERP mutation shortcuts when the linked identity has real permissions", () => {
    expect(service).toContain('"attendance.student.mark"');
    expect(service).toContain('"learning.recitation.record"');
    expect(service).toContain('"academics.homework.manage"');
    expect(service).toContain('"assessment.marks.enter"');
    expect(component).toContain("workspace.capabilities.attendanceMark ?");
    expect(component).toContain("workspace.capabilities.quranRecord ?");
    expect(component).toContain("workspace.capabilities.homeworkManage ?");
    expect(component).toContain("workspace.capabilities.marksManage ?");
  });

  it("wires the self-service teacher workspace without introducing a student portal", () => {
    expect(page).toContain("getPortalTeacherWorkspace(tenantId)");
    expect(page).toContain("<PortalTeacherWorkspace");
    expect(component.toLowerCase()).not.toContain("student portal");
    expect(page.toLowerCase()).not.toContain("student portal");
  });
});
