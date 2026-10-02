import { describe, expect, it } from "vitest";
import {
  analyzeStudentImportCsv,
  parseStudentImportCsv,
  STUDENT_IMPORT_TEMPLATE_CSV
} from "./csv-import";

describe("student CSV import parser", () => {
  it("parses canonical and alias headers with quoted commas", () => {
    const rows = parseStudentImportCsv(
      'student_name,dob,gender,locale,parent_name,relationship,parent_phone,parent_email\n"Ayaan, Demo",2015-04-03,male,en,Demo Guardian,father,+910000000001,parent@example.com'
    );
    expect(rows).toEqual([{
      display_name: "Ayaan, Demo",
      date_of_birth: "2015-04-03",
      gender: "male",
      preferred_locale: "en",
      guardian: {
        name: "Demo Guardian",
        relationship: "father",
        phone: "+910000000001",
        email: "parent@example.com"
      }
    }]);
  });

  it("keeps the downloadable template compatible with the parser", () => {
    const rows = parseStudentImportCsv(STUDENT_IMPORT_TEMPLATE_CSV);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      display_name: "Ahmed Khan",
      date_of_birth: "2014-01-15",
      gender: "male",
      preferred_locale: "en",
      guardian: {
        name: "Parent Name",
        relationship: "father",
        phone: "9000000000",
        email: "parent@example.com"
      }
    });
  });

  it("reports missing names, invalid enums, and impossible dates", () => {
    expect(() => parseStudentImportCsv("display_name,gender\n,female")).toThrow(/student name is required/i);
    expect(() => parseStudentImportCsv("display_name,gender\nAyaan,unknown")).toThrow(/gender must be/i);
    expect(() => parseStudentImportCsv("display_name,date_of_birth\nAyaan,2026-02-31")).toThrow(/real date/i);
  });

  it("marks duplicate rows in the same file before import", () => {
    const analysis = analyzeStudentImportCsv(
      "display_name,date_of_birth\nAyaan Khan,2015-04-03\nAyaan  Khan,2015-04-03"
    );
    expect(analysis.validRows).toHaveLength(0);
    expect(analysis.issues.filter((issue) => issue.code === "duplicate_in_file")).toHaveLength(2);
  });

  it("warns when guardian matching cannot use phone or email", () => {
    const analysis = analyzeStudentImportCsv(
      "display_name,guardian_name,guardian_relationship\nAyaan Khan,Parent Khan,father"
    );
    expect(analysis.validRows).toHaveLength(1);
    expect(analysis.issues).toContainEqual(expect.objectContaining({
      code: "guardian_no_matching_contact",
      severity: "warning"
    }));
  });

  it("warns on unknown columns without corrupting valid rows", () => {
    const analysis = analyzeStudentImportCsv(
      "display_name,unexpected_field\nAyaan Khan,value"
    );
    expect(analysis.validRows).toHaveLength(1);
    expect(analysis.headerWarnings).toHaveLength(1);
  });

  it("enforces the 100-row application batch limit", () => {
    const csv = ["display_name", ...Array.from({ length: 101 }, (_, index) => `Student ${index + 1}`)].join("\n");
    expect(() => parseStudentImportCsv(csv)).toThrow(/at most 100/i);
  });
});
