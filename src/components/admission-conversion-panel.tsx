"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { admissionStateLabel } from "@/lib/admissions/enquiry-labels";
import type { SupportedLocale } from "@/lib/i18n/config";

type ConvertedStudent = {
  personId: number;
  studentNumber: string;
  enrollmentId: number;
} | null;

type AdmissionConversionPanelProps = {
  applicationId: number;
  state: string;
  locale: SupportedLocale;
  duplicateReviewStatus: string;
  convertedStudent: ConvertedStudent;
};

type PortalAccessState = "existing_account" | "manage_separately";

type ConversionResponse = {
  error?: string;
  duplicateReviewRequired?: boolean;
  candidateCount?: number;
  result?: {
    studentNumber?: string;
    enrollmentId?: number;
    guardianEmail?: string;
    portalAccessState?: PortalAccessState;
    portalAccessWarning?: string;
  };
};

type ActivationView = {
  guardianEmail: string;
  state: PortalAccessState;
  warning: string | null;
  studentNumber: string | null;
};

const copy = {
  en: {
    title: "Student enrollment",
    body: "Convert this accepted application into a permanent student profile and active enrollment. A published student-number sequence is required.",
    enroll: "Enroll as student",
    confirm: "Create separate student anyway",
    working: "Enrolling…",
    success: "Student enrolled successfully.",
    duplicate: "A possible matching person already exists. Review the warning before creating a separate student.",
    existing: "Permanent student record",
    studentNumber: "Student number",
    enrollment: "Enrollment",
    openStudents: "Open Students & Academics",
    unavailable: "Enrollment becomes available only after an admission offer or payment-pending state.",
    error: "Unable to enroll this applicant.",
    activationTitle: "Guardian portal access",
    existingAccount: "This guardian already has verified portal access. No password was changed.",
    unavailableActivation: "Student enrollment is complete. Create or manage the guardian login from Parent & Teacher Access.",
    loginEmail: "Guardian email",
    manageAccess: "Open Parent & Teacher Access",
    done: "Done"
  },
  ur: {
    title: "طالب علم کا اندراج",
    body: "منظور شدہ درخواست کو مستقل طالب علم پروفائل اور فعال اندراج میں تبدیل کریں۔ شائع شدہ طالب علم نمبر ترتیب ضروری ہے۔",
    enroll: "طالب علم کے طور پر داخل کریں",
    confirm: "پھر بھی الگ طالب علم بنائیں",
    working: "اندراج ہو رہا ہے…",
    success: "طالب علم کامیابی سے داخل ہو گیا۔",
    duplicate: "ممکنہ طور پر یہی شخص پہلے سے موجود ہے۔ الگ طالب علم بنانے سے پہلے تنبیہ کا جائزہ لیں۔",
    existing: "مستقل طالب علم ریکارڈ",
    studentNumber: "طالب علم نمبر",
    enrollment: "اندراج",
    openStudents: "طلبہ اور تعلیمی ڈھانچہ کھولیں",
    unavailable: "اندراج صرف داخلہ پیشکش یا ادائیگی زیر التوا حالت کے بعد دستیاب ہوتا ہے۔",
    error: "اس درخواست گزار کو داخل نہیں کیا جا سکا۔",
    activationTitle: "سرپرست پورٹل رسائی",
    existingAccount: "اس سرپرست کی تصدیق شدہ پورٹل رسائی پہلے سے موجود ہے۔ کوئی پاس ورڈ تبدیل نہیں کیا گیا۔",
    unavailableActivation: "طالب علم کا اندراج مکمل ہے۔ والدین و اساتذہ رسائی سے سرپرست کا لاگ اِن بنائیں یا منظم کریں۔",
    loginEmail: "سرپرست کی ای میل",
    manageAccess: "والدین و اساتذہ رسائی کھولیں",
    done: "مکمل"
  }
} as const;

