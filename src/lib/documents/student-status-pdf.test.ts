import { describe, expect, it } from "vitest";
import { createStudentStatusCertificatePdf } from "./student-status-pdf";
import type { StudentStatusCertificate } from "./student-status";

const certificate: StudentStatusCertificate = {
  issueId: 12,
  documentId: 44,
  revision: 2,
  verificationCode: "SSC-ABCDEF1234567890",
  issuedAt: "2026-08-31T04:00:00Z",
  state: "active",
  snapshot: {
    studentPersonId: 49,
    studentNumber: "STU-MAIN-2026_27-00017",
    studentName: "Mikaeel Ansari",
    studentNameNative: null,
    studentStatus: "active",
    joinedOn: "2026-08-31",
    tenantName: "Al-Noor Islamic Academy",
    branchName: "Central Campus",
    program: "Dars-e-Nizami",
    classGroup: "Dars-e-Nizami · Year 1 A",
    academicSession: "2026-27",
    issuedOn: "2026-08-31"
  }
};

describe("student status certificate PDF", () => {
  it("renders the issued snapshot and verification code on A4", () => {
    const pdf = createStudentStatusCertificatePdf(certificate);
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 595 842]");
    expect(text).toContain("STUDENT STATUS CERTIFICATE");
    expect(text).toContain("Mikaeel Ansari");
    expect(text).toContain("STU-MAIN-2026_27-00017");
    expect(text).toContain("SSC-ABCDEF1234567890");
    expect(text).toContain("not a graduation or academic-award certificate");
  });
});
