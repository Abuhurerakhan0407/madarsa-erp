"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { FieldGroup } from "@/components/workspace-ui";
import type { Locale } from "@/lib/i18n/config";

type Option = { id: number; label: string };
type GroupOption = Option & { sessionId: number; programId: number };
type CreateBody = {
  displayName: string;
  nameNative?: string;
  dateOfBirth?: string;
  ageYears?: number;
  gender?: string;
  preferredLocale: Locale;
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

const copy = {
  en: {
    progress: "New admission",
    step: "Step",
    of: "of",
    student: "Student",
    guardian: "Guardian",
    placement: "Placement",
    review: "Review",
    studentHelp: "Start with the details you normally ask for at the desk.",
    guardianHelp: "Add the primary person the madrasa should contact.",
    placementHelp: "Choose where this student will study. Branch and academic context stay protected by your active workspace.",
    reviewHelp: "Check the admission before creating the permanent student record.",
    name: "Student name",
    native: "Name in Urdu / Arabic",
    dob: "Date of birth",
    age: "Age (if date of birth is not known)",
    dobOrAge: "Enter either date of birth or age.",
    gender: "Gender",
    language: "Preferred language",
    more: "More details",
    session: "Academic year",
    program: "Program",
    group: "Class / group",
    joined: "Joining date",
    guardianName: "Guardian name",
    relationship: "Relationship",
    phone: "Mobile / WhatsApp",
    medical: "Medical notes",
    accessibility: "Accessibility / learning needs",
    pickup: "Pickup restrictions",
    continue: "Continue",
    back: "Back",
    confirmAdmission: "Confirm Admission",
    creating: "Admitting student…",
    duplicateTitle: "Possible duplicate found",
    duplicate: "A matching student may already exist. Review the details before creating a separate permanent record.",
    duplicateCount: "possible matching record(s)",
    createSeparate: "Create as a separate student",
    changeDetails: "Change details",
    error: "Unable to admit the student.",
    none: "Select",
    male: "Male",
    female: "Female",
    other: "Other",
    undisclosed: "Undisclosed",
    father: "Father",
    mother: "Mother",
    guardianRole: "Guardian",
    summaryStudent: "Student",
    summaryGuardian: "Guardian",
    summaryPlacement: "Placement",
    successTitle: "Student admitted successfully",
    studentNumber: "Student number",
    openProfile: "Open Student Profile",
    printId: "Print ID Card",
    addAnother: "Add Another Student"
  },
  ur: {
    progress: "نیا داخلہ",
    step: "مرحلہ",
    of: "از",
    student: "طالب علم",
    guardian: "سرپرست",
    placement: "تعلیمی تعیناتی",
    review: "جائزہ",
    studentHelp: "وہ بنیادی معلومات درج کریں جو عام طور پر داخلے کے وقت پوچھی جاتی ہیں۔",
    guardianHelp: "بنیادی سرپرست یا رابطہ شخص شامل کریں۔",
    placementHelp: "طالب علم کے پروگرام اور کلاس کا انتخاب کریں۔ فعال شاخ اور تعلیمی سیاق محفوظ رہتا ہے۔",
    reviewHelp: "مستقل ریکارڈ بنانے سے پہلے داخلے کی تفصیلات چیک کریں۔",
    name: "طالب علم کا نام",
    native: "اردو / عربی نام",
    dob: "تاریخ پیدائش",
    age: "عمر (اگر تاریخ پیدائش معلوم نہ ہو)",
    dobOrAge: "تاریخ پیدائش یا عمر میں سے ایک درج کریں۔",
    gender: "جنس",
    language: "ترجیحی زبان",
    more: "مزید تفصیلات",
    session: "تعلیمی سال",
    program: "پروگرام",
    group: "کلاس / گروپ",
    joined: "تاریخ شمولیت",
    guardianName: "سرپرست کا نام",
    relationship: "رشتہ",
    phone: "موبائل / واٹس ایپ",
    medical: "طبی نوٹس",
    accessibility: "خصوصی / تعلیمی ضروریات",
    pickup: "پک اپ پابندیاں",
    continue: "جاری رکھیں",
    back: "واپس",
    confirmAdmission: "داخلہ کی تصدیق کریں",
    creating: "داخلہ کیا جا رہا ہے…",
    duplicateTitle: "ممکنہ ڈپلیکیٹ ملا",
    duplicate: "ممکن ہے یہی طالب علم پہلے سے موجود ہو۔ الگ مستقل ریکارڈ بنانے سے پہلے تفصیلات چیک کریں۔",
    duplicateCount: "ممکنہ ملتے جلتے ریکارڈ",
    createSeparate: "الگ طالب علم ریکارڈ بنائیں",
    changeDetails: "تفصیلات تبدیل کریں",
    error: "طالب علم کا داخلہ نہیں ہو سکا۔",
    none: "منتخب کریں",
    male: "مرد",
    female: "خاتون",
    other: "دیگر",
    undisclosed: "درج نہیں",
    father: "والد",
    mother: "والدہ",
    guardianRole: "سرپرست",
    summaryStudent: "طالب علم",
    summaryGuardian: "سرپرست",
    summaryPlacement: "تعلیمی تعیناتی",
    successTitle: "طالب علم کا داخلہ کامیابی سے ہو گیا",
    studentNumber: "طالب علم نمبر",
    openProfile: "طالب علم پروفائل کھولیں",
    printId: "ID کارڈ پرنٹ کریں",
    addAnother: "ایک اور طالب علم شامل کریں"
  },
  ar: {
    progress: "قبول جديد",
    step: "الخطوة",
    of: "من",
    student: "الطالب",
    guardian: "ولي الأمر",
    placement: "التوزيع الدراسي",
    review: "المراجعة",
    studentHelp: "ابدأ بالمعلومات الأساسية التي تُطلب عادة عند مكتب القبول.",
    guardianHelp: "أضف ولي الأمر أو جهة الاتصال الأساسية.",
    placementHelp: "اختر البرنامج والفصل المناسبين للطالب مع الحفاظ على سياق الفرع الحالي.",
    reviewHelp: "راجع بيانات القبول قبل إنشاء السجل الدائم للطالب.",
    name: "اسم الطالب",
    native: "الاسم بالأردية / العربية",
    dob: "تاريخ الميلاد",
    age: "العمر (إذا لم يُعرف تاريخ الميلاد)",
    dobOrAge: "أدخل تاريخ الميلاد أو العمر.",
    gender: "الجنس",
    language: "اللغة المفضلة",
    more: "تفاصيل إضافية",
    session: "العام الدراسي",
    program: "البرنامج",
    group: "الفصل / المجموعة",
    joined: "تاريخ الالتحاق",
    guardianName: "اسم ولي الأمر",
    relationship: "صلة القرابة",
    phone: "الجوال / واتساب",
    medical: "ملاحظات طبية",
    accessibility: "احتياجات التعلم / الوصول",
    pickup: "قيود الاستلام",
    continue: "متابعة",
    back: "رجوع",
    confirmAdmission: "تأكيد القبول",
    creating: "جارٍ قبول الطالب…",
    duplicateTitle: "تم العثور على تطابق محتمل",
    duplicate: "قد يكون هذا الطالب موجودًا بالفعل. راجع البيانات قبل إنشاء سجل دائم منفصل.",
    duplicateCount: "سجل/سجلات محتملة المطابقة",
    createSeparate: "إنشاء طالب منفصل",
    changeDetails: "تعديل البيانات",
    error: "تعذر قبول الطالب.",
    none: "اختر",
    male: "ذكر",
    female: "أنثى",
    other: "أخرى",
    undisclosed: "غير مذكور",
    father: "الأب",
    mother: "الأم",
    guardianRole: "ولي أمر",
    summaryStudent: "الطالب",
    summaryGuardian: "ولي الأمر",
    summaryPlacement: "التوزيع الدراسي",
    successTitle: "تم قبول الطالب بنجاح",
    studentNumber: "رقم الطالب",
    openProfile: "فتح ملف الطالب",
    printId: "طباعة بطاقة الهوية",
    addAnother: "إضافة طالب آخر"
  }
} as const;

function optional(form: FormData, name: string) {
  const value = String(form.get(name) || "").trim();
  return value || undefined;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function StudentCreateForm({ locale, sessions, programs, groups }: { locale: Locale; sessions: Option[]; programs: Option[]; groups: GroupOption[] }) {
  const text = copy[locale];
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateBody, setDuplicateBody] = useState<CreateBody | null>(null);
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  const [success, setSuccess] = useState<CreateResult | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [relationship, setRelationship] = useState("father");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [sessionId, setSessionId] = useState<number>(sessions[0]?.id ?? 0);
  const [programId, setProgramId] = useState<number>(programs[0]?.id ?? 0);
  const [groupId, setGroupId] = useState<number>(0);
  const [joinedOn, setJoinedOn] = useState(today());

  const visibleGroups = useMemo(
    () => groups.filter((group) => group.sessionId === sessionId && group.programId === programId),
    [groups, sessionId, programId]
  );

  const stepLabels = [text.student, text.guardian, text.placement, text.review];
  const sessionLabel = sessions.find((item) => item.id === sessionId)?.label ?? "—";
  const programLabel = programs.find((item) => item.id === programId)?.label ?? "—";
  const groupLabel = groups.find((item) => item.id === groupId)?.label ?? "—";

  function clearDuplicate() {
    setDuplicateBody(null);
    setDuplicateCount(null);
    setError(null);
  }

  function validateVisibleStep(currentStep: number) {
    const root = formRef.current?.querySelector(`[data-admission-step="${currentStep}"]`);
    if (!root) return false;
    const controls = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"));
    for (const control of controls) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return false;
      }
    }
    if (currentStep === 1 && !dateOfBirth && !ageYears) {
      setError(text.dobOrAge);
      return false;
    }
    setError(null);
    return true;
  }

  function next() {
    clearDuplicate();
    if (!validateVisibleStep(step)) return;
    setStep((value) => Math.min(value + 1, 4));
  }

  function back() {
    clearDuplicate();
    setStep((value) => Math.max(value - 1, 1));
  }

  function bodyFromForm(confirmNewPerson = false): CreateBody | null {
    const form = formRef.current;
    if (!form) return null;
    const data = new FormData(form);
    return {
      displayName: displayName.trim(),
      nameNative: optional(data, "nameNative"),
      dateOfBirth: dateOfBirth || undefined,
      ageYears: ageYears ? Number(ageYears) : undefined,
      gender: optional(data, "gender"),
      preferredLocale: String(data.get("preferredLocale") || locale) as Locale,
      sessionId,
      programId,
      groupId,
      joinedOn,
      medicalSummary: optional(data, "medicalSummary"),
      accessibilityNeeds: optional(data, "accessibilityNeeds"),
      pickupRestrictions: optional(data, "pickupRestrictions"),
      guardian: { name: guardianName.trim(), relationship, phone: guardianPhone.trim() },
      confirmNewPerson
    };
  }

  async function create(body: CreateBody) {
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
      setSuccess(payload.result);
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 4 || !validateVisibleStep(3)) return;
    const body = bodyFromForm(false);
    if (body) await create(body);
  }

  function startAnother() {
    setSuccess(null);
    setStep(1);
    setError(null);
    setDuplicateBody(null);
    setDuplicateCount(null);
    setDisplayName("");
    setDateOfBirth("");
    setAgeYears("");
    setGuardianName("");
    setRelationship("father");
    setGuardianPhone("");
    setSessionId(sessions[0]?.id ?? 0);
    setProgramId(programs[0]?.id ?? 0);
    setGroupId(0);
    setJoinedOn(today());
  }

  if (success) {
    return (
      <section className="panel" aria-live="polite" data-page-section>
        <header className="panel-header">
          <div>
            <span className="module-state module-state-complete">✓</span>
            <h2>{text.successTitle}</h2>
          </div>
        </header>
        <div className="student-detail-grid">
          <div><span>{text.name}</span><strong>{displayName}</strong></div>
          <div><span>{text.studentNumber}</span><strong>{success.studentNumber}</strong></div>
          <div><span>{text.group}</span><strong>{groupLabel}</strong></div>
        </div>
        <div className="quick-actions">
          <a className="action-button action-button-primary" href={`/${locale}/students/${success.personId}?created=1`}>{text.openProfile}</a>
          <a className="action-button" href={`/${locale}/students/${success.personId}/id-card`}>{text.printId}</a>
          <button className="action-button" type="button" onClick={startAnother}>{text.addAnother}</button>
        </div>
      </section>
    );
  }

  return (
    <form
      ref={formRef}
      className="configuration-form client-v2-form"
      aria-busy={busy}
      onChange={clearDuplicate}
      onSubmit={submit}
    >
      <section className="workspace-context-strip" aria-label={text.progress} data-page-section>
        <div>
          <strong>{text.progress}</strong>
          <span>{text.step} {step} {text.of} 4</span>
        </div>
        <p>{stepLabels.map((label, index) => `${index + 1}. ${label}`).join(" · ")}</p>
      </section>

      <section className="panel" data-admission-step="1" hidden={step !== 1}>
        <header className="panel-header"><div><h2>{text.student}</h2><p>{text.studentHelp}</p></div></header>
        <div className="configuration-form-grid">
          <FieldGroup label={text.name}><input name="displayName" required minLength={2} maxLength={160} autoComplete="off" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></FieldGroup>
          <FieldGroup label={text.dob}><input name="dateOfBirth" type="date" value={dateOfBirth} onChange={(event) => { setDateOfBirth(event.target.value); if (event.target.value) setAgeYears(""); }} /></FieldGroup>
          <FieldGroup label={text.age}><input name="ageYears" type="number" min={1} max={120} inputMode="numeric" value={ageYears} onChange={(event) => { setAgeYears(event.target.value); if (event.target.value) setDateOfBirth(""); }} /></FieldGroup>
        </div>
        <details>
          <summary>{text.more}</summary>
          <div className="configuration-form-grid">
            <FieldGroup label={text.native}><input name="nameNative" maxLength={160} dir="auto" /></FieldGroup>
            <FieldGroup label={text.gender}><select name="gender" defaultValue=""><option value="">—</option><option value="male">{text.male}</option><option value="female">{text.female}</option><option value="other">{text.other}</option><option value="undisclosed">{text.undisclosed}</option></select></FieldGroup>
            <FieldGroup label={text.language}><select name="preferredLocale" defaultValue={locale}><option value="en">English</option><option value="ur">اردو</option><option value="ar">العربية</option></select></FieldGroup>
            <FieldGroup label={text.medical}><textarea name="medicalSummary" rows={3} maxLength={1000} /></FieldGroup>
            <FieldGroup label={text.accessibility}><textarea name="accessibilityNeeds" rows={3} maxLength={1000} /></FieldGroup>
            <FieldGroup label={text.pickup}><textarea name="pickupRestrictions" rows={3} maxLength={1000} /></FieldGroup>
          </div>
        </details>
      </section>

      <section className="panel" data-admission-step="2" hidden={step !== 2}>
        <header className="panel-header"><div><h2>{text.guardian}</h2><p>{text.guardianHelp}</p></div></header>
        <div className="configuration-form-grid">
          <FieldGroup label={text.guardianName}><input name="guardianName" required minLength={2} maxLength={160} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></FieldGroup>
          <FieldGroup label={text.relationship}><select name="relationship" required value={relationship} onChange={(event) => setRelationship(event.target.value)}><option value="father">{text.father}</option><option value="mother">{text.mother}</option><option value="guardian">{text.guardianRole}</option></select></FieldGroup>
          <FieldGroup label={text.phone}><input name="guardianPhone" required inputMode="tel" minLength={6} maxLength={80} autoComplete="tel" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} /></FieldGroup>
        </div>
      </section>

      <section className="panel" data-admission-step="3" hidden={step !== 3}>
        <header className="panel-header"><div><h2>{text.placement}</h2><p>{text.placementHelp}</p></div></header>
        <div className="configuration-form-grid">
          <FieldGroup label={text.session}><select name="sessionId" required value={sessionId || ""} onChange={(event) => { setSessionId(Number(event.target.value)); setGroupId(0); }}><option value="" disabled>—</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FieldGroup>
          <FieldGroup label={text.program}><select name="programId" required value={programId || ""} onChange={(event) => { setProgramId(Number(event.target.value)); setGroupId(0); }}><option value="" disabled>—</option>{programs.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FieldGroup>
          <FieldGroup label={text.group}><select name="groupId" required value={groupId || ""} onChange={(event) => setGroupId(Number(event.target.value))}><option value="" disabled>{text.none}</option>{visibleGroups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FieldGroup>
          <FieldGroup label={text.joined}><input name="joinedOn" required type="date" value={joinedOn} onChange={(event) => setJoinedOn(event.target.value)} /></FieldGroup>
        </div>
      </section>

      <section className="panel" data-admission-step="4" hidden={step !== 4}>
        <header className="panel-header"><div><h2>{text.review}</h2><p>{text.reviewHelp}</p></div></header>
        <div className="student-detail-grid">
          <div><span>{text.summaryStudent}</span><strong>{displayName}</strong><small>{dateOfBirth || (ageYears ? `${text.age}: ${ageYears}` : "—")}</small></div>
          <div><span>{text.summaryGuardian}</span><strong>{guardianName}</strong><small>{guardianPhone}</small></div>
          <div><span>{text.summaryPlacement}</span><strong>{programLabel} · {groupLabel}</strong><small>{sessionLabel} · {joinedOn}</small></div>
        </div>
      </section>

      {duplicateBody ? (
        <section className="panel" aria-labelledby="duplicate-admission-title">
          <header className="panel-header"><h2 id="duplicate-admission-title">{text.duplicateTitle}</h2></header>
          <p>{error || text.duplicate}</p>
          {duplicateCount !== null ? <p><strong>{duplicateCount}</strong> {text.duplicateCount}</p> : null}
          <div className="quick-actions">
            <button className="action-button" type="button" disabled={busy} onClick={() => { setDuplicateBody(null); setDuplicateCount(null); setError(null); setStep(1); }}>{text.changeDetails}</button>
            <button className="action-button action-button-primary" type="button" disabled={busy} onClick={() => create({ ...duplicateBody, confirmNewPerson: true })}>{busy ? text.creating : text.createSeparate}</button>
          </div>
        </section>
      ) : null}

      {!duplicateBody && error ? <p className="form-message form-error" role="alert">{error}</p> : null}

      {!duplicateBody ? (
        <div className="quick-actions">
          {step > 1 ? <button className="action-button" type="button" disabled={busy} onClick={back}>{text.back}</button> : null}
          {step < 4 ? <button className="action-button action-button-primary" type="button" disabled={busy || !sessions.length || !programs.length} onClick={next}>{text.continue}</button> : null}
          {step === 4 ? <button className="action-button action-button-primary" type="submit" disabled={busy}>{busy ? text.creating : text.confirmAdmission}</button> : null}
        </div>
      ) : null}
    </form>
  );
}
