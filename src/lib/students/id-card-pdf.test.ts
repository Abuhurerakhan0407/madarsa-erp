import { describe, expect, it } from "vitest";
import { extractText } from "pdfnative";
import { createStudentIdCardSheetPdf } from "./id-card-pdf";

const students = Array.from({ length: 5 }, (_, index) => ({
  studentNumber: `STU-00${index + 1}`,
  name: index === 4 ? "محمد عبداللہ" : `Student ${index + 1}`,
  dateOfBirth: "2012-01-01",
  status: "active",
  program: "Dars-e-Nizami",
  group: "Year 1 A",
  guardianName: `Guardian ${index + 1}`
}));

describe("student ID-card sheet PDF", () => {
  it("creates paginated A4 ID-card sheets and preserves shaped Arabic glyphs", async () => {
    const pdf = await createStudentIdCardSheetPdf(students, {
      institutionName: "Al-Noor Islamic Academy",
      branchName: "Central Campus",
      academicYear: "2026-27"
    });
    const pages = extractText(pdf);
    const text = pages.map(page => page.text).join("\n");
    expect(new TextDecoder().decode(pdf).startsWith("%PDF-")).toBe(true);
    expect(pages.length).toBeGreaterThan(1);
    expect(text).toContain("Student 1");
    expect(text).toContain("STU-005");
    expect(text).toContain("Guardian 5");
    expect(text).toMatch(/[\u0600-\u06ff\ufb50-\ufdff\ufe70-\ufeff]/u);
    expect(text).not.toContain("????");
  });

  it("rejects an empty batch", async () => {
    await expect(createStudentIdCardSheetPdf([], {
      institutionName: "Al-Noor Islamic Academy",
      branchName: "Central Campus",
      academicYear: "2026-27"
    })).rejects.toThrow("At least one student is required");
  });
});
