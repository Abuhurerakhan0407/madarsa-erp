import { describe, expect, it } from "vitest";
import { createOperationalReportPdf, supportsOperationalReportPdf } from "./report-pdf";
import type { ReportResult } from "./workspace";

function result(reportKey: string, rows: Record<string, unknown>[]): ReportResult {
  return { runId: 42, reportKey, labels: { en: reportKey }, columns: [], rows, rowCount: rows.length, parameters: {}, outputFormat: "json" };
}

describe("operational report PDF", () => {
  it("renders admission register across landscape pages", () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      application_id: index + 1,
      applicant_name: `Applicant ${index + 1}`,
      guardian_name: `Guardian ${index + 1}`,
      program: "Dars-e-Nizami",
      state: "submitted",
      submitted_at: "2026-08-31T10:00:00Z",
      converted_at: null
    }));
    const pdf = createOperationalReportPdf(result("admission_register", rows), { institutionName: "Al-Noor Islamic Academy", branchName: "Central Campus" });
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 842 595]");
    expect(text).toContain("/Count 2");
    expect(text).toContain("Admission Register");
    expect(text).toContain("Applicant 25");
  });

  it("supports only planned report PDFs", () => {
    expect(supportsOperationalReportPdf("admission_register")).toBe(true);
    expect(supportsOperationalReportPdf("daily_attendance")).toBe(true);
    expect(supportsOperationalReportPdf("student_master")).toBe(false);
  });
});
