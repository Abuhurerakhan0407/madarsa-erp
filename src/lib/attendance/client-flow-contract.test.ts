import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const studentPage = read("src/app/[locale]/attendance/page.tsx");
const teacherPage = read("src/app/[locale]/staff/attendance/page.tsx");
const studentWorkspace = read("src/components/attendance-v2-workspace.tsx");
const teacherWorkspace = read("src/components/hr-attendance-v2-workspace.tsx");
const workspace = read("src/lib/attendance/workspace.ts");
const exportRoute = read("src/app/api/attendance/export/route.ts");
const attendanceCss = read("src/app/[locale]/attendance/attendance.css");

describe("client attendance flow", () => {
  it("uses a compact Students / Teachers segmented attendance shell", () => {
    expect(studentPage).toContain("attendance-audience-tabs");
    expect(studentPage).toContain("Teachers / Staff");
    expect(teacherPage).toContain("attendance-audience-tabs");
    expect(teacherPage).toContain("Teachers / Staff");
    expect(attendanceCss).toContain(".attendance-audience-tab.is-active");
  });

  it("requires a class/group for student attendance and keeps teachers free of class controls", () => {
    expect(studentPage).toContain('name="group"');
    expect(studentPage).toContain("required");
    expect(studentPage).toContain("getAttendancePageOptions");
    expect(studentPage).not.toContain('name="q"');
    expect(teacherPage).not.toContain('name="group"');
    expect(teacherPage).not.toContain('name="q"');
  });

  it("uses the existing group-scoped attendance RPC and preserves export filtering", () => {
    expect(workspace).toContain('admin.rpc("get_student_attendance_workspace_v3"');
    expect(workspace).toContain("p_group_id: args.groupId ?? null");
    expect(exportRoute).toContain("groupId");
    expect(exportRoute).toContain("getAttendanceWorkspace({ date, groupId");
  });

  it("keeps biometric-first emergency and correction controls while reducing dashboard clutter", () => {
    expect(studentWorkspace).toContain("EmergencyAttendancePanel");
    expect(studentWorkspace).toContain("row.emergencyManualAuthorized");
    expect(studentWorkspace).toContain("attendance-summary-strip");
    expect(studentWorkspace).not.toContain("Attendance trend");
    expect(teacherWorkspace).toContain("EmergencyAttendancePanel");
    expect(teacherWorkspace).toContain("row.emergencyManualAuthorized");
    expect(teacherWorkspace).toContain("attendance-summary-strip");
    expect(teacherWorkspace).not.toContain("teacher-attendance-trend");
  });

  it("preserves the student group when switching to teachers and back", () => {
    expect(studentPage).toContain("studentGroup");
    expect(teacherPage).toContain("studentGroup");
    expect(teacherPage).toContain("&group=");
  });
});
