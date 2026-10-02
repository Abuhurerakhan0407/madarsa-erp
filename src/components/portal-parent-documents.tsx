import Link from "next/link";
import type { SupportedLocale } from "@/lib/i18n/config";
import { formatPortalDateTime } from "@/lib/portal/locale";
import type { PortalGuardianDocumentChild } from "@/lib/portal/documents";

const copy = {
  en: {
    kicker: "Documents",
    title: "IDs & certificates",
    body: "Private downloads are limited to students linked to this verified guardian account.",
    idCard: "Download student ID",
    statusCertificate: "Download status certificate",
    notIssued: "Status certificate has not been issued yet.",
    issued: "Issued",
    class: "Class",
    program: "Program"
  },
  ur: {
    kicker: "دستاویزات",
    title: "شناختی کارڈ اور سرٹیفکیٹس",
    body: "نجی ڈاؤن لوڈ صرف اس تصدیق شدہ سرپرست اکاؤنٹ سے منسلک طلبہ تک محدود ہیں۔",
    idCard: "طالب علم کا شناختی کارڈ ڈاؤن لوڈ کریں",
    statusCertificate: "اسٹیٹس سرٹیفکیٹ ڈاؤن لوڈ کریں",
    notIssued: "اسٹیٹس سرٹیفکیٹ ابھی جاری نہیں ہوا۔",
    issued: "جاری شدہ",
    class: "کلاس",
    program: "پروگرام"
  }
} as const;

export function PortalParentDocuments({ tenantId, locale, students }: { tenantId: number; locale: SupportedLocale; students: PortalGuardianDocumentChild[] }) {
  if (!students.length) return null;
  const t = copy[locale];
  return <section className="professional-card" data-testid="parent-portal-documents">
    <div className="section-heading"><div><p className="state-kicker">{t.kicker}</p><h2>{t.title}</h2><p>{t.body}</p></div></div>
    <div className="demo-card-grid">      {students.map((child) => <article className="demo-card" key={child.personId}>
        <p className="state-kicker">{child.studentNumber}</p>
        <h3>{child.displayName}</h3>
        {child.nativeName ? <p>{child.nativeName}</p> : null}
        <small>{t.program}: {child.programLabel} · {t.class}: {child.groupLabel}</small>
        <div className="quick-actions" style={{ marginTop: 12 }}>
          <Link className="action-button action-button-primary" href={`/api/portal/id-card/${child.personId}/pdf?tenant=${tenantId}`}>{t.idCard}</Link>
          {child.statusCertificate ? <Link className="action-button" href={`/api/portal/student-status/${child.personId}/pdf?tenant=${tenantId}`}>{t.statusCertificate}</Link> : null}
        </div>
        {child.statusCertificate
          ? <small>{t.issued}: {formatPortalDateTime(child.statusCertificate.issuedAt, locale)}</small>
          : <small>{t.notIssued}</small>}
      </article>)}
    </div>
  </section>;
}
