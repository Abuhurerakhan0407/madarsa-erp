"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  };
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
    error: "Unable to enroll this applicant."
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
    error: "اس درخواست گزار کو داخل نہیں کیا جا سکا۔"
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
    error: "تعذر تسجيل هذا المتقدم."
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
      setMessage(
        payload.result?.studentNumber
          ? `${text.success} ${text.studentNumber}: ${payload.result.studentNumber}`
          : text.success
      );
      router.refresh();
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  if (convertedStudent) {
    return (
      <section className="configuration-detail-card" aria-labelledby="admission-conversion-title">
        <span>{state}</span>
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
      <span>{state}</span>
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
