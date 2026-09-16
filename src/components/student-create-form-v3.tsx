"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { StudentPhotoPicker } from "@/components/student-photo-picker";
import { FieldGroup } from "@/components/workspace-ui";
import type { Locale, SupportedLocale } from "@/lib/i18n/config";

type Option = { id: number; label: string };
type GroupOption = Option & { sessionId: number; programId: number };

type CreateBody = {
  displayName: string;
  nameNative?: string;
  dateOfBirth?: string;
  ageYears?: number;
  gender?: string;
  preferredLocale: SupportedLocale;
  sessionId: number;
  programId: number;
  groupId: number;
  joinedOn: string;
  medicalSummary?: string;
  accessibilityNeeds?: string;
  pickupRestrictions?: string;
  guardian: { name: string; relationship: string; phone: string };
  confirmNewPerson?: boolean;
};

type CreateResult = {
  personId: number;
  studentNumber: string;
  enrollmentId?: number;
};

type Extras = {
  nameNative: string;
  gender: string;
  preferredLocale: SupportedLocale;
  medicalSummary: string;
  accessibilityNeeds: string;
  pickupRestrictions: string;
};

const copy = {
  en: {
    progress: "New admission", step: "Step", of: "of", student: "Student", guardian: "Guardian", placement: "Placement", review: "Review",
    studentHelp: "Start with the details you normally ask for at the desk.", guardianHelp: "Add the primary person the madrasa should contact.", placementHelp: "Choose where this student will study.", reviewHelp: "Check the details before creating the permanent student record.",
    name: "Student name", native: "Name in Urdu", dob: "Date of birth", age: "Age (if date of birth is not known)", gender: "Gender", language: "Preferred language", more: "More details",
    session: "Academic year", program: "Program", group: "Class / group", joined: "Joining date", guardianName: "Guardian name", relationship: "Relationship", phone: "Mobile / WhatsApp",
    medical: "Medical notes", accessibility: "Accessibility / learning needs", pickup: "Pickup restrictions", continue: "Continue", back: "Back", confirmAdmission: "Confirm Admission", creating: "Admitting student…",
    duplicateTitle: "Possible duplicate found", duplicate: "A matching student may already exist. Review the details before creating a separate permanent record.", duplicateCount: "possible matching record(s)", createSeparate: "Create as a separate student", changeDetails: "Change details",
    error: "Unable to admit the student.", studentError: "Enter the student name and either date of birth or age.", guardianError: "Enter the guardian name and mobile / WhatsApp number.", placementError: "Choose the academic year, program, class / group, and joining date.", select: "Select",
    photoRequired: "Take or upload the student's photo before continuing.", photoUploadError: "Student was admitted, but the photo could not be attached. Retry the photo upload without creating the student again.", photoPendingTitle: "Student admitted — photo needs attention", photoPendingBody: "The permanent student record already exists. Attach the required photo now; retrying here will not create a duplicate student.", retryPhoto: "Retry Photo Upload", uploadingPhoto: "Attaching photo…", photoReady: "Photo ready",
    male: "Male", female: "Female", other: "Other", undisclosed: "Undisclosed", father: "Father", mother: "Mother", guardianRole: "Guardian",
    successTitle: "Student admitted successfully", studentNumber: "Student number", openProfile: "Open Student Profile", printId: "Print ID Card", addAnother: "Add Another Student"
  },
  ur: {
    progress: "نیا داخلہ", step: "مرحلہ", of: "از", student: "طالب علم", guardian: "سرپرست", placement: "تعلیمی تعیناتی", review: "جائزہ",
    studentHelp: "وہ بنیادی معلومات درج کریں جو عام طور پر داخلے کے وقت پوچھی جاتی ہیں۔", guardianHelp: "بنیادی سرپرست یا رابطہ شخص شامل کریں۔", placementHelp: "طالب علم کے پروگرام اور کلاس کا انتخاب کریں۔", reviewHelp: "مستقل ریکارڈ بنانے سے پہلے داخلے کی تفصیلات چیک کریں۔",
    name: "طالب علم کا نام", native: "نام اردو میں", dob: "تاریخ پیدائش", age: "عمر (اگر تاریخ پیدائش معلوم نہ ہو)", gender: "جنس", language: "ترجیحی زبان", more: "مزید تفصیلات",
    session: "تعلیمی سال", program: "پروگرام", group: "کلاس / گروپ", joined: "تاریخ شمولیت", guardianName: "سرپرست کا نام", relationship: "رشتہ", phone: "موبائل / واٹس ایپ",
    medical: "طبی نوٹس", accessibility: "خصوصی / تعلیمی ضروریات", pickup: "پک اپ پابندیاں", continue: "جاری رکھیں", back: "واپس", confirmAdmission: "داخلہ کی تصدیق کریں", creating: "داخلہ کیا جا رہا ہے…",
    duplicateTitle: "ممکنہ ڈپلیکیٹ ملا", duplicate: "ممکن ہے یہی طالب علم پہلے سے موجود ہو۔ الگ مستقل ریکارڈ بنانے سے پہلے تفصیلات چیک کریں۔", duplicateCount: "ممکنہ ملتے جلتے ریکارڈ", createSeparate: "الگ طالب علم ریکارڈ بنائیں", changeDetails: "تفصیلات تبدیل کریں",
    error: "طالب علم کا داخلہ نہیں ہو سکا۔", studentError: "طالب علم کا نام اور تاریخ پیدائش یا عمر درج کریں۔", guardianError: "سرپرست کا نام اور موبائل / واٹس ایپ نمبر درج کریں۔", placementError: "تعلیمی سال، پروگرام، کلاس / گروپ اور شمولیت کی تاریخ منتخب کریں۔", select: "منتخب کریں",
    photoRequired: "آگے بڑھنے سے پہلے طالب علم کی تصویر لیں یا اپ لوڈ کریں۔", photoUploadError: "طالب علم کا داخلہ ہو گیا، لیکن تصویر منسلک نہیں ہو سکی۔ نیا طالب علم بنائے بغیر تصویر دوبارہ اپ لوڈ کریں۔", photoPendingTitle: "طالب علم داخل ہو گیا — تصویر مکمل کریں", photoPendingBody: "مستقل طالب علم ریکارڈ پہلے ہی بن چکا ہے۔ مطلوبہ تصویر ابھی منسلک کریں؛ دوبارہ کوشش سے نیا ڈپلیکیٹ طالب علم نہیں بنے گا۔", retryPhoto: "تصویر دوبارہ اپ لوڈ کریں", uploadingPhoto: "تصویر منسلک ہو رہی ہے…", photoReady: "تصویر تیار ہے",
    male: "مرد", female: "خاتون", other: "دیگر", undisclosed: "درج نہیں", father: "والد", mother: "والدہ", guardianRole: "سرپرست",
    successTitle: "طالب علم کا داخلہ کامیابی سے ہو گیا", studentNumber: "طالب علم نمبر", openProfile: "طالب علم پروفائل کھولیں", printId: "ID کارڈ پرنٹ کریں", addAnother: "ایک اور طالب علم شامل کریں"
  },
  ar: {
    progress: "قبول جديد", step: "الخطوة", of: "من", student: "الطالب", guardian: "ولي الأمر", placement: "التوزيع الدراسي", review: "المراجعة",
    studentHelp: "ابدأ بالمعلومات الأساسية التي تُطلب عادة عند مكتب القبول.", guardianHelp: "أضف ولي الأمر أو جهة الاتصال الأساسية.", placementHelp: "اختر البرنامج والفصل المناسبين للطالب.", reviewHelp: "راجع بيانات القبول قبل إنشاء السجل الدائم للطالب.",
    name: "اسم الطالب", native: "الاسم بالأردية", dob: "تاريخ الميلاد", age: "العمر (إذا لم يُعرف تاريخ الميلاد)", gender: "الجنس", language: "اللغة المفضلة", more: "تفاصيل إضافية",
    session: "العام الدراسي", program: "البرنامج", group: "الفصل / المجموعة", joined: "تاريخ الالتحاق", guardianName: "اسم ولي الأمر", relationship: "صلة القرابة", phone: "الجوال / واتساب",
    medical: "ملاحظات طبية", accessibility: "احتياجات التعلم / الوصول", pickup: "قيود الاستلام", continue: "متابعة", back: "رجوع", confirmAdmission: "تأكيد القبول", creating: "جارٍ قبول الطالب…",
    duplicateTitle: "تم العثور على تطابق محتمل", duplicate: "قد يكون هذا الطالب موجودًا بالفعل. راجع البيانات قبل إنشاء سجل دائم منفصل.", duplicateCount: "سجل/سجلات محتملة المطابقة", createSeparate: "إنشاء طالب منفصل", changeDetails: "تعديل البيانات",
    error: "تعذر قبول الطالب.", studentError: "أدخل اسم الطالب وتاريخ الميلاد أو العمر.", guardianError: "أدخل اسم ولي الأمر ورقم الجوال / واتساب.", placementError: "اختر العام الدراسي والبرنامج والفصل / المجموعة وتاريخ الالتحاق.", select: "اختر",
    photoRequired: "التقط صورة الطالب أو ارفعها قبل المتابعة.", photoUploadError: "تم قبول الطالب، لكن تعذر إرفاق الصورة. أعد رفع الصورة من دون إنشاء طالب جديد.", photoPendingTitle: "تم قبول الطالب — أكمل الصورة", photoPendingBody: "تم إنشاء السجل الدائم بالفعل. أرفق الصورة المطلوبة الآن؛ إعادة المحاولة هنا لن تنشئ طالبًا مكررًا.", retryPhoto: "إعادة رفع الصورة", uploadingPhoto: "جارٍ إرفاق الصورة…", photoReady: "الصورة جاهزة",
    male: "ذكر", female: "أنثى", other: "أخرى", undisclosed: "غير مذكور", father: "الأب", mother: "الأم", guardianRole: "ولي أمر",
    successTitle: "تم قبول الطالب بنجاح", studentNumber: "رقم الطالب", openProfile: "فتح ملف الطالب", printId: "طباعة بطاقة الهوية", addAnother: "إضافة طالب آخر"
  }
} as const;

