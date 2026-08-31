import { createLayoutPdf, type PdfLayoutCommand } from "./layout-pdf";
import type { StudentStatusCertificate } from "./student-status";

function text(x: number, y: number, value: string, size = 10, bold = false): PdfLayoutCommand {
  return { type: "text", x, y, text: value, size, bold };
}

function fit(value: string | null | undefined, max = 68): string {
  const normalized = value?.replace(/\s+/g, " ").trim() || "—";
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 3)}...`;
}

export function createStudentStatusCertificatePdf(certificate: StudentStatusCertificate): Uint8Array {
  const { snapshot } = certificate;
  const commands: PdfLayoutCommand[] = [
    { type: "rect", x: 32, y: 32, width: 531, height: 778, lineWidth: 1.4 },
    { type: "rect", x: 41, y: 41, width: 513, height: 760, lineWidth: 0.45 },
    text(70, 760, fit(snapshot.tenantName, 56), 19, true),
    text(70, 738, fit(snapshot.branchName, 62), 10),
    text(170, 680, "STUDENT STATUS CERTIFICATE", 18, true),
    text(227, 658, `Revision ${certificate.revision}`, 8),
    text(70, 605, "This is to certify that", 11),
    text(70, 570, fit(snapshot.studentName, 58), 20, true),
    text(70, 542, `Student ID: ${fit(snapshot.studentNumber, 46)}`, 10, true),
    text(70, 500, "is currently recorded as an active student of this institution.", 11),
    text(70, 462, `Program: ${fit(snapshot.program, 62)}`, 10),
    text(70, 438, `Class / group: ${fit(snapshot.classGroup, 58)}`, 10),
    text(70, 414, `Academic session: ${fit(snapshot.academicSession, 54)}`, 10),
    text(70, 390, `Joined on: ${fit(snapshot.joinedOn, 30)}`, 10),
    text(70, 352, `Student status: ${fit(snapshot.studentStatus, 24).toUpperCase()}`, 10, true),
    text(70, 304, `Issued on: ${snapshot.issuedOn}`, 10),
    text(70, 280, `Verification code: ${certificate.verificationCode}`, 10, true),
    text(70, 236, "This certificate confirms the student's recorded institutional status", 9),
    text(70, 220, "as of the issue date. It is not a graduation or academic-award certificate.", 9),
    text(70, 154, "Authorized institutional document", 9, true),
    text(70, 132, fit(snapshot.tenantName, 60), 9),
    text(360, 154, "Digital verification", 9, true),
    text(360, 132, certificate.verificationCode, 8),
    text(70, 78, `Document issue #${certificate.issueId} · Revision ${certificate.revision}`, 7)
  ];
  return createLayoutPdf({ pages: [commands] });
}
