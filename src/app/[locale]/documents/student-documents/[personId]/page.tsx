import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type SupportedLocale } from "@/lib/i18n/config";
import { getStudentDocumentStatus } from "@/lib/documents/student-files";

const copy = {
  en: {
    kicker: "Student documents", title: "Document status", back: "Back to documents",
    requirement: "No required-document checklist is configured in the current data model. This view shows actual documents linked to this student only.",
    empty: "No stored documents are linked to this student yet.", category: "Category", status: "Status",
    issued: "Issued", expires: "Expires", updated: "Updated", file: "File", download: "Open / download",
    profile: "Student profile", profilePdf: "Profile PDF", idCard: "ID card", certificate: "Status certificate"
  },
  ur: {
    kicker: "طالب علم دستاویزات", title: "دستاویز کی حالت", back: "دستاویزات پر واپس",
    requirement: "موجودہ ڈیٹا ماڈل میں لازمی دستاویزات کی چیک لسٹ ترتیب نہیں دی گئی۔ یہاں صرف اس طالب علم سے حقیقی طور پر منسلک دستاویزات دکھائی جاتی ہیں۔",
    empty: "ابھی اس طالب علم کے ساتھ کوئی محفوظ دستاویز منسلک نہیں۔", category: "قسم", status: "حالت",
    issued: "جاری", expires: "میعاد", updated: "اپ ڈیٹ", file: "فائل", download: "کھولیں / ڈاؤن لوڈ",
    profile: "طالب علم پروفائل", profilePdf: "پروفائل PDF", idCard: "ID کارڈ", certificate: "حیثیت سرٹیفکیٹ"
  }
} as const;

const statusLabels = {
  en: { draft: "Draft", active: "Active", expired: "Expired", revoked: "Revoked", archived: "Archived" },
  ur: { draft: "مسودہ", active: "فعال", expired: "میعاد ختم", revoked: "منسوخ", archived: "محفوظ شدہ" }
} as const;

function date(value: string | null, locale: SupportedLocale) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-IN" : "en-IN", { dateStyle: "medium" }).format(parsed);
}

export default async function StudentDocumentsPage({ params }: { params: Promise<{ locale: string; personId: string }> }) {
  const raw = await params;
  if (!isLocale(raw.locale)) notFound();
  const locale: SupportedLocale = raw.locale;
  const personId = Number(raw.personId);
  if (!Number.isSafeInteger(personId) || personId <= 0) notFound();
  const data = await getStudentDocumentStatus(personId, locale);
  if (!data) notFound();
  const text = copy[locale];
  const labels = statusLabels[locale] as Record<string, string>;

  return <>
    <section className="page-heading">
      <div><p className="state-kicker">{text.kicker}</p><h1>{text.title}</h1><p>{data.student.name} · {data.student.studentNumber}</p>{data.student.nativeName ? <p dir="auto">{data.student.nativeName}</p> : null}</div>
      <Link className="action-button" href={`/${locale}/documents?student=${personId}`}>{text.back}</Link>
    </section>
    <section className="panel"><div className="privacy-callout"><strong>{text.requirement}</strong></div></section>
    <section className="panel">
      <div className="quick-actions">
        <Link className="action-button" href={`/${locale}/students/${personId}`}>{text.profile}</Link>
        <Link className="action-button" href={`/${locale}/documents?type=student_profile&student=${personId}`}>{text.profilePdf}</Link>
        <Link className="action-button" href={`/${locale}/students/${personId}/id-card`}>{text.idCard}</Link>
        <Link className="action-button" href={`/${locale}/documents/student-status/${personId}`}>{text.certificate}</Link>
      </div>
    </section>
    <section className="panel">
      {data.documents.length === 0 ? <p className="empty-state">{text.empty}</p> : <div className="flow-stack">
        {data.documents.map((document) => <article className="student-detail-grid" key={document.id}>
          <div><span>{text.category}</span><strong>{document.category}</strong></div>
          <div><span>{text.status}</span><strong>{labels[document.status] ?? document.status}</strong></div>
          <div><span>{text.issued}</span><strong>{date(document.issuedOn, locale)}</strong></div>
          <div><span>{text.expires}</span><strong>{date(document.expiresOn, locale)}</strong></div>
          <div><span>{text.updated}</span><strong>{date(document.updatedAt, locale)}</strong></div>
          <div><span>{text.file}</span><strong>{document.fileName ?? "—"}</strong></div>
          <div><span>{document.title}</span>{document.hasFile ? <a className="action-button" href={`/api/students/${personId}/documents/${document.id}/download`}>{text.download}</a> : <strong>—</strong>}</div>
        </article>)}
      </div>}
    </section>
  </>;
}
