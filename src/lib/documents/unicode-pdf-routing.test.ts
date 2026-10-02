import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createStructuredUnicodeDocumentPdf } from "./document-template";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("server PDF Unicode routing", () => {
  it("renders structured Urdu values through the shaped Unicode layer", async () => {
    const pdf = await createStructuredUnicodeDocumentPdf({
      title: "Student Profile",
      institutionName: "ادارہ علمگاہ",
      branchName: "مرکزی شاخ",
      documents: [{
        heading: "محمد عبداللہ خان",
        fields: [{ label: "Student ID", value: "ST-001" }, { label: "Program", value: "حفظ القرآن" }]
      }]
    });
    const raw = new TextDecoder().decode(pdf);
    expect(raw.startsWith("%PDF-1.4")).toBe(true);
    expect(raw).toContain("/Subtype /Image");
    expect(raw).toContain("Student Profile");
    expect(raw).not.toContain("????");
  });

  it("routes all server-generated document families through async Unicode-aware generators", () => {
    const documentRoute = source("../../app/api/documents/pdf/route.ts");
    const statusRoute = source("../../app/api/documents/student-status-certificate/[personId]/pdf/route.ts");
    const reportCardRoute = source("../../app/api/exams/report-card/[personId]/pdf/route.ts");
    const reportRoute = source("../../app/api/reports/pdf/route.ts");
    const idCardRoute = source("../../app/api/students/id-cards/pdf/route.ts");

    expect(documentRoute).toContain("await createClientDocumentUnicodePdf");
    expect(documentRoute).toContain("await createUnicodeStudentIdCardSheetPdf");
    expect(statusRoute).toContain("await createUnicodeStudentStatusCertificatePdf");
    expect(reportCardRoute).toContain("await createUnicodeReportCardPdf");
    expect(reportRoute).toContain("await createUnicodeOperationalReportPdf");
    expect(idCardRoute).toContain("await createUnicodeStudentIdCardSheetPdf");
  });
});
