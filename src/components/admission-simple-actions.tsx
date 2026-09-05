"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";

type ConvertedStudent = {
  personId: number;
  studentNumber: string;
  enrollmentId: number;
} | null;

type AdmissionSimpleActionsProps = {
  applicationId: number;
  state: string;
  locale: Locale;
  duplicateReviewStatus: string;
  convertedStudent: ConvertedStudent;
};

type ConvertResponse = {
  error?: string;
  duplicateReviewRequired?: boolean;
  candidateCount?: number;
  result?: {
    personId?: number;
    studentNumber?: string;
    enrollmentId?: number;
    guardianEmail?: string;
    credentialState?: "temporary_password_created" | "existing_account";
    temporaryPassword?: string;
  };
};

type SuccessResult = {
  personId: number;
  studentNumber: string;
  enrollmentId?: number;
  guardianEmail?: string;
  temporaryPassword?: string | null;
  existingAccount?: boolean;
};

const copy = {
  en: {
    title: "What do you want to do?",
    accept: "Accept & Admit",
    request: "Request Information",
    reject: "Reject",
    reason: "Reason / information needed",
    reasonHelp: "Add a clear note before requesting information or rejecting.",
    accepting: "Accepting and admitting…",
    updating: "Updating…",
    requestDone: "Information request recorded. The application remains under review.",
    rejectDone: "Application rejected.",
    error: "Unable to update this application.",
    reasonError: "Write at least 8 characters explaining what is needed.",
    duplicateTitle: "Possible duplicate found",
    duplicate: "A matching student may already exist. Review before creating a separate student.",
    duplicateCount: "possible matching record(s)",
    confirmSeparate: "Create separate student",
    cancelDuplicate: "Cancel",
    admitted: "Student admitted successfully",
    studentNumber: "Student number",
    openProfile: "Open Student Profile",
    credentialsTitle: "Guardian portal credentials",
    credentialsBody: "Copy these credentials now. The temporary password is shown only in this view.",
    existingAccount: "The guardian already has a portal account. Their password was not changed.",
    loginEmail: "Login email",
    temporaryPassword: "Temporary password",
    copy: "Copy credentials",
    copied: "Copied",
    done: "Done"
  },
  ur: {
    title: "آپ کیا کرنا چاہتے ہیں؟",
    accept: "منظور کریں اور داخلہ دیں",
    request: "مزید معلومات مانگیں",
    reject: "مسترد کریں",
    reason: "وجہ / مطلوبہ معلومات",
    reasonHelp: "مزید معلومات مانگنے یا مسترد کرنے سے پہلے واضح نوٹ لکھیں۔",
    accepting: "منظور اور داخلہ کیا جا رہا ہے…",
    updating: "اپ ڈیٹ ہو رہا ہے…",
    requestDone: "مزید معلومات کی درخواست درج ہو گئی۔ درخواست جائزے میں رہے گی۔",
    rejectDone: "درخواست مسترد کر دی گئی۔",
    error: "درخواست اپ ڈیٹ نہیں ہو سکی۔",
    reasonError: "کم از کم 8 حروف میں واضح کریں کہ کیا درکار ہے۔",
    duplicateTitle: "ممکنہ ڈپلیکیٹ ملا",
    duplicate: "ممکن ہے یہی طالب علم پہلے سے موجود ہو۔ الگ ریکارڈ بنانے سے پہلے جائزہ لیں۔",
    duplicateCount: "ممکنہ ملتے جلتے ریکارڈ",
    confirmSeparate: "الگ طالب علم بنائیں",
    cancelDuplicate: "منسوخ",
    admitted: "طالب علم کا داخلہ کامیابی سے ہو گیا",
    studentNumber: "طالب علم نمبر",
    openProfile: "طالب علم پروفائل کھولیں",
    credentialsTitle: "سرپرست پورٹل کی اسناد",
    credentialsBody: "یہ اسناد ابھی کاپی کریں۔ عارضی پاس ورڈ صرف اسی منظر میں دکھایا جاتا ہے۔",
    existingAccount: "سرپرست کا پورٹل اکاؤنٹ پہلے سے موجود ہے۔ پاس ورڈ تبدیل نہیں کیا گیا۔",
    loginEmail: "لاگ اِن ای میل",
    temporaryPassword: "عارضی پاس ورڈ",
    copy: "اسناد کاپی کریں",
    copied: "کاپی ہو گیا",
    done: "مکمل"
  },
  ar: {
    title: "ماذا تريد أن تفعل؟",
    accept: "قبول وتسجيل",
    request: "طلب معلومات",
    reject: "رفض",
    reason: "السبب / المعلومات المطلوبة",
    reasonHelp: "اكتب ملاحظة واضحة قبل طلب معلومات إضافية أو رفض الطلب.",
    accepting: "جارٍ القبول والتسجيل…",
    updating: "جارٍ التحديث…",
    requestDone: "تم تسجيل طلب المعلومات وسيبقى الطلب قيد المراجعة.",
    rejectDone: "تم رفض الطلب.",
    error: "تعذر تحديث الطلب.",
    reasonError: "اكتب 8 أحرف على الأقل لشرح المطلوب.",
    duplicateTitle: "تم العثور على تطابق محتمل",
    duplicate: "قد يكون هذا الطالب موجودًا بالفعل. راجع التحذير قبل إنشاء طالب منفصل.",
    duplicateCount: "سجل/سجلات محتملة المطابقة",
    confirmSeparate: "إنشاء طالب منفصل",
    cancelDuplicate: "إلغاء",
    admitted: "تم قبول الطالب بنجاح",
    studentNumber: "رقم الطالب",
    openProfile: "فتح ملف الطالب",
    credentialsTitle: "بيانات دخول ولي الأمر",
    credentialsBody: "انسخ بيانات الدخول الآن. تظهر كلمة المرور المؤقتة في هذا العرض فقط.",
    existingAccount: "لدى ولي الأمر حساب بوابة موجود بالفعل. لم يتم تغيير كلمة المرور.",
    loginEmail: "بريد تسجيل الدخول",
    temporaryPassword: "كلمة المرور المؤقتة",
    copy: "نسخ بيانات الدخول",
    copied: "تم النسخ",
    done: "تم"
  }
} as const;

