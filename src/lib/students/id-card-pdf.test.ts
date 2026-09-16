import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createStudentIdCardSheetPdf } from "./id-card-pdf";

const students = Array.from({ length: 5 }, (_, index) => ({
  studentNumber: `STU-00${index + 1}`,
  name: `Student ${index + 1}`,
  dateOfBirth: "2012-01-01",
  status: "active",
  program: "Dars-e-Nizami",
  group: "Year 1 A",
  guardianName: `Guardian ${index + 1}`,
  photo: index === 0 ? { data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), pixelWidth: 320, pixelHeight: 400 } : null
}));

describe("student ID-card sheet PDF", () => {
  it("creates A4 CR80 front/back sheets with deterministic pagination and embedded portraits", () => {
    const pdf = createStudentIdCardSheetPdf(students, {
      institutionName: "Al-Noor Islamic Academy",
      branchName: "Central Campus",
      academicYear: "2026-27"
    });
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("%ILMGAAH");
    expect(text).toContain("/MediaBox [0 0 595 842]");
    expect(text).toContain("/Count 2");
    expect(text).toContain("40 629 242.65 153 re S");
    expect(text).toContain("Student 1");
    expect(text).toContain("STU-005");
    expect(text).toContain("Guardian 5");
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("/Filter [/ASCII85Decode /DCTDecode]");
    expect(text).toContain("/Im1 Do");
    expect(text).toContain("(S2)");
  });

  it("hydrates canonical private photos in the PDF route instead of dropping the projected path", () => {
    const route = readFileSync(new URL("../../app/api/students/id-cards/pdf/route.ts", import.meta.url), "utf8");
    expect(route).toContain("photoStoragePath");
    expect(route).toContain('from("tenant-documents")');
    expect(route).toContain("normalizeStudentPhoto");
    expect(route).toContain("sharp(");
    expect(route).toContain("photo: await normalizeStudentPhoto");
  });

  it("rejects an empty batch", () => {
    expect(() => createStudentIdCardSheetPdf([], {
      institutionName: "Al-Noor Islamic Academy",
      branchName: "Central Campus",
      academicYear: "2026-27"
    })).toThrow("At least one student is required");
  });
});