export function AdmissionConversionPanel({
  applicationId,
  state,
  locale,
  duplicateReviewStatus,
  convertedStudent
}: AdmissionConversionPanelProps) {
  const router = useRouter();
  const text = copy[locale];
  const canConvert = state === "offered" || state === "payment_pending";
  const [busy, setBusy] = useState(false);
  const [duplicatePending, setDuplicatePending] = useState(duplicateReviewStatus === "possible");
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activation, setActivation] = useState<ActivationView | null>(null);

  async function convert(confirmNewPerson: boolean) {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admissions/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId, confirmNewPerson })
      });
      const payload = (await response.json().catch(() => ({}))) as ConversionResponse;

      if (!response.ok) {
        if (payload.duplicateReviewRequired) {
          setDuplicatePending(true);
          setCandidateCount(payload.candidateCount ?? null);
          setError(text.duplicate);
        } else {
          setError(payload.error || text.error);
        }
        return;
      }

      setDuplicatePending(false);
      setCandidateCount(null);
      const studentNumber = payload.result?.studentNumber ?? null;
      const guardianEmail = payload.result?.guardianEmail;
      if (guardianEmail) {
        setActivation({
          guardianEmail,
          state: payload.result?.portalAccessState ?? "manage_separately",
          warning: payload.result?.portalAccessWarning ?? null,
          studentNumber
        });
      } else {
        setMessage(studentNumber ? `${text.success} ${text.studentNumber}: ${studentNumber}` : text.success);
        router.refresh();
      }
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }


  function closeActivationView() {
    setActivation(null);
    router.refresh();
  }

  if (activation) {
    return (
      <section className="configuration-detail-card" aria-labelledby="guardian-activation-title">
        <span>{text.success}</span>
        <h2 id="guardian-activation-title">{text.activationTitle}</h2>
        <p>{activation.state === "existing_account" ? text.existingAccount : activation.warning || text.unavailableActivation}</p>
        {activation.studentNumber ? <p>{text.studentNumber}: <code>{activation.studentNumber}</code></p> : null}
        <dl className="detail-list">
          <div>
            <dt>{text.loginEmail}</dt>
            <dd><code>{activation.guardianEmail}</code></dd>
          </div>
        </dl>
        <div className="quick-actions">
          <a className="action-button action-button-primary" href={`/${locale}/portals`}>
            {text.manageAccess}
          </a>
          <button className="action-button" type="button" onClick={closeActivationView}>
            {text.done}
          </button>
        </div>
      </section>
    );
  }

  if (convertedStudent) {
    return (
      <section className="configuration-detail-card" aria-labelledby="admission-conversion-title">
        <span>{admissionStateLabel(locale, state)}</span>
        <h2 id="admission-conversion-title">{text.existing}</h2>
        <p>{text.studentNumber}: <code>{convertedStudent.studentNumber}</code></p>
        <p>{text.enrollment}: #{convertedStudent.enrollmentId}</p>
        <a className="action-button action-button-primary" href={`/${locale}/people-academics`}>
          {text.openStudents}
        </a>
      </section>
    );
  }

  return (
    <section className="configuration-detail-card" aria-labelledby="admission-conversion-title">
      <span>{admissionStateLabel(locale, state)}</span>
      <h2 id="admission-conversion-title">{text.title}</h2>
      <p>{text.body}</p>

      {!canConvert ? <p>{text.unavailable}</p> : null}

      {canConvert ? (
        <div className="quick-actions">
          <button
            className="action-button action-button-primary"
            disabled={busy}
            onClick={() => convert(false)}
            type="button"
          >
            {busy ? text.working : text.enroll}
          </button>
          {duplicatePending ? (
            <button
              className="action-button"
              disabled={busy}
              onClick={() => convert(true)}
              type="button"
            >
              {text.confirm}
            </button>
          ) : null}
        </div>
      ) : null}

      {duplicatePending && candidateCount !== null ? (
        <p className="form-message form-error" role="alert">
          {text.duplicate} ({candidateCount})
        </p>
      ) : null}
      {message ? <p className="form-message" role="status">{message}</p> : null}
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
    </section>
  );
}
