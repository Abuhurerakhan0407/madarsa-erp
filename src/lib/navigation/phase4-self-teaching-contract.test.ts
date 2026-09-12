import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();
}

const students = source("src/app/[locale]/students/page.tsx");
const attendance = source("src/app/[locale]/attendance/page.tsx");
const quran = source("src/app/[locale]/quran/page.tsx");
const programs = source("src/app/[locale]/programs/page.tsx");
const exams = source("src/app/[locale]/exams/page.tsx");
const documents = source("src/app/[locale]/documents/page.tsx");
const reports = source("src/app/[locale]/reports/page.tsx");
const staff = source("src/app/[locale]/staff/page.tsx");
const myStudents = source("src/app/[locale]/my-students/page.tsx");
const lifecycle = source("src/app/[locale]/students/lifecycle/page.tsx");

describe("Client V3 Phase 4 self-teaching surfaces", () => {
  it("gives zero-data student and teacher screens one useful next action or explanation", () => {
    expect(students).toContain("add first student");
    expect(staff).toContain("add first teacher");
    expect(myStudents).toContain("office administrator");
  });

  it("routes missing academic prerequisites back to guided setup", () => {
    for (const page of [attendance, quran, programs, exams]) {
      expect(page).toContain("/${locale}/setup");
    }
  });

  it("distinguishes document filter emptiness from a genuinely empty student register", () => {
    expect(documents).toContain("filtered");
    expect(documents).toContain("/${locale}/students/new");
    expect(documents).toContain("clear filters");
  });

  it("explains how to create the first report instead of leaving recent runs blank", () => {
    expect(reports).toContain("no reports have been generated yet");
    expect(reports).toContain("#reports-workspace");
  });

  it("keeps a direct back path from student lifecycle operations", () => {
    expect(lifecycle).toContain("back to students");
    expect(lifecycle).toContain("/${locale}/students");
  });
});
