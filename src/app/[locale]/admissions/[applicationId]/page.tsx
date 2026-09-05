import { notFound } from "next/navigation";
import { AdmissionActionPanel } from "@/components/admission-action-panel";
import { AdmissionConversionPanel } from "@/components/admission-conversion-panel";
import { getAdmissionDetail } from "@/lib/admissions/detail";
import { admissionDecisionOutcomeLabel, admissionReviewOutcomeLabel, admissionReviewTypeLabel, admissionStateLabel } from "@/lib/admissions/enquiry-labels";
import type { Locale } from "@/lib/i18n/config";
import { getTenantContext } from "@/lib/tenancy/context";

const copy = {
  en: {
    kicker: "Admissions · Application",
    title: "Application review",
    back: "Back to admissions",
    reference: "Tracking reference",
    revision: "Application revision",
    submitted: "Submitted",
    applicant: "Applicant information",
    program: "Program",
    session: "Academic session",
    history: "Review and decision history",
    noHistory: "No staff review has been recorded yet.",
    review: "Review",
    decision: "Decision",
    reason: "Reason",
    notes: "Notes"
  },
  ur: {
    kicker: "داخلہ · درخواست",
    title: "درخواست کا جائزہ",
    back: "داخلہ درخواستوں پر واپس جائیں",
    reference: "ٹریکنگ حوالہ",
    revision: "درخواست کا ورژن",
    submitted: "جمع شدہ",
    applicant: "درخواست گزار کی معلومات",
    program: "پروگرام",
    session: "تعلیمی سال",
    history: "جائزہ اور فیصلے کی تاریخ",
    noHistory: "ابھی کوئی عملہ جائزہ درج نہیں ہوا۔",
    review: "جائزہ",
    decision: "فیصلہ",
    reason: "وجہ",
    notes: "نوٹ"
  },
  ar: {
    kicker: "القبول · الطلب",
    title: "مراجعة الطلب",
    back: "العودة إلى طلبات القبول",
    reference: "مرجع التتبع",
    revision: "نسخة الطلب",
    submitted: "مُقدّم",
    applicant: "بيانات المتقدم",
    program: "البرنامج",
    session: "العام الدراسي",
    history: "سجل المراجعات والقرارات",
    noHistory: "لم يتم تسجيل مراجعة من الموظفين بعد.",
    review: "مراجعة",
    decision: "قرار",
    reason: "السبب",
    notes: "ملاحظات"
  }
} as const;

const fieldLabels: Record<string, Record<Locale, string>> = {
  applicant_name: { en: "Applicant name", ur: "درخواست گزار کا نام", ar: "اسم المتقدم" },
  date_of_birth: { en: "Date of birth", ur: "تاریخ پیدائش", ar: "تاريخ الميلاد" },
  guardian_name: { en: "Guardian name", ur: "سرپرست کا نام", ar: "اسم ولي الأمر" },
  guardian_phone: { en: "Guardian phone", ur: "سرپرست کا فون", ar: "هاتف ولي الأمر" },
  guardian_email: { en: "Guardian email", ur: "سرپرست کا ای میل", ar: "بريد ولي الأمر" },
  address: { en: "Address", ur: "پتہ", ar: "العنوان" }
};

const dateLocales: Record<Locale, string> = { en: "en-IN", ur: "ur-IN", ar: "ar-SA" };

function localized(value: Record<string, string> | null, locale: Locale): string {
  return value?.[locale] || value?.en || "—";
}

function fieldLabel(key: string, locale: Locale): string {
  return fieldLabels[key]?.[locale] || key.replaceAll("_", " ");
}

type AdmissionDetailPageProps = {
  params: Promise<{ locale: string; applicationId: string }>;
};

export default async function AdmissionDetailPage({ params }: AdmissionDetailPageProps) {
  const { locale: rawLocale, applicationId: rawApplicationId } = await params;
  const locale = rawLocale as Locale;
  const applicationId = Number(rawApplicationId);
  const workspace = await getTenantContext();
  if (!workspace || !Number.isSafeInteger(applicationId) || applicationId <= 0) notFound();

  const detail = await getAdmissionDetail(workspace, applicationId);
  if (!detail) notFound();

  const text = copy[locale];
  const historyCount = detail.reviews.length + detail.decisions.length;

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="state-kicker">{text.kicker}</p>
          <h1>{text.title}</h1>
          <p>{admissionStateLabel(locale, detail.state)} · {text.reference}: <code>{detail.trackingId.slice(0, 8)}</code></p>
        </div>
        <a className="action-button" href={`/${locale}/admissions`}>{text.back}</a>
      </section>

      <section className="configuration-detail-grid">
        <article className="configuration-detail-card">
          <span>{text.applicant}</span>
          <h2>{detail.applicantData.applicant_name || "—"}</h2>
          <dl className="term-list">
            {Object.entries(detail.applicantData).map(([key, value]) => (
              <div key={key}>
                <dt>{fieldLabel(key, locale)}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="configuration-detail-card">
          <span>{text.revision}</span>
          <h2>#{detail.revision}</h2>
          <p>{text.program}: {localized(detail.programLabels, locale)}</p>
          <p>{text.session}: {localized(detail.sessionLabels, locale)}</p>
          <p>
            {text.submitted}: {detail.submittedAt
              ? new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium", timeStyle: "short" }).format(new Date(detail.submittedAt))
              : "—"}
          </p>
        </article>

        <AdmissionActionPanel applicationId={detail.id} locale={locale} state={detail.state} />
        <AdmissionConversionPanel
          applicationId={detail.id}
          convertedStudent={detail.convertedStudent}
          duplicateReviewStatus={detail.duplicateReviewStatus}
          locale={locale}
          state={detail.state}
        />
      </section>

      <section className="configuration-section" aria-labelledby="admission-history-title">
        <header className="section-heading">
          <div>
            <p>{historyCount}</p>
            <h2 id="admission-history-title">{text.history}</h2>
          </div>
        </header>

        {historyCount === 0 ? (
          <div className="empty-state"><p>{text.noHistory}</p></div>
        ) : (
          <div className="configuration-module-grid">
            {detail.decisions.map((decision) => (
              <article className="configuration-module" key={`decision-${decision.id}`}>
                <span className="module-state module-state-attention">{text.decision}</span>
                <h3>{admissionDecisionOutcomeLabel(locale, decision.outcome)}</h3>
                <p>{text.reason}: {decision.reason}</p>
                <small>{new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium", timeStyle: "short" }).format(new Date(decision.decidedAt))}</small>
              </article>
            ))}
            {detail.reviews.map((review) => (
              <article className="configuration-module" key={`review-${review.id}`}>
                <span className="module-state module-state-complete">{text.review}</span>
                <h3>{admissionReviewTypeLabel(locale, review.reviewType)} · {admissionReviewOutcomeLabel(locale, review.outcome)}</h3>
                {review.notes ? <p>{text.notes}: {review.notes}</p> : null}
                <small>{new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.createdAt))}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
