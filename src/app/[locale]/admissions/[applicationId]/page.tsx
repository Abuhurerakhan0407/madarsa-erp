import Link from "next/link";
import { notFound } from "next/navigation";
import { AdmissionSimpleActions } from "@/components/admission-simple-actions";
import { EntityNotFoundState } from "@/components/workspace-ui";
import { getAdmissionDetail } from "@/lib/admissions/detail";
import { admissionDecisionOutcomeLabel, admissionReviewOutcomeLabel, admissionReviewTypeLabel, admissionStateLabel } from "@/lib/admissions/enquiry-labels";
import type { Locale } from "@/lib/i18n/config";
import { getStudentCreateOptions } from "@/lib/students/register";
import { getTenantContext } from "@/lib/tenancy/context";

const copy = {
  en: {
    kicker: "Admissions",
    title: "Application",
    back: "Back to Admissions",
    reference: "Reference",
    submitted: "Submitted",
    applicant: "Applicant details",
    program: "Program",
    session: "Academic year",
    history: "View history",
    noHistory: "No staff review has been recorded yet.",
    review: "Review",
    decision: "Decision",
    reason: "Reason",
    notes: "Notes"
  },
  ur: {
    kicker: "داخلہ",
    title: "درخواست",
    back: "داخلہ پر واپس",
    reference: "حوالہ",
    submitted: "جمع شدہ",
    applicant: "درخواست گزار کی تفصیلات",
    program: "پروگرام",
    session: "تعلیمی سال",
    history: "تاریخ دیکھیں",
    noHistory: "ابھی کوئی عملہ جائزہ درج نہیں ہوا۔",
    review: "جائزہ",
    decision: "فیصلہ",
    reason: "وجہ",
    notes: "نوٹ"
  },
  ar: {
    kicker: "القبول",
    title: "الطلب",
    back: "العودة إلى القبول",
    reference: "المرجع",
    submitted: "مُقدّم",
    applicant: "بيانات المتقدم",
    program: "البرنامج",
    session: "العام الدراسي",
    history: "عرض السجل",
    noHistory: "لم يتم تسجيل مراجعة من الموظفين بعد.",
    review: "مراجعة",
    decision: "قرار",
    reason: "السبب",
    notes: "ملاحظات"
  }
} as const;

const fieldLabels: Record<string, Record<Locale, string>> = {
  applicant_name: { en: "Applicant name", ur: "درخواست گزار کا نام", ar: "اسم المتقدم" },
  native_name: { en: "Native name", ur: "اردو / عربی نام", ar: "الاسم المحلي" },
  date_of_birth: { en: "Date of birth", ur: "تاریخ پیدائش", ar: "تاريخ الميلاد" },
  gender: { en: "Gender", ur: "جنس", ar: "الجنس" },
  guardian_name: { en: "Guardian name", ur: "سرپرست کا نام", ar: "اسم ولي الأمر" },
  guardian_relationship: { en: "Relationship", ur: "رشتہ", ar: "صلة القرابة" },
  guardian_phone: { en: "Guardian phone", ur: "سرپرست کا فون", ar: "هاتف ولي الأمر" },
  guardian_email: { en: "Guardian email", ur: "سرپرست کا ای میل", ar: "بريد ولي الأمر" },
  group_key: { en: "Class / group", ur: "کلاس / گروپ", ar: "الفصل / المجموعة" },
  joining_date: { en: "Joining date", ur: "تاریخ شمولیت", ar: "تاريخ الالتحاق" },
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

  const text = copy[locale];
  const [detail, createOptions] = await Promise.all([
    getAdmissionDetail(workspace, applicationId),
    getStudentCreateOptions(locale)
  ]);
  if (!detail) return <EntityNotFoundState locale={locale} entityLabel={text.title} backHref={`/${locale}/admissions`} backLabel={text.back} />;
  const historyCount = detail.reviews.length + detail.decisions.length;

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="state-kicker">{text.kicker}</p>
          <h1>{text.title}</h1>
          <p>{admissionStateLabel(locale, detail.state)} · {text.reference}: <code>{detail.trackingId.slice(0, 8)}</code></p>
        </div>
        <Link className="action-button" href={`/${locale}/admissions?view=online`}>{text.back}</Link>
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
          <span>{admissionStateLabel(locale, detail.state)}</span>
          <h2>{localized(detail.programLabels, locale)}</h2>
          <p>{text.session}: {localized(detail.sessionLabels, locale)}</p>
          <p>{text.submitted}: {detail.submittedAt
            ? new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium", timeStyle: "short" }).format(new Date(detail.submittedAt))
            : "—"}</p>
        </article>

        <AdmissionSimpleActions
          applicationId={detail.id}
          applicantData={detail.applicantData}
          convertedStudent={detail.convertedStudent}
          duplicateReviewStatus={detail.duplicateReviewStatus}
          groups={createOptions.groups}
          hasUsablePhoto={detail.hasUsablePhoto}
          locale={locale}
          missingConversionFields={detail.missingConversionFields}
          programId={detail.programId}
          sessionId={detail.sessionId}
          state={detail.state}
        />
      </section>

      <details className="configuration-section" data-page-section>
        <summary>{text.history} ({historyCount})</summary>
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
      </details>
    </>
  );
}