export function AdmissionSimpleActions({ applicationId, state, locale, duplicateReviewStatus, convertedStudent }: AdmissionSimpleActionsProps) {
  const text = copy[locale];
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"accept" | "request_information" | "reject" | "duplicate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [duplicatePending, setDuplicatePending] = useState(duplicateReviewStatus === "possible");
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [success, setSuccess] = useState<SuccessResult | null>(
    convertedStudent ? { personId: convertedStudent.personId, studentNumber: convertedStudent.studentNumber, enrollmentId: convertedStudent.enrollmentId } : null
  );
  const [copied, setCopied] = useState(false);

  const canAccept = ["submitted", "verification", "decision", "offered", "payment_pending"].includes(state) && !convertedStudent;
  const canRequest = ["submitted", "verification"].includes(state) && !convertedStudent;
  const canReject = ["submitted", "verification", "decision"].includes(state) && !convertedStudent;

  async function simpleAction(action: "accept" | "request_information" | "reject") {
    const response = await fetch("/api/admissions/simple-action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, action, ...(reason.trim() ? { reason: reason.trim() } : {}) })
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; result?: { state?: string } };
    if (!response.ok) throw new Error(payload.error || text.error);
    return payload.result?.state ?? state;
  }

  async function convert(confirmNewPerson: boolean) {
    const response = await fetch("/api/admissions/convert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, confirmNewPerson })
    });
    const payload = await response.json().catch(() => ({})) as ConvertResponse;
    if (!response.ok) {
      if (payload.duplicateReviewRequired) {
        setDuplicatePending(true);
        setCandidateCount(payload.candidateCount ?? 0);
        setError(payload.error || text.duplicate);
        return false;
      }
      throw new Error(payload.error || text.error);
    }
    if (!payload.result?.personId || !payload.result.studentNumber) throw new Error(text.error);
    setDuplicatePending(false);
    setCandidateCount(null);
    setSuccess({
      personId: payload.result.personId,
      studentNumber: payload.result.studentNumber,
      enrollmentId: payload.result.enrollmentId,
      guardianEmail: payload.result.guardianEmail,
      temporaryPassword: payload.result.credentialState === "temporary_password_created" ? payload.result.temporaryPassword ?? null : null,
      existingAccount: payload.result.credentialState === "existing_account"
    });
    return true;
  }

  async function acceptAndAdmit(confirmNewPerson = false) {
    setBusy(confirmNewPerson ? "duplicate" : "accept");
    setError(null);
    setMessage(null);
    setCopied(false);
    try {
      if (!confirmNewPerson) await simpleAction("accept");
      const converted = await convert(confirmNewPerson);
      if (converted) router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.error);
    } finally {
      setBusy(null);
    }
  }

  async function runReviewAction(action: "request_information" | "reject") {
    setError(null);
    setMessage(null);
    if (reason.trim().length < 8) {
      setError(text.reasonError);
      return;
    }
    setBusy(action);
    try {
      await simpleAction(action);
      setReason("");
      setMessage(action === "request_information" ? text.requestDone : text.rejectDone);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.error);
    } finally {
      setBusy(null);
    }
  }

  async function copyCredentials() {
    if (!success?.guardianEmail || !success.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(`${text.loginEmail}: ${success.guardianEmail}\n${text.temporaryPassword}: ${success.temporaryPassword}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (success) {
    return (
      <section className="configuration-detail-card" aria-labelledby="admission-success-title">
        <span className="module-state module-state-complete">✓</span>
        <h2 id="admission-success-title">{text.admitted}</h2>
        <p>{text.studentNumber}: <code>{success.studentNumber}</code></p>
        {success.guardianEmail ? (
          <div>
            <h3>{text.credentialsTitle}</h3>
            <p>{success.existingAccount ? text.existingAccount : text.credentialsBody}</p>
            <dl className="detail-list">
              <div><dt>{text.loginEmail}</dt><dd><code>{success.guardianEmail}</code></dd></div>
              {success.temporaryPassword ? <div><dt>{text.temporaryPassword}</dt><dd><code>{success.temporaryPassword}</code></dd></div> : null}
            </dl>
          </div>
        ) : null}
        <div className="quick-actions">
          <a className="action-button action-button-primary" href={`/${locale}/students/${success.personId}`}>{text.openProfile}</a>
          {success.temporaryPassword ? <button className="action-button" type="button" onClick={copyCredentials}>{copied ? text.copied : text.copy}</button> : null}
          <button className="action-button" type="button" onClick={() => { setSuccess(null); router.refresh(); }}>{text.done}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="configuration-detail-card" aria-labelledby="simple-admission-actions-title">
      <h2 id="simple-admission-actions-title">{text.title}</h2>

      {(canRequest || canReject) ? (
        <label className="field-label">
          {text.reason}
          <textarea className="text-field" maxLength={2000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={text.reasonHelp} />
        </label>
      ) : null}

      <div className="quick-actions">
        {canAccept ? <button className="action-button action-button-primary" type="button" disabled={busy !== null} onClick={() => acceptAndAdmit(false)}>{busy === "accept" ? text.accepting : text.accept}</button> : null}
        {canRequest ? <button className="action-button" type="button" disabled={busy !== null} onClick={() => runReviewAction("request_information")}>{busy === "request_information" ? text.updating : text.request}</button> : null}
        {canReject ? <button className="action-button" type="button" disabled={busy !== null} onClick={() => runReviewAction("reject")}>{busy === "reject" ? text.updating : text.reject}</button> : null}
      </div>

      {duplicatePending ? (
        <div className="form-message form-error" role="alert">
          <strong>{text.duplicateTitle}</strong>
          <p>{error || text.duplicate}</p>
          {candidateCount !== null ? <p>{candidateCount} {text.duplicateCount}</p> : null}
          <div className="quick-actions">
            <button className="action-button" type="button" disabled={busy !== null} onClick={() => { setDuplicatePending(false); setCandidateCount(null); setError(null); }}>{text.cancelDuplicate}</button>
            <button className="action-button action-button-primary" type="button" disabled={busy !== null} onClick={() => acceptAndAdmit(true)}>{busy === "duplicate" ? text.accepting : text.confirmSeparate}</button>
          </div>
        </div>
      ) : null}

      {!duplicatePending && error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </section>
  );
}
