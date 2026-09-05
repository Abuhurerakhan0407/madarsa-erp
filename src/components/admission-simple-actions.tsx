"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n/config";

type ConvertedStudent = {
  personId: number;
  studentNumber: string;
  enrollmentId: number;
} | null;

type GroupOption = { key: string; label: string; sessionId: number; programId: number };

type AdmissionSimpleActionsProps = {
  applicationId: number;
  state: string;
  locale: Locale;
  duplicateReviewStatus: string;
  convertedStudent: ConvertedStudent;
  applicantData: Record<string, string>;
  groups: GroupOption[];
  sessionId: number;
  programId: number;
  hasUsablePhoto: boolean;
  missingConversionFields: string[];
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
    title: "What do you want to do?", accept: "Accept & Admit", request: "Request Information", reject: "Reject",
    reason: "Reason / information needed", reasonHelp: "Add a clear note before requesting information or rejecting.",
    accepting: "Accepting and admitting…", updating: "Updating…", requestDone: "Information request recorded. The application remains under review.", rejectDone: "Application rejected.",
    error: "Unable to update this application.", reasonError: "Write at least 8 characters explaining what is needed.",
    completeTitle: "Complete admission details", completeBody: "This older application is missing information required to create the permanent student record. Add it once, then continue.",
    native: "Name in Urdu / Arabic", gender: "Gender", guardianName: "Guardian name", relationship: "Relationship", phone: "Mobile / WhatsApp", email: "Guardian email", group: "Class / group", joining: "Joining date", photo: "Student photo", photoHelp: "JPEG, PNG or WebP up to 5 MB.",
    male: "Male", female: "Female", otherGender: "Other", undisclosed: "Undisclosed", father: "Father", mother: "Mother", guardian: "Guardian", otherRelationship: "Other", select: "Select", saveContinue: "Save & Continue", savingDetails: "Saving details…",
    duplicateTitle: "Possible duplicate found", duplicate: "A matching student may already exist. Review before creating a separate student.", duplicateCount: "possible matching record(s)", confirmSeparate: "Create separate student", cancelDuplicate: "Cancel",
    admitted: "Student admitted successfully", studentNumber: "Student number", openProfile: "Open Student Profile",
    credentialsTitle: "Guardian portal credentials", credentialsBody: "Copy these credentials now. The temporary password is shown only in this view.", existingAccount: "The guardian already has a portal account. Their password was not changed.", loginEmail: "Login email", temporaryPassword: "Temporary password", copy: "Copy credentials", copied: "Copied", done: "Done"
  },
  ur: {
    title: "آپ کیا کرنا چاہتے ہیں؟", accept: "منظور کریں اور داخلہ دیں", request: "مزید معلومات مانگیں", reject: "مسترد کریں",
    reason: "وجہ / مطلوبہ معلومات", reasonHelp: "مزید معلومات مانگنے یا مسترد کرنے سے پہلے واضح نوٹ لکھیں۔",
    accepting: "منظور اور داخلہ کیا جا رہا ہے…", updating: "اپ ڈیٹ ہو رہا ہے…", requestDone: "مزید معلومات کی درخواست درج ہو گئی۔ درخواست جائزے میں رہے گی۔", rejectDone: "درخواست مسترد کر دی گئی۔",
    error: "درخواست اپ ڈیٹ نہیں ہو سکی۔", reasonError: "کم از کم 8 حروف میں واضح کریں کہ کیا درکار ہے۔",
    completeTitle: "داخلہ کی تفصیلات مکمل کریں", completeBody: "اس پرانی درخواست میں مستقل طالب علم ریکارڈ بنانے کے لیے کچھ ضروری معلومات موجود نہیں ہیں۔ انہیں ایک بار مکمل کریں۔",
    native: "اردو / عربی نام", gender: "جنس", guardianName: "سرپرست کا نام", relationship: "رشتہ", phone: "موبائل / واٹس ایپ", email: "سرپرست ای میل", group: "کلاس / گروپ", joining: "تاریخ شمولیت", photo: "طالب علم کی تصویر", photoHelp: "JPEG، PNG یا WebP، زیادہ سے زیادہ 5 MB۔",
    male: "مرد", female: "خاتون", otherGender: "دیگر", undisclosed: "درج نہیں", father: "والد", mother: "والدہ", guardian: "سرپرست", otherRelationship: "دیگر", select: "منتخب کریں", saveContinue: "محفوظ کریں اور جاری رکھیں", savingDetails: "تفصیلات محفوظ ہو رہی ہیں…",
    duplicateTitle: "ممکنہ ڈپلیکیٹ ملا", duplicate: "ممکن ہے یہی طالب علم پہلے سے موجود ہو۔ الگ ریکارڈ بنانے سے پہلے جائزہ لیں۔", duplicateCount: "ممکنہ ملتے جلتے ریکارڈ", confirmSeparate: "الگ طالب علم بنائیں", cancelDuplicate: "منسوخ",
    admitted: "طالب علم کا داخلہ کامیابی سے ہو گیا", studentNumber: "طالب علم نمبر", openProfile: "طالب علم پروفائل کھولیں",
    credentialsTitle: "سرپرست پورٹل کی اسناد", credentialsBody: "یہ اسناد ابھی کاپی کریں۔ عارضی پاس ورڈ صرف اسی منظر میں دکھایا جاتا ہے۔", existingAccount: "سرپرست کا پورٹل اکاؤنٹ پہلے سے موجود ہے۔ پاس ورڈ تبدیل نہیں کیا گیا۔", loginEmail: "لاگ اِن ای میل", temporaryPassword: "عارضی پاس ورڈ", copy: "اسناد کاپی کریں", copied: "کاپی ہو گیا", done: "مکمل"
  },
  ar: {
    title: "ماذا تريد أن تفعل؟", accept: "قبول وتسجيل", request: "طلب معلومات", reject: "رفض",
    reason: "السبب / المعلومات المطلوبة", reasonHelp: "اكتب ملاحظة واضحة قبل طلب معلومات إضافية أو رفض الطلب.",
    accepting: "جارٍ القبول والتسجيل…", updating: "جارٍ التحديث…", requestDone: "تم تسجيل طلب المعلومات وسيبقى الطلب قيد المراجعة.", rejectDone: "تم رفض الطلب.",
    error: "تعذر تحديث الطلب.", reasonError: "اكتب 8 أحرف على الأقل لشرح المطلوب.",
    completeTitle: "إكمال بيانات القبول", completeBody: "يفتقد هذا الطلب القديم بعض البيانات اللازمة لإنشاء سجل الطالب الدائم. أكملها مرة واحدة ثم تابع.",
    native: "الاسم بالأردية / العربية", gender: "الجنس", guardianName: "اسم ولي الأمر", relationship: "صلة القرابة", phone: "الجوال / واتساب", email: "بريد ولي الأمر", group: "الفصل / المجموعة", joining: "تاريخ الالتحاق", photo: "صورة الطالب", photoHelp: "JPEG أو PNG أو WebP حتى 5 MB.",
    male: "ذكر", female: "أنثى", otherGender: "آخر", undisclosed: "غير مذكور", father: "الأب", mother: "الأم", guardian: "ولي أمر", otherRelationship: "أخرى", select: "اختر", saveContinue: "حفظ ومتابعة", savingDetails: "جارٍ حفظ البيانات…",
    duplicateTitle: "تم العثور على تطابق محتمل", duplicate: "قد يكون هذا الطالب موجودًا بالفعل. راجع التحذير قبل إنشاء طالب منفصل.", duplicateCount: "سجل/سجلات محتملة المطابقة", confirmSeparate: "إنشاء طالب منفصل", cancelDuplicate: "إلغاء",
    admitted: "تم قبول الطالب بنجاح", studentNumber: "رقم الطالب", openProfile: "فتح ملف الطالب",
    credentialsTitle: "بيانات دخول ولي الأمر", credentialsBody: "انسخ بيانات الدخول الآن. تظهر كلمة المرور المؤقتة في هذا العرض فقط.", existingAccount: "لدى ولي الأمر حساب بوابة موجود بالفعل. لم يتم تغيير كلمة المرور.", loginEmail: "بريد تسجيل الدخول", temporaryPassword: "كلمة المرور المؤقتة", copy: "نسخ بيانات الدخول", copied: "تم النسخ", done: "تم"
  }
} as const;

function browserToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AdmissionSimpleActions({
  applicationId, state, locale, duplicateReviewStatus, convertedStudent, applicantData, groups, sessionId, programId, hasUsablePhoto, missingConversionFields
}: AdmissionSimpleActionsProps) {
  const text = copy[locale];
  const router = useRouter();
  const availableGroups = useMemo(() => groups.filter((group) => group.sessionId === sessionId && group.programId === programId), [groups, programId, sessionId]);
  const needsCompletion = missingConversionFields.length > 0;
  const [completionOpen, setCompletionOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"accept" | "request_information" | "reject" | "duplicate" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [duplicatePending, setDuplicatePending] = useState(duplicateReviewStatus === "possible");
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [success, setSuccess] = useState<SuccessResult | null>(convertedStudent ? { personId: convertedStudent.personId, studentNumber: convertedStudent.studentNumber, enrollmentId: convertedStudent.enrollmentId } : null);
  const [copied, setCopied] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);

  const [nativeName, setNativeName] = useState(applicantData.native_name ?? "");
  const [gender, setGender] = useState(applicantData.gender ?? "");
  const [guardianName, setGuardianName] = useState(applicantData.guardian_name ?? "");
  const [guardianRelationship, setGuardianRelationship] = useState(applicantData.guardian_relationship ?? "guardian");
  const [guardianPhone, setGuardianPhone] = useState(applicantData.guardian_phone ?? "");
  const [guardianEmail, setGuardianEmail] = useState(applicantData.guardian_email ?? "");
  const [groupKey, setGroupKey] = useState(applicantData.group_key ?? "");
  const [joiningDate, setJoiningDate] = useState(applicantData.joining_date ?? "");

  const canAccept = ["submitted", "verification", "decision", "offered", "payment_pending"].includes(state) && !convertedStudent;
  const canRequest = ["submitted", "verification"].includes(state) && !convertedStudent;
  const canReject = ["submitted", "verification", "decision"].includes(state) && !convertedStudent;

  async function simpleAction(action: "accept" | "request_information" | "reject") {
    const response = await fetch("/api/admissions/simple-action", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, action, ...(reason.trim() ? { reason: reason.trim() } : {}) })
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; result?: { state?: string } };
    if (!response.ok) throw new Error(payload.error || text.error);
    return payload.result?.state ?? state;
  }

  async function convert(confirmNewPerson: boolean) {
    const response = await fetch("/api/admissions/convert", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ applicationId, confirmNewPerson })
    });
    const payload = await response.json().catch(() => ({})) as ConvertResponse;
    if (!response.ok) {
      if (payload.duplicateReviewRequired) {
        setDuplicatePending(true); setCandidateCount(payload.candidateCount ?? 0); setError(payload.error || text.duplicate); return false;
      }
      throw new Error(payload.error || text.error);
    }
    if (!payload.result?.personId || !payload.result.studentNumber) throw new Error(text.error);
    setDuplicatePending(false); setCandidateCount(null);
    setSuccess({
      personId: payload.result.personId, studentNumber: payload.result.studentNumber, enrollmentId: payload.result.enrollmentId,
      guardianEmail: payload.result.guardianEmail,
      temporaryPassword: payload.result.credentialState === "temporary_password_created" ? payload.result.temporaryPassword ?? null : null,
      existingAccount: payload.result.credentialState === "existing_account"
    });
    return true;
  }

  async function acceptAndAdmit(confirmNewPerson = false) {
    if (!confirmNewPerson && needsCompletion) {
      if (!joiningDate) setJoiningDate(browserToday());
      setCompletionOpen(true);
      setError(null);
      setMessage(null);
      return;
    }
    setBusy(confirmNewPerson ? "duplicate" : "accept"); setError(null); setMessage(null); setCopied(false);
    try {
      if (!confirmNewPerson) await simpleAction("accept");
      const converted = await convert(confirmNewPerson);
      if (converted) router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : text.error); } finally { setBusy(null); }
  }

  async function completeAndAdmit() {
    setError(null); setMessage(null);
    if (nativeName.trim().length < 2 || !gender || guardianName.trim().length < 2 || guardianPhone.trim().length < 6 || !guardianEmail.includes("@") || !groupKey || !joiningDate) {
      setError(text.error); return;
    }
    if (!hasUsablePhoto && !photo) { setError(text.photoHelp); return; }
    setBusy("complete");
    try {
      const detailsResponse = await fetch("/api/admissions/complete-details", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId, nativeName, gender, guardianName, guardianRelationship, guardianPhone, guardianEmail, groupKey, joiningDate })
      });
      const detailsPayload = await detailsResponse.json().catch(() => ({})) as { error?: string };
      if (!detailsResponse.ok) throw new Error(detailsPayload.error || text.error);

      if (!hasUsablePhoto && photo) {
        const data = new FormData(); data.set("applicationId", String(applicationId)); data.set("photo", photo);
        const photoResponse = await fetch("/api/admissions/photo", { method: "POST", body: data });
        const photoPayload = await photoResponse.json().catch(() => ({})) as { error?: string };
        if (!photoResponse.ok) throw new Error(photoPayload.error || text.error);
      }

      setCompletionOpen(false);
      await simpleAction("accept");
      const converted = await convert(false);
      if (converted) router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : text.error); } finally { setBusy(null); }
  }

  async function runReviewAction(action: "request_information" | "reject") {
    setError(null); setMessage(null);
    if (reason.trim().length < 8) { setError(text.reasonError); return; }
    setBusy(action);
    try { await simpleAction(action); setReason(""); setMessage(action === "request_information" ? text.requestDone : text.rejectDone); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : text.error); }
    finally { setBusy(null); }
  }

  async function copyCredentials() {
    if (!success?.guardianEmail || !success.temporaryPassword) return;
    try { await navigator.clipboard.writeText(`${text.loginEmail}: ${success.guardianEmail}\n${text.temporaryPassword}: ${success.temporaryPassword}`); setCopied(true); }
    catch { setCopied(false); }
  }

  if (success) return (
    <section className="configuration-detail-card" aria-labelledby="admission-success-title">
      <span className="module-state module-state-complete">✓</span><h2 id="admission-success-title">{text.admitted}</h2>
      <p>{text.studentNumber}: <code>{success.studentNumber}</code></p>
      {success.guardianEmail ? <div><h3>{text.credentialsTitle}</h3><p>{success.existingAccount ? text.existingAccount : text.credentialsBody}</p><dl className="detail-list"><div><dt>{text.loginEmail}</dt><dd><code>{success.guardianEmail}</code></dd></div>{success.temporaryPassword ? <div><dt>{text.temporaryPassword}</dt><dd><code>{success.temporaryPassword}</code></dd></div> : null}</dl></div> : null}
      <div className="quick-actions"><Link className="action-button action-button-primary" href={`/${locale}/students/${success.personId}`}>{text.openProfile}</Link>{success.temporaryPassword ? <button className="action-button" type="button" onClick={copyCredentials}>{copied ? text.copied : text.copy}</button> : null}<button className="action-button" type="button" onClick={() => { setSuccess(null); router.refresh(); }}>{text.done}</button></div>
    </section>
  );

  if (canAccept && completionOpen) return (
    <section className="configuration-detail-card" aria-labelledby="complete-admission-details-title">
      <h2 id="complete-admission-details-title">{text.completeTitle}</h2><p>{text.completeBody}</p>
      <div className="configuration-form-grid">
        <label className="workspace-field"><span>{text.native}</span><input required value={nativeName} onChange={(e) => setNativeName(e.target.value)} dir="auto" /></label>
        <label className="workspace-field"><span>{text.gender}</span><select required value={gender} onChange={(e) => setGender(e.target.value)}><option value="">{text.select}</option><option value="male">{text.male}</option><option value="female">{text.female}</option><option value="other">{text.otherGender}</option><option value="undisclosed">{text.undisclosed}</option></select></label>
        <label className="workspace-field"><span>{text.guardianName}</span><input required value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></label>
        <label className="workspace-field"><span>{text.relationship}</span><select required value={guardianRelationship} onChange={(e) => setGuardianRelationship(e.target.value)}><option value="father">{text.father}</option><option value="mother">{text.mother}</option><option value="guardian">{text.guardian}</option><option value="other">{text.otherRelationship}</option></select></label>
        <label className="workspace-field"><span>{text.phone}</span><input required inputMode="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></label>
        <label className="workspace-field"><span>{text.email}</span><input required type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></label>
        <label className="workspace-field"><span>{text.group}</span><select required value={groupKey} onChange={(e) => setGroupKey(e.target.value)}><option value="">{text.select}</option>{availableGroups.map((group) => <option value={group.key} key={group.key}>{group.label}</option>)}</select></label>
        <label className="workspace-field"><span>{text.joining}</span><input required type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} /></label>
        {!hasUsablePhoto ? <label className="workspace-field"><span>{text.photo}</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /><small>{text.photoHelp}</small></label> : null}
      </div>
      <div className="quick-actions"><button className="action-button action-button-primary" type="button" disabled={busy !== null} onClick={completeAndAdmit}>{busy === "complete" ? text.savingDetails : text.saveContinue}</button></div>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
    </section>
  );

  return (
    <section className="configuration-detail-card" aria-labelledby="simple-admission-actions-title">
      <h2 id="simple-admission-actions-title">{text.title}</h2>
      {(canRequest || canReject) ? <label className="field-label">{text.reason}<textarea className="text-field" maxLength={2000} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={text.reasonHelp} /></label> : null}
      <div className="quick-actions">
        {canAccept ? <button className="action-button action-button-primary" type="button" disabled={busy !== null} onClick={() => acceptAndAdmit(false)}>{busy === "accept" ? text.accepting : text.accept}</button> : null}
        {canRequest ? <button className="action-button" type="button" disabled={busy !== null} onClick={() => runReviewAction("request_information")}>{busy === "request_information" ? text.updating : text.request}</button> : null}
        {canReject ? <button className="action-button" type="button" disabled={busy !== null} onClick={() => runReviewAction("reject")}>{busy === "reject" ? text.updating : text.reject}</button> : null}
      </div>
      {duplicatePending ? <div className="form-message form-error" role="alert"><strong>{text.duplicateTitle}</strong><p>{error || text.duplicate}</p>{candidateCount !== null ? <p>{candidateCount} {text.duplicateCount}</p> : null}<div className="quick-actions"><button className="action-button" type="button" disabled={busy !== null} onClick={() => { setDuplicatePending(false); setCandidateCount(null); setError(null); }}>{text.cancelDuplicate}</button><button className="action-button action-button-primary" type="button" disabled={busy !== null} onClick={() => acceptAndAdmit(true)}>{busy === "duplicate" ? text.accepting : text.confirmSeparate}</button></div></div> : null}
      {!duplicatePending && error ? <p className="form-message form-error" role="alert">{error}</p> : null}{message ? <p className="form-message" role="status">{message}</p> : null}
    </section>
  );
}
