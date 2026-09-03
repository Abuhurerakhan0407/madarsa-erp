"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { admissionStateLabel } from "@/lib/admissions/enquiry-labels";
import type { Locale } from "@/lib/i18n/config";

type ConvertedStudent = {
  personId: number;
  studentNumber: string;
  enrollmentId: number;
} | null;

type AdmissionConversionPanelProps = {
  applicationId: number;
  state: string;
  locale: Locale;
  duplicateReviewStatus: string;
  convertedStudent: ConvertedStudent;
};

type ConversionResponse = {
  error?: string;
  duplicateReviewRequired?: boolean;
  candidateCount?: number;
  result?: {
    studentNumber?: string;
    enrollmentId?: number;
    guardianEmail?: string;
    credentialState?: "temporary_password_created" | "existing_account";
    temporaryPassword?: string;
  };
};

type CredentialView = {
  guardianEmail: string;
  temporaryPassword: string | null;
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
    credentialsTitle: "Guardian portal credentials",
    credentialsBody: "Copy and send these credentials now. The temporary password will disappear permanently when you close this view.",
    loginEmail: "Login email",
    temporaryPassword: "Temporary password",
    existingAccount: "This guardian already has a portal account. Their existing password was not changed.",
    copyCredentials: "Copy credentials",
    copied: "Copied",
    done: "Done — hide credentials"
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
    credentialsTitle: "سرپرست پورٹل کی اسناد",
    credentialsBody: "یہ اسناد ابھی کاپی کر کے بھیج دیں۔ اس منظر کو بند کرنے کے بعد عارضی پاس ورڈ دوبارہ نہیں دکھایا جائے گا۔",
    loginEmail: "لاگ اِن ای میل",
    temporaryPassword: "عارضی پاس ورڈ",
    existingAccount: "اس سرپرست کا پورٹل اکاؤنٹ پہلے سے موجود ہے۔ موجودہ پاس ورڈ تبدیل نہیں کیا گیا۔",
    copyCredentials: "اسناد کاپی کریں",
    copied: "کاپی ہو گیا",
    done: "مکمل — اسناد چھپائیں"
  },
  ar: {
    title: "تسجيل الطالب",
    body: "حوّل طلب القبول المقبول إلى ملف طالب دائم وتسجيل نشط. يلزم وجود تسلسل منشور لأرقام الطلاب.",
    enroll: "تسجيل كطالب",
    confirm: "إنشاء طالب منفصل رغم ذلك",
    working: "جارٍ التسجيل…",
    success: "تم تسجيل الطالب بنجاح.",
    duplicate: "قد يكون هناك شخص مطابق موجود بالفعل. راجع التحذير قبل إنشاء طالب منفصل.",
    existing: "سجل الطالب الدائم",
    studentNumber: "رقم الطالب",
    enrollment: "التسجيل",
    openStudents: "فتح الطلاب والهيكل الأكاديمي",
    unavailable: "يصبح التسجيل متاحًا فقط بعد عرض القبول أو حالة انتظار الدفع.",
    error: "تعذر تسجيل هذا المتقدم.",
    credentialsTitle: "بيانات دخول ولي الأمر",
    credentialsBody: "انسخ بيانات الدخول وأرسلها الآن. ستختفي كلمة المرور المؤقتة نهائيًا عند إغلاق هذا العرض.",
    loginEmail: "بريد تسجيل الدخول",
    temporaryPassword: "كلمة المرور المؤقتة",
    existingAccount: "لدى ولي الأمر حساب بوابة موجود بالفعل. لم يتم تغيير كلمة المرور الحالية.",
    copyCredentials: "نسخ بيانات الدخول",
    copied: "تم النسخ",
    done: "تم — إخفاء بيانات الدخول"
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
  const [credentials, setCredentials] = useState<CredentialView | null>(null);
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
        setCredentials({
          guardianEmail,
          temporaryPassword: payload.result?.credentialState === "temporary_password_created"
            ? payload.result.temporaryPassword ?? null
            : null,
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

  async function copyCredentials() {
    if (!credentials?.temporaryPassword) return;
    const value = `${text.loginEmail}: ${credentials.guardianEmail}\n${text.temporaryPassword}: ${credentials.temporaryPassword}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function closeCredentialView() {
    setCredentials(null);
    setCopied(false);
    router.refresh();
  }

  if (credentials) {
    return (
      <section className="configuration-detail-card" aria-labelledby="guardian-credentials-title">
        <span>{text.success}</span>
        <h2 id="guardian-credentials-title">{text.credentialsTitle}</h2>
        {credentials.temporaryPassword ? <p>{text.credentialsBody}</p> : <p>{text.existingAccount}</p>}
        {credentials.studentNumber ? <p>{text.studentNumber}: <code>{credentials.studentNumber}</code></p> : null}
        <dl className="detail-list">
          <div>
            <dt>{text.loginEmail}</dt>
            <dd><code>{credentials.guardianEmail}</code></dd>
          </div>
          {credentials.temporaryPassword ? (
            <div>
              <dt>{text.temporaryPassword}</dt>
              <dd><code>{credentials.temporaryPassword}</code></dd>
            </div>
          ) : null}
        </dl>
        <div className="quick-actions">
          {credentials.temporaryPassword ? (
            <button className="action-button" type="button" onClick={copyCredentials}>
              {copied ? text.copied : text.copyCredentials}
            </button>
          ) : null}
          <button className="action-button action-button-primary" type="button" onClick={closeCredentialView}>
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
