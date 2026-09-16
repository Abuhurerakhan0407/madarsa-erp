import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentStatusCertificateAction } from "@/components/student-status-certificate-action";
import { EntityNotFoundState } from "@/components/workspace-ui";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n/config";
import { getStudentStatusCertificate } from "@/lib/documents/student-status";
import { getStudentDetail } from "@/lib/students/detail";

const copy = {
  en: { title: "Student Status Certificate", body: "Issue a governed certificate confirming the student's current institutional status.", notIssued: "No active certificate has been issued for this student yet.", issue: "Issue certificate", reissue: "Issue new revision", download: "Download PDF", verify: "Public verification", revision: "Revision", issued: "Issued on", code: "Verification code", back: "Back to documents", status: "Student status", session: "Academic session", program: "Program", group: "Class / group" },
  ur: { title: "طالب علم حیثیت سرٹیفکیٹ", body: "طالب علم کی موجودہ ادارہ جاتی حیثیت کی تصدیق کرنے والا باقاعدہ سرٹیفکیٹ جاری کریں۔", notIssued: "اس طالب علم کے لیے ابھی کوئی فعال سرٹیفکیٹ جاری نہیں ہوا۔", issue: "سرٹیفکیٹ جاری کریں", reissue: "نیا ورژن جاری کریں", download: "PDF ڈاؤن لوڈ کریں", verify: "عوامی تصدیق", revision: "ورژن", issued: "جاری ہونے کی تاریخ", code: "تصدیقی کوڈ", back: "دستاویزات پر واپس", status: "طالب علم حیثیت", session: "تعلیمی سال", program: "پروگرام", group: "کلاس / گروپ" },
  ar: { title: "شهادة حالة الطالب", body: "إصدار شهادة محكومة تؤكد الحالة المؤسسية الحالية للطالب.", notIssued: "لم تصدر شهادة نشطة لهذا الطالب بعد.", issue: "إصدار الشهادة", reissue: "إصدار مراجعة جديدة", download: "تنزيل PDF", verify: "التحقق العام", revision: "المراجعة", issued: "تاريخ الإصدار", code: "رمز التحقق", back: "العودة إلى المستندات", status: "حالة الطالب", session: "العام الدراسي", program: "البرنامج", group: "الفصل / المجموعة" }
} as const;

export default async function StudentStatusCertificatePage({ params }: { params: Promise<{ locale: string; personId: string }> }) {
  const { locale: rawLocale, personId: rawPersonId } = await params;
  if (!routing.locales.includes(rawLocale as Locale)) notFound();
  const locale = rawLocale as Locale;
  const personId = Number(rawPersonId);
  if (!Number.isInteger(personId) || personId <= 0) notFound();
  const t = copy[locale];
  const [certificate, student] = await Promise.all([getStudentStatusCertificate(personId), getStudentDetail(personId, locale)]);
  if (!student) return <EntityNotFoundState locale={locale} entityLabel={t.status} backHref={`/${locale}/documents`} backLabel={t.back} />;

  return <div className="documents-shell">
    <section className="documents-hero"><div><p className="eyebrow">{t.title}</p><h1>{student.name}</h1><p>{t.body}</p></div><Link className="secondary-button" href={`/${locale}/documents`}>{t.back}</Link></section>
    {!certificate ? <section className="panel"><p>{t.notIssued}</p><StudentStatusCertificateAction personId={personId} label={t.issue} /></section> : <>
      <section className="panel report-card-sheet">
        <header className="report-card-header"><div><p className="state-kicker">{certificate.snapshot.tenantName}</p><h1>{t.title}</h1><p>{certificate.snapshot.branchName}</p></div><div className="report-card-grade"><span>{t.revision}</span><strong>{certificate.revision}</strong></div></header>
        <section className="report-card-student"><div><span>{certificate.snapshot.studentNumber}</span><strong>{certificate.snapshot.studentName}</strong>{certificate.snapshot.studentNameNative ? <small dir="auto">{certificate.snapshot.studentNameNative}</small> : null}</div><div><span>{t.status}</span><strong>{certificate.snapshot.studentStatus}</strong><small>{t.issued}: {certificate.snapshot.issuedOn}</small></div></section>
        <div className="detail-grid"><div><span>{t.program}</span><strong>{certificate.snapshot.program}</strong></div><div><span>{t.group}</span><strong>{certificate.snapshot.classGroup}</strong></div><div><span>{t.session}</span><strong>{certificate.snapshot.academicSession}</strong></div><div><span>{t.code}</span><strong className="verification-code">{certificate.verificationCode}</strong></div></div>
      </section>
      <section className="panel"><div className="quick-actions"><a className="action-button" href={`/api/documents/student-status-certificate/${personId}/pdf`}>{t.download}</a><Link className="secondary-button" href={`/certificate/verify?code=${encodeURIComponent(certificate.verificationCode)}`}>{t.verify}</Link><StudentStatusCertificateAction personId={personId} label={t.reissue} /></div></section>
    </>}
  </div>;
}
