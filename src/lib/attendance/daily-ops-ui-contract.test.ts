import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const emergency = read("src/components/emergency-attendance-panel.tsx");
const teacherAttendance = read("src/components/hr-attendance-v2-workspace.tsx");
const leave = read("src/components/hr-leave-workspace.tsx");
const academics = read("src/components/academics-timetable-manager.tsx");
const academicsCss = read("src/app/academics-v2.css");
const hrCss = read("src/app/hr.css");
const teachers = read("src/components/teachers-workspace.tsx");
const teacherProfile = read("src/app/[locale]/staff/[employmentId]/page.tsx");

describe("Daily Ops UI contracts", () => {
  it("keeps emergency attendance collapsed and manager gated", () => {
    expect(emergency).toContain('canManage ? <details className="emergency-attendance-details">');
    expect(emergency).not.toContain('<details open');
    expect(teacherAttendance).toContain("row.emergencyManualAuthorized && data.canManage");
  });
  it("keeps teacher attendance usable at 360/390/430 widths", () => {
    expect(hrCss).toContain("@media(max-width:700px)");
    expect(hrCss).toContain("@media(max-width:390px)");
    expect(hrCss).toContain("teacher-attendance-metrics");
    expect(hrCss).toContain("teacher-attendance-manual");
  });
  it("uses collapsed creation actions and card-style mobile academics rows", () => {
    expect(academics).not.toContain("<details open=");
    expect(academics).toContain("data-label={text.time}");
    expect(academicsCss).toContain("@media(max-width:700px)");
    expect(academicsCss).toContain("content:attr(data-label)");
  });
  it("keeps leave decisions explicit and portal auth outside teacher operations", () => {
    expect(leave).toContain("window.confirm(filters.approveConfirm)");
    expect(leave).toContain("window.confirm(filters.rejectConfirm)");
    expect(leave).toContain("hr-leave-filters");
    expect(teachers).not.toContain("/portals?tab=teachers");
    expect(teacherProfile).not.toContain("/portals?tab=teachers");
    expect(teacherProfile).toContain("/staff/attendance");
    expect(teacherProfile).toContain("/staff/leave");
  });
});
