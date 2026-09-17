import { createLayoutPdf, type PdfLayoutCommand } from "./layout-pdf";
import { createUnicodeLayoutPdf } from "./unicode-layout-pdf";
import type { StudentStatusCertificate } from "./student-status";

type CertificateLocale = "en" | "ur";
const copy = {
  en: { title: "STUDENT STATUS CERTIFICATE", revision: "Revision", certifies: "This is to certify that", id: "Student ID", body: "is currently recorded as an active student of this institution.", program: "Program", group: "Class / group", session: "Academic session", joined: "Joined on", status: "Student status", issued: "Issued on", code: "Verification code", note1: "This certificate confirms the student's recorded institutional status", note2: "as of the issue date. It is not a graduation or academic-award certificate.", authorized: "Authorized institutional document", verify: "Digital verification", issue: "Document issue" },
  ur: { title: "طالب علم حیثیت سرٹیفکیٹ", revision: "ورژن", certifies: "تصدیق کی جاتی ہے کہ", id: "طالب علم ID", body: "یہ طالب علم اس ادارے میں فعال طالب علم کے طور پر درج ہے۔", program: "پروگرام", group: "کلاس / گروپ", session: "تعلیمی سال", joined: "داخلہ تاریخ", status: "طالب علم حیثیت", issued: "جاری ہونے کی تاریخ", code: "تصدیقی کوڈ", note1: "یہ سرٹیفکیٹ اجرا کی تاریخ پر طالب علم کی ادارہ جاتی حیثیت کی تصدیق کرتا ہے۔", note2: "یہ گریجویشن یا تعلیمی اعزاز کا سرٹیفکیٹ نہیں ہے۔", authorized: "مجاز ادارہ جاتی دستاویز", verify: "ڈیجیٹل تصدیق", issue: "دستاویز اجرا" }
} as const;

function text(x: number, y: number, value: string, size = 10, bold = false): PdfLayoutCommand {
  return { type: "text", x, y, text: value, size, bold };
}

function fit(value: string | null | undefined, max = 68): string {
  const normalized = value?.replace(/\s+/g, " ").trim() || "—";
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 3)}...`;
}

function certificateCommands(certificate: StudentStatusCertificate, locale: CertificateLocale): PdfLayoutCommand[] {
  const { snapshot } = certificate;
  const t = copy[locale];
  const studentName = locale === "ur" && snapshot.studentNameNative ? snapshot.studentNameNative : snapshot.studentName;
  return [
    { type: "rect", x: 32, y: 32, width: 531, height: 778, lineWidth: 1.4 },
    { type: "rect", x: 41, y: 41, width: 513, height: 760, lineWidth: 0.45 },
    text(70, 760, fit(snapshot.tenantName, 56), 19, true),
    text(70, 738, fit(snapshot.branchName, 62), 10),
    text(120, 680, t.title, locale === "ur" ? 16 : 18, true),
    text(227, 658, `${t.revision} ${certificate.revision}`, 8),
    text(70, 605, t.certifies, 11),
    text(70, 570, fit(studentName, 58), 20, true),
    text(70, 542, `${t.id}: ${fit(snapshot.studentNumber, 46)}`, 10, true),
    text(70, 500, t.body, 11),
    text(70, 462, `${t.program}: ${fit(snapshot.program, 62)}`, 10),
    text(70, 438, `${t.group}: ${fit(snapshot.classGroup, 58)}`, 10),
    text(70, 414, `${t.session}: ${fit(snapshot.academicSession, 54)}`, 10),
    text(70, 390, `${t.joined}: ${fit(snapshot.joinedOn, 30)}`, 10),
    text(70, 352, `${t.status}: ${fit(snapshot.studentStatus, 24)}`, 10, true),
    text(70, 304, `${t.issued}: ${snapshot.issuedOn}`, 10),
    text(70, 280, `${t.code}: ${certificate.verificationCode}`, 10, true),
    text(70, 236, t.note1, 9),
    text(70, 220, t.note2, 9),
    text(70, 154, t.authorized, 9, true),
    text(70, 132, fit(snapshot.tenantName, 60), 9),
    text(360, 154, t.verify, 9, true),
    text(360, 132, certificate.verificationCode, 8),
    text(70, 78, `${t.issue} #${certificate.issueId} · ${t.revision} ${certificate.revision}`, 7)
  ];
}
export function createStudentStatusCertificatePdf(
  certificate: StudentStatusCertificate,
  locale: CertificateLocale = "en"
): Uint8Array {
  return createLayoutPdf({ pages: [certificateCommands(certificate, locale)] });
}

export async function createUnicodeStudentStatusCertificatePdf(
  certificate: StudentStatusCertificate,
  locale: CertificateLocale = "en"
): Promise<Uint8Array> {
  return createUnicodeLayoutPdf({ pages: [certificateCommands(certificate, locale)] });
}
