import type { DocumentBlock, PdfRow } from "pdfnative";
import { createUnicodeDocumentPdf } from "./unicode-pdf";
import type { StudentStatusCertificate } from "./student-status";

const value = (input: string | null | undefined) => input?.trim() || "—";

export async function createStudentStatusCertificatePdf(certificate: StudentStatusCertificate): Promise<Uint8Array> {
  const { snapshot } = certificate;
  const fields: Array<[string, string | null | undefined]> = [
    ["Student ID", snapshot.studentNumber],
    ["Program", snapshot.program],
    ["Class / group", snapshot.classGroup],
    ["Academic session", snapshot.academicSession],
    ["Joined on", snapshot.joinedOn],
    ["Student status", snapshot.studentStatus.toUpperCase()],
    ["Issued on", snapshot.issuedOn],
    ["Verification code", certificate.verificationCode]
  ];
  const rows: PdfRow[] = fields.map(([label, fieldValue]) => ({
    cells: [label, value(fieldValue)],
    type: "neutral",
    pointed: false
  }));

  const blocks: DocumentBlock[] = [
    { type: "heading", text: snapshot.tenantName, level: 1 },
    { type: "paragraph", text: snapshot.branchName },
    { type: "spacer", height: 12 },
    { type: "heading", text: "Student Status Certificate", level: 2 },
    { type: "paragraph", text: `Revision ${certificate.revision}` },
    { type: "spacer", height: 12 },
    { type: "paragraph", text: "This is to certify that" },
    { type: "heading", text: snapshot.studentName, level: 2 },
    { type: "paragraph", text: "is currently recorded as an active student of this institution." },
    { type: "spacer", height: 10 },
    {
      type: "table",
      headers: ["Field", "Recorded value"],
      rows,
      wrap: "always",
      cellPadding: 6,
      cellBorders: { all: true, width: 0.5 },
      autoFitColumns: true
    },
    { type: "spacer", height: 14 },
    { type: "paragraph", text: "This certificate confirms the student's recorded institutional status as of the issue date. It is not a graduation or academic-award certificate." },
    { type: "paragraph", text: `Authorized institutional document · Document issue #${certificate.issueId} · Revision ${certificate.revision}` }
  ];

  return createUnicodeDocumentPdf({
    title: "Student Status Certificate",
    blocks,
    footerText: `${snapshot.tenantName} · Digital verification: ${certificate.verificationCode}`,
    layout: { margins: { t: 44, r: 44, b: 44, l: 44 } }
  });
}
