import Link from "next/link";
import { verifyStudentStatusCertificate } from "@/lib/documents/student-status";

const copy = {
  en: { kicker: "Document verification", title: "Student Status Certificate", code: "Verification code", verify: "Verify certificate", valid: "Verified active document", invalid: "No active public certificate matches this verification code.", prompt: "Enter the verification code printed on the certificate.", student: "Student ID", institution: "Institution", campus: "Campus", program: "Program", group: "Class / group", issued: "Issued on", revision: "Revision" },
  ur: { kicker: "دستاویز کی تصدیق", title: "طالب علم حیثیت سرٹیفکیٹ", code: "تصدیقی کوڈ", verify: "سرٹیفکیٹ کی تصدیق کریں", valid: "فعال دستاویز کی تصدیق ہوگئی", invalid: "اس تصدیقی کوڈ کے مطابق کوئی فعال عوامی سرٹیفکیٹ نہیں ملا۔", prompt: "سرٹیفکیٹ پر درج تصدیقی کوڈ درج کریں۔", student: "طالب علم ID", institution: "ادارہ", campus: "کیمپس", program: "پروگرام", group: "کلاس / گروپ", issued: "جاری ہونے کی تاریخ", revision: "ورژن" }
} as const;

export default async function CertificateVerificationPage({ searchParams }: { searchParams: Promise<{ code?: string; locale?: string }> }) {
  const query = await searchParams;
  const locale = query.locale === "ur" ? "ur" : "en";
  const t = copy[locale];
  const code = typeof query.code === "string" ? query.code.trim().toUpperCase() : "";
  const certificate = code ? await verifyStudentStatusCertificate(code) : null;
  return <main className="auth-page" lang={locale} dir={locale === "ur" ? "rtl" : "ltr"}><section className="auth-card">
    <nav className="quick-actions" aria-label="Language"><Link className="secondary-button" href={`/certificate/verify?locale=en${code ? `&code=${encodeURIComponent(code)}` : ""}`}>English</Link><Link className="secondary-button" href={`/certificate/verify?locale=ur${code ? `&code=${encodeURIComponent(code)}` : ""}`}>اردو</Link></nav>
    <p className="eyebrow">{t.kicker}</p><h1>{t.title}</h1>
    <form method="get" className="field-stack"><input type="hidden" name="locale" value={locale}/><label className="field-label">{t.code}<input className="text-field" name="code" defaultValue={code} placeholder="SSC-XXXXXXXXXXXXXXXX" autoComplete="off" /></label><button className="action-button" type="submit">{t.verify}</button></form>
    {code ? certificate ? <section className="panel"><p className="state-kicker">{t.valid}</p><h2>{locale === "ur" && certificate.snapshot.studentNameNative ? certificate.snapshot.studentNameNative : certificate.snapshot.studentName}</h2><div className="detail-grid"><div><span>{t.student}</span><strong>{certificate.snapshot.studentNumber}</strong></div><div><span>{t.institution}</span><strong>{certificate.snapshot.tenantName}</strong></div><div><span>{t.campus}</span><strong>{certificate.snapshot.branchName}</strong></div><div><span>{t.program}</span><strong>{certificate.snapshot.program}</strong></div><div><span>{t.group}</span><strong>{certificate.snapshot.classGroup}</strong></div><div><span>{t.issued}</span><strong>{certificate.snapshot.issuedOn}</strong></div><div><span>{t.revision}</span><strong>{certificate.revision}</strong></div><div><span>{t.code}</span><strong className="verification-code">{certificate.verificationCode}</strong></div></div></section> : <p className="form-message form-error" role="alert">{t.invalid}</p> : <p>{t.prompt}</p>}
  </section></main>;
}