function optional(value: string): string | undefined {
  const cleaned = value.trim();
  return cleaned || undefined;
}

function browserToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function StudentCreateForm({ locale, sessions, programs, groups }: { locale: Locale; sessions: Option[]; programs: Option[]; groups: GroupOption[] }) {
  const text = copy[locale];
  const defaultPreferredLocale: SupportedLocale = locale === "ur" ? "ur" : "en";
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const submissionLock = useRef(false);
  const photoUploadLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateBody, setDuplicateBody] = useState<CreateBody | null>(null);
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  const [success, setSuccess] = useState<CreateResult | null>(null);
  const [pendingPhotoStudent, setPendingPhotoStudent] = useState<CreateResult | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [relationship, setRelationship] = useState("father");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [sessionId, setSessionId] = useState<number>(sessions[0]?.id ?? 0);
  const [programId, setProgramId] = useState<number>(programs[0]?.id ?? 0);
  const [groupId, setGroupId] = useState(0);
  const [joinedOn, setJoinedOn] = useState("");
  const [extras, setExtras] = useState<Extras>({
    nameNative: "",
    gender: "",
    preferredLocale: defaultPreferredLocale,
    medicalSummary: "",
    accessibilityNeeds: "",
    pickupRestrictions: ""
  });

  const visibleGroups = groups.filter((group) => group.sessionId === sessionId && group.programId === programId);
  const sessionLabel = sessions.find((item) => item.id === sessionId)?.label ?? "—";
  const programLabel = programs.find((item) => item.id === programId)?.label ?? "—";
  const groupLabel = groups.find((item) => item.id === groupId)?.label ?? "—";
  const steps = [text.student, text.guardian, text.placement, text.review];

  function clearResultMessages() {
    setError(null);
    setDuplicateBody(null);
    setDuplicateCount(null);
  }

  function validateStep(current: number): boolean {
    if (current === 1) {
      const age = Number(ageYears);
      const hasAge = ageYears !== "" && Number.isInteger(age) && age >= 1 && age <= 120;
      if (displayName.trim().length < 2 || (!dateOfBirth && !hasAge)) {
        setError(text.studentError);
        return false;
      }
      if (!photo) {
        setError(text.photoRequired);
        return false;
      }
    }
    if (current === 2 && (guardianName.trim().length < 2 || guardianPhone.trim().length < 6)) {
      setError(text.guardianError);
      return false;
    }
    if (current === 3 && (!sessionId || !programId || !groupId || !joinedOn)) {
      setError(text.placementError);
      return false;
    }
    setError(null);
    return true;
  }

  function nextStep() {
    clearResultMessages();
    if (!validateStep(step)) return;
    if (step === 2 && !joinedOn) setJoinedOn(browserToday());
    setStep((current) => Math.min(current + 1, 4));
  }

  function previousStep() {
    clearResultMessages();
    setStep((current) => Math.max(current - 1, 1));
  }

  function createBody(confirmNewPerson = false): CreateBody {
    return {
      displayName: displayName.trim(),
      nameNative: optional(extras.nameNative),
      dateOfBirth: dateOfBirth || undefined,
      ageYears: ageYears ? Number(ageYears) : undefined,
      gender: optional(extras.gender),
      preferredLocale: extras.preferredLocale,
      sessionId,
      programId,
      groupId,
      joinedOn,
      medicalSummary: optional(extras.medicalSummary),
      accessibilityNeeds: optional(extras.accessibilityNeeds),
      pickupRestrictions: optional(extras.pickupRestrictions),
      guardian: { name: guardianName.trim(), relationship, phone: guardianPhone.trim() },
      confirmNewPerson
    };
  }

  async function attachPhoto(result: CreateResult): Promise<boolean> {
    if (!photo) {
      setPendingPhotoStudent(result);
      setError(text.photoRequired);
      return false;
    }
    if (photoUploadLock.current) return false;

    photoUploadLock.current = true;
    setPhotoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("photo", photo);
      const response = await fetch(`/api/students/photo/${result.personId}/upload`, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({})) as { error?: string; result?: { photoAttached?: boolean } };
      if (!response.ok || payload.result?.photoAttached !== true) {
        setPendingPhotoStudent(result);
        setError(payload.error || text.photoUploadError);
        return false;
      }
      setPendingPhotoStudent(null);
      setSuccess(result);
      return true;
    } catch {
      setPendingPhotoStudent(result);
      setError(text.photoUploadError);
      return false;
    } finally {
      photoUploadLock.current = false;
      setPhotoUploading(false);
    }
  }

  async function create(body: CreateBody) {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admissions/walk-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        duplicateReviewRequired?: boolean;
        candidateCount?: number;
        result?: CreateResult;
      };

      if (response.status === 409 && payload.duplicateReviewRequired) {
        setDuplicateBody(body);
        setDuplicateCount(payload.candidateCount ?? 0);
        setError(payload.error || text.duplicate);
        return;
      }
      if (!response.ok || !payload.result?.personId || !payload.result.studentNumber) {
        setError(payload.error || text.error);
        return;
      }
      setDuplicateBody(null);
      setDuplicateCount(null);
      await attachPhoto(payload.result);
    } catch {
      setError(text.error);
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  async function confirmAdmission() {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;
    await create(createBody(false));
  }

  function reset() {
    setStep(1);
    setBusy(false);
    setPhotoUploading(false);
    setError(null);
    setDuplicateBody(null);
    setDuplicateCount(null);
    setSuccess(null);
    setPendingPhotoStudent(null);
    setPhoto(null);
    setDisplayName("");
    setDateOfBirth("");
    setAgeYears("");
    setGuardianName("");
    setRelationship("father");
    setGuardianPhone("");
    setSessionId(sessions[0]?.id ?? 0);
    setProgramId(programs[0]?.id ?? 0);
    setGroupId(0);
    setJoinedOn("");
    setExtras({ nameNative: "", gender: "", preferredLocale: defaultPreferredLocale, medicalSummary: "", accessibilityNeeds: "", pickupRestrictions: "" });
  }

  if (pendingPhotoStudent) {
    return (
      <section className="panel" aria-live="polite" data-page-section>
        <header className="panel-header"><div><h2>{text.photoPendingTitle}</h2><p>{text.photoPendingBody}</p></div></header>
        <div className="student-detail-grid">
          <div><span>{text.name}</span><strong>{displayName}</strong></div>
          <div><span>{text.studentNumber}</span><strong>{pendingPhotoStudent.studentNumber}</strong></div>
          <div><span>{text.group}</span><strong>{groupLabel}</strong></div>
        </div>
        <StudentPhotoPicker locale={locale} file={photo} disabled={photoUploading} onChange={setPhoto} onError={setError} />
        {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
        <div className="quick-actions">
          <button className="action-button action-button-primary" type="button" disabled={photoUploading || !photo} onClick={() => attachPhoto(pendingPhotoStudent)}>{photoUploading ? text.uploadingPhoto : text.retryPhoto}</button>
        </div>
      </section>
    );
  }

  if (success) {
    return (
      <section className="panel" aria-live="polite" data-page-section>
        <header className="panel-header"><div><span className="module-state module-state-complete">✓</span><h2>{text.successTitle}</h2></div></header>
        <div className="student-detail-grid">
          <div><span>{text.name}</span><strong>{displayName}</strong></div>
          <div><span>{text.studentNumber}</span><strong>{success.studentNumber}</strong></div>
          <div><span>{text.group}</span><strong>{groupLabel}</strong></div>
        </div>
        <div className="quick-actions">
          <Link className="action-button action-button-primary" href={`/${locale}/students/${success.personId}?created=1`}>{text.openProfile}</Link>
          <Link className="action-button" href={`/${locale}/students/${success.personId}/id-card`}>{text.printId}</Link>
          <button className="action-button" type="button" onClick={reset}>{text.addAnother}</button>
        </div>
      </section>
    );
  }

  return (
    <div className="configuration-form client-v2-form" aria-busy={busy || photoUploading}>
      <section className="workspace-context-strip" aria-label={text.progress} data-page-section>
        <div><strong>{text.progress}</strong><span>{text.step} {step} {text.of} 4</span></div>
        <p>{steps.map((label, index) => `${index + 1}. ${label}`).join(" · ")}</p>
      </section>

      {step === 1 ? (
        <section className="panel" data-admission-step="1">
          <header className="panel-header"><div><h2>{text.student}</h2><p>{text.studentHelp}</p></div></header>
          <div className="configuration-form-grid">
            <FieldGroup label={text.name}><input required minLength={2} maxLength={160} autoComplete="off" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></FieldGroup>
            <FieldGroup label={text.dob}><input type="date" value={dateOfBirth} onChange={(event) => { setDateOfBirth(event.target.value); if (event.target.value) setAgeYears(""); }} /></FieldGroup>
            <FieldGroup label={text.age}><input type="number" min={1} max={120} inputMode="numeric" value={ageYears} onChange={(event) => { setAgeYears(event.target.value); if (event.target.value) setDateOfBirth(""); }} /></FieldGroup>
          </div>
          <StudentPhotoPicker locale={locale} file={photo} disabled={busy || photoUploading} onChange={setPhoto} onError={setError} />
          <details>
            <summary>{text.more}</summary>
            <div className="configuration-form-grid">
              <FieldGroup label={text.native}><input maxLength={160} dir="auto" value={extras.nameNative} onChange={(event) => setExtras((value) => ({ ...value, nameNative: event.target.value }))} /></FieldGroup>
              <FieldGroup label={text.gender}><select value={extras.gender} onChange={(event) => setExtras((value) => ({ ...value, gender: event.target.value }))}><option value="">{text.select}</option><option value="male">{text.male}</option><option value="female">{text.female}</option><option value="other">{text.other}</option><option value="undisclosed">{text.undisclosed}</option></select></FieldGroup>
              <FieldGroup label={text.language}><select value={extras.preferredLocale} onChange={(event) => setExtras((value) => ({ ...value, preferredLocale: event.target.value as SupportedLocale }))}><option value="en">English</option><option value="ur">اردو</option></select></FieldGroup>
              <FieldGroup label={text.medical}><textarea rows={3} maxLength={1000} value={extras.medicalSummary} onChange={(event) => setExtras((value) => ({ ...value, medicalSummary: event.target.value }))} /></FieldGroup>
              <FieldGroup label={text.accessibility}><textarea rows={3} maxLength={1000} value={extras.accessibilityNeeds} onChange={(event) => setExtras((value) => ({ ...value, accessibilityNeeds: event.target.value }))} /></FieldGroup>
              <FieldGroup label={text.pickup}><textarea rows={3} maxLength={1000} value={extras.pickupRestrictions} onChange={(event) => setExtras((value) => ({ ...value, pickupRestrictions: event.target.value }))} /></FieldGroup>
            </div>
          </details>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel" data-admission-step="2">
          <header className="panel-header"><div><h2>{text.guardian}</h2><p>{text.guardianHelp}</p></div></header>
          <div className="configuration-form-grid">
            <FieldGroup label={text.guardianName}><input required minLength={2} maxLength={160} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></FieldGroup>
            <FieldGroup label={text.relationship}><select required value={relationship} onChange={(event) => setRelationship(event.target.value)}><option value="father">{text.father}</option><option value="mother">{text.mother}</option><option value="guardian">{text.guardianRole}</option></select></FieldGroup>
            <FieldGroup label={text.phone}><input required inputMode="tel" minLength={6} maxLength={80} autoComplete="tel" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} /></FieldGroup>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="panel" data-admission-step="3">
          <header className="panel-header"><div><h2>{text.placement}</h2><p>{text.placementHelp}</p></div></header>
          <div className="configuration-form-grid">
            <FieldGroup label={text.session}><select required value={sessionId || ""} onChange={(event) => { setSessionId(Number(event.target.value)); setGroupId(0); }}><option value="" disabled>{text.select}</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FieldGroup>
            <FieldGroup label={text.program}><select required value={programId || ""} onChange={(event) => { setProgramId(Number(event.target.value)); setGroupId(0); }}><option value="" disabled>{text.select}</option>{programs.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FieldGroup>
            <FieldGroup label={text.group}><select required value={groupId || ""} onChange={(event) => setGroupId(Number(event.target.value))}><option value="" disabled>{text.select}</option>{visibleGroups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FieldGroup>
            <FieldGroup label={text.joined}><input required type="date" value={joinedOn} onChange={(event) => setJoinedOn(event.target.value)} /></FieldGroup>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="panel" data-admission-step="4">
          <header className="panel-header"><div><h2>{text.review}</h2><p>{text.reviewHelp}</p></div></header>
          <div className="student-detail-grid">
            <div><span>{text.student}</span><strong>{displayName}</strong><small>{dateOfBirth || `${text.age}: ${ageYears}`}</small></div>
            <div><span>{text.guardian}</span><strong>{guardianName}</strong><small>{guardianPhone}</small></div>
            <div><span>{text.placement}</span><strong>{programLabel} · {groupLabel}</strong><small>{sessionLabel} · {joinedOn}</small></div>
            <div><span>{text.photoReady}</span><strong>{photo?.name || text.photoRequired}</strong></div>
          </div>
        </section>
      ) : null}

      {duplicateBody ? (
        <section className="panel" aria-labelledby="duplicate-admission-title">
          <header className="panel-header"><h2 id="duplicate-admission-title">{text.duplicateTitle}</h2></header>
          <p>{error || text.duplicate}</p>
          {duplicateCount !== null ? <p><strong>{duplicateCount}</strong> {text.duplicateCount}</p> : null}
          <div className="quick-actions">
            <button className="action-button" type="button" disabled={busy || photoUploading} onClick={() => { clearResultMessages(); setStep(1); }}>{text.changeDetails}</button>
            <button className="action-button action-button-primary" type="button" disabled={busy || photoUploading} onClick={() => create({ ...duplicateBody, confirmNewPerson: true })}>{busy ? text.creating : text.createSeparate}</button>
          </div>
        </section>
      ) : null}

      {!duplicateBody && error ? <p className="form-message form-error" role="alert">{error}</p> : null}

      {!duplicateBody ? (
        <div className="quick-actions">
          {step > 1 ? <button className="action-button" type="button" disabled={busy || photoUploading} onClick={previousStep}>{text.back}</button> : null}
          {step < 4 ? <button className="action-button action-button-primary" type="button" disabled={busy || photoUploading || !sessions.length || !programs.length} onClick={nextStep}>{text.continue}</button> : null}
          {step === 4 ? <button className="action-button action-button-primary" type="button" disabled={busy || photoUploading} onClick={confirmAdmission}>{busy || photoUploading ? text.creating : text.confirmAdmission}</button> : null}
        </div>
      ) : null}
    </div>
  );
}
