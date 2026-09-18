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

type PortalAccessState = "claim_code_issued" | "existing_account" | "claim_code_unavailable" | "manage_separately";

type ConversionResponse = {
  error?: string;
  duplicateReviewRequired?: boolean;
  candidateCount?: number;
  result?: {
    studentNumber?: string;
    enrollmentId?: number;
    guardianEmail?: string;
    portalAccessState?: PortalAccessState;
    claimCode?: string;
    claimPath?: string;
    portalAccessWarning?: string;
  };
};

type ActivationView = {
  guardianEmail: string;
  state: PortalAccessState;
  claimCode: string | null;
  claimPath: string | null;
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
    activationTitle: "Guardian portal activation",
    activationBody: "Share this one-time claim code with the guardian. They sign in with their own account and claim access; staff never creates or shares a password.",
    existingAccount: "This guardian already has verified portal access. No password or login secret was changed.",
    unavailableActivation: "The student is enrolled, but portal activation needs attention. Issue or manage the guardian claim code from Parent & Teacher Access.",
    loginEmail: "Guardian email",
    claimCode: "One-time claim code",
    claimLink: "Claim link",
    copyActivation: "Copy activation details",
    copied: "Copied",
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
    activationTitle: "سرپرست پورٹل فعال کریں",
    activationBody: "یہ ایک بار استعمال ہونے والا کلیم کوڈ سرپرست کو دیں۔ وہ اپنے اکاؤنٹ سے لاگ اِن ہو کر رسائی کلیم کرے گا؛ عملہ کوئی پاس ورڈ بناتا یا شیئر نہیں کرتا۔",
    existingAccount: "اس سرپرست کی تصدیق شدہ پورٹل رسائی پہلے سے موجود ہے۔ کوئی پاس ورڈ یا لاگ اِن راز تبدیل نہیں کیا گیا۔",
    unavailableActivation: "طالب علم داخل ہو گیا ہے، لیکن پورٹل فعال کرنے پر توجہ درکار ہے۔ والدین اور اساتذہ کی رسائی سے کلیم کوڈ جاری یا منظم کریں۔",
    loginEmail: "سرپرست کی ای میل",
    claimCode: "ایک بار استعمال ہونے والا کلیم کوڈ",
    claimLink: "کلیم لنک",
    copyActivation: "فعال کرنے کی تفصیل کاپی کریں",
    copied: "کاپی ہو گیا",
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
  const [copied, setCopied] = useState(false);

  async function convert(confirmNewPerson: boolean) {
    setBusy(true);
    setMessage(null);
    setError(null);
    setCopied(false);

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
          claimCode: payload.result?.claimCode ?? null,
          claimPath: payload.result?.claimPath ?? null,
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

  async function copyActivation() {
    if (!activation?.claimCode || !activation.claimPath) return;
    const value = `${text.loginEmail}: ${activation.guardianEmail}\n${text.claimCode}: ${activation.claimCode}\n${text.claimLink}: ${activation.claimPath}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function closeActivationView() {
    setActivation(null);
    setCopied(false);
    router.refresh();
  }

  if (activation) {
    const claimIssued = activation.state === "claim_code_issued" && activation.claimCode && activation.claimPath;
    return (
      <section className="configuration-detail-card" aria-labelledby="guardian-activation-title">
        <span>{text.success}</span>
        <h2 id="guardian-activation-title">{text.activationTitle}</h2>
        {claimIssued ? <p>{text.activationBody}</p> : activation.state === "existing_account" ? <p>{text.existingAccount}</p> : <p>{activation.warning || text.unavailableActivation}</p>}
        {activation.studentNumber ? <p>{text.studentNumber}: <code>{activation.studentNumber}</code></p> : null}
        <dl className="detail-list">
          <div>
            <dt>{text.loginEmail}</dt>
            <dd><code>{activation.guardianEmail}</code></dd>
          </div>
          {claimIssued ? (
            <>
              <div>
                <dt>{text.claimCode}</dt>
                <dd><code>{activation.claimCode}</code></dd>
              </div>
              <div>
                <dt>{text.claimLink}</dt>
                <dd><code>{activation.claimPath}</code></dd>
              </div>
            </>
          ) : null}
        </dl>
        <div className="quick-actions">
          {claimIssued ? (
            <button className="action-button" type="button" onClick={copyActivation}>
              {copied ? text.copied : text.copyActivation}
            </button>
          ) : null}
          <button className="action-button action-button-primary" type="button" onClick={closeActivationView}>
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
