import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client Teachers & Staff flow", () => {
  it("renders the staff directory as compact profile rows", () => {
    const source = read("src/components/teachers-workspace.tsx");
    expect(source).toContain('className="teacher-list-row"');
    expect(source).toContain('className="teacher-list-main"');
    expect(source).toContain('className="teacher-list-chevron"');
    expect(source).not.toContain('className="demo-card-grid"');
  });

  it("keeps raw contact, attendance, and timetable details out of list rows", () => {
    const source = read("src/components/teachers-workspace.tsx");
    expect(source).not.toContain("teacher.email ||");
    expect(source).not.toContain("teacher.attendance.present");
    expect(source).not.toContain("teacher.timetable.length");
    expect(source).not.toContain("No portal login yet");
  });

  it("removes timetable from the client detail view and exposes controlled access management", () => {
    const source = read("src/app/[locale]/staff/[employmentId]/page.tsx");
    expect(source).not.toContain('data-testid="teacher-detail-timetable"');
    expect(source).not.toContain("teacher.timetable.map");
    expect(source).toContain('href={`/${locale}/portals`}');
    expect(source).toContain("data.canManage ?");
  });

  it("does not surface email-required or no-login clutter as list status copy", () => {
    const source = read("src/components/teachers-workspace.tsx");
    expect(source).not.toContain('accountEmailRequired: "Email required"');
    expect(source).not.toContain('noPortalLogin:');
    expect(source).toContain('accountEmailRequired: "Access setup"');
  });
});
