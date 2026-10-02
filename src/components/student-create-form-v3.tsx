"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { StudentPhotoPicker } from "@/components/student-photo-picker";
import { FieldGroup } from "@/components/workspace-ui";
import type { SupportedLocale } from "@/lib/i18n/config";

type Option = { id: number; label: string };
type GroupOption = Option & { sessionId: number; programId: number };

export type StaffAdmissionFormDraft = {
  id: number;
  preferredLocale: SupportedLocale;
  sessionId: number;
  programId: number;
  groupId: number | null;
  displayName: string;
  nameNative: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other" | "undisclosed" | "";
  joinedOn: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianRelationship: "father" | "mother" | "guardian" | "other";
  medicalSummary: string;
  accessibilityNeeds: string;
  pickupRestrictions: string;
  photoBound: boolean;
};

type AdmissionBody = {
  draftId?: number;
  displayName?: string;
  nameNative?: string;
  dateOfBirth?: string;
  gender?: string;
  preferredLocale: SupportedLocale;
  sessionId: number;
  programId: number;
  groupId?: number;
  joinedOn?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
  medicalSummary?: string;
  accessibilityNeeds?: string;
  pickupRestrictions?: string;
  photoToken?: string;
  confirmNewPerson?: boolean;
};

type AdmissionResult = {
  personId: number;
  studentNumber: string;
  enrollmentId: number;
  guardianPersonId?: number;
  guardianEmail?: string;
};

type Extras = {
  medicalSummary: string;
  accessibilityNeeds: string;
  pickupRestrictions: string;
};

const copy = {
  en: {
    progress: "Create Admission",
    step: "Step",
    of: "of",
    student: "Student",
    guardian: "Guardian",
    placement: "Placement",
    review: "Review",
    studentHelp: "Enter the student's identity details and required photo.",
    guardianHelp: "Add the primary guardian. Email is required for secure parent access.",
    placementHelp: "Choose the academic year, program, class / group, and joining date.",
    reviewHelp: "Review the saved draft before creating the permanent student record.",
    name: "Student name",
    native: "Name in Urdu",
    dob: "Date of birth (optional)",
    gender: "Gender",
    language: "Preferred language",
    more: "Health & safeguarding (optional)",
    session: "Academic year",
    program: "Program",
    group: "Class / group",
    joined: "Joining date",
    guardianName: "Guardian name",
    relationship: "Relationship",
    email: "Guardian email",
    phone: "Guardian mobile (optional)",
    medical: "Medical notes",
    accessibility: "Accessibility / learning needs",
    pickup: "Pickup restrictions",
    continue: "Save & Continue",
    back: "Back",
    saveDraft: "Save Draft",
    savingDraft: "Saving draft…",
    draftSaved: "Draft saved",
    confirmAdmission: "Create Admission",
    creating: "Creating admission…",
    duplicateTitle: "Possible duplicate found",
    duplicate: "A matching student may already exist. Review the details before creating a separate permanent record.",
    duplicateCount: "possible matching record(s)",
    createSeparate: "Create as separate student",
    changeDetails: "Change details",
    error: "Unable to create the admission.",
    draftError: "Unable to save the admission draft.",
    studentError: "Enter the student name, Urdu name, gender, and required photo.",
    guardianError: "Enter the guardian name, relationship, and a valid email address.",
    placementError: "Choose the academic year, program, class / group, and joining date.",
    select: "Select",
    photoRequired: "Take or upload the student's photo before continuing.",
    photoUploadError: "Unable to prepare the student photo. Try again.",
    photoReady: "Photo",
    savedPhoto: "Saved with draft",
    uploadingPhoto: "Preparing photo…",
    male: "Male",
    female: "Female",
    other: "Other",
    undisclosed: "Undisclosed",
    father: "Father",
    mother: "Mother",
    guardianRole: "Guardian",
    otherRelationship: "Other",
    successTitle: "Admission created successfully",
    studentNumber: "Student number",
    openProfile: "Open Student Profile",
    documents: "Documents",
    addAnother: "Create Another Admission"
  },
  ur: {
    progress: "داخلہ بنائیں",
    step: "مرحلہ",
    of: "از",
    student: "طالب علم",
    guardian: "سرپرست",
    placement: "تعلیمی تعیناتی",
    review: "جائزہ",
    studentHelp: "طالب علم کی شناختی معلومات اور مطلوبہ تصویر درج کریں۔",
    guardianHelp: "بنیادی سرپرست شامل کریں۔ محفوظ والدین رسائی کے لیے ای میل ضروری ہے۔",
    placementHelp: "تعلیمی سال، پروگرام، کلاس / گروپ اور شمولیت کی تاریخ منتخب کریں۔",
    reviewHelp: "مستقل طالب علم ریکارڈ بنانے سے پہلے محفوظ ڈرافٹ کا جائزہ لیں۔",
    name: "طالب علم کا نام",
    native: "نام اردو میں",
    dob: "تاریخ پیدائش (اختیاری)",
    gender: "جنس",
    language: "ترجیحی زبان",
    more: "صحت اور حفاظت (اختیاری)",
    session: "تعلیمی سال",
    program: "پروگرام",
    group: "کلاس / گروپ",
    joined: "تاریخ شمولیت",
    guardianName: "سرپرست کا نام",
    relationship: "رشتہ",
    email: "سرپرست ای میل",
    phone: "سرپرست موبائل (اختیاری)",
    medical: "طبی نوٹس",
    accessibility: "خصوصی / تعلیمی ضروریات",
    pickup: "پک اپ پابندیاں",
    continue: "محفوظ کریں اور جاری رکھیں",
    back: "واپس",
    saveDraft: "ڈرافٹ محفوظ کریں",
    savingDraft: "ڈرافٹ محفوظ ہو رہا ہے…",
    draftSaved: "ڈرافٹ محفوظ ہے",
    confirmAdmission: "داخلہ بنائیں",
    creating: "داخلہ بنایا جا رہا ہے…",
    duplicateTitle: "ممکنہ ڈپلیکیٹ ملا",
    duplicate: "ممکن ہے یہی طالب علم پہلے سے موجود ہو۔ الگ مستقل ریکارڈ بنانے سے پہلے تفصیلات چیک کریں۔",
    duplicateCount: "ممکنہ ملتے جلتے ریکارڈ",
    createSeparate: "الگ طالب علم بنائیں",
    changeDetails: "تفصیلات تبدیل کریں",
    error: "داخلہ نہیں بنایا جا سکا۔",
    draftError: "داخلہ ڈرافٹ محفوظ نہیں ہو سکا۔",
    studentError: "طالب علم کا نام، اردو نام، جنس اور مطلوبہ تصویر درج کریں۔",
    guardianError: "سرپرست کا نام، رشتہ اور درست ای میل درج کریں۔",
    placementError: "تعلیمی سال، پروگرام، کلاس / گروپ اور شمولیت کی تاریخ منتخب کریں۔",
    select: "منتخب کریں",
    photoRequired: "آگے بڑھنے سے پہلے طالب علم کی تصویر لیں یا اپ لوڈ کریں۔",
    photoUploadError: "طالب علم کی تصویر تیار نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
    photoReady: "تصویر",
    savedPhoto: "ڈرافٹ کے ساتھ محفوظ",
    uploadingPhoto: "تصویر تیار ہو رہی ہے…",
    male: "مرد",
    female: "خاتون",
    other: "دیگر",
    undisclosed: "درج نہیں",
    father: "والد",
    mother: "والدہ",
    guardianRole: "سرپرست",
    otherRelationship: "دیگر",
    successTitle: "داخلہ کامیابی سے بن گیا",
    studentNumber: "طالب علم نمبر",
    openProfile: "طالب علم پروفائل کھولیں",
    documents: "دستاویزات",
    addAnother: "ایک اور داخلہ بنائیں"
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

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function StudentCreateForm({
  locale,
  sessions,
  programs,
  groups,
  initialDraft
}: {
  locale: SupportedLocale;
  sessions: Option[];
  programs: Option[];
  groups: GroupOption[];
  initialDraft?: StaffAdmissionFormDraft | null;
}) {
  const text = copy[locale];
  const submissionLock = useRef(false);
  const photoUploadLock = useRef(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(
    initialDraft ? text.draftSaved : null
  );
  const [duplicateReview, setDuplicateReview] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  const [success, setSuccess] = useState<AdmissionResult | null>(null);

  const [draftId, setDraftId] = useState<number | null>(initialDraft?.id ?? null);
  const [photoBound, setPhotoBound] = useState(initialDraft?.photoBound ?? false);
  const [photoToken, setPhotoToken] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  const [displayName, setDisplayName] = useState(initialDraft?.displayName ?? "");
  const [nameNative, setNameNative] = useState(initialDraft?.nameNative ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initialDraft?.dateOfBirth ?? "");
  const [gender, setGender] = useState(initialDraft?.gender ?? "");
  const [preferredLocale, setPreferredLocale] = useState<SupportedLocale>(
    initialDraft?.preferredLocale ?? locale
  );
  const [guardianName, setGuardianName] = useState(initialDraft?.guardianName ?? "");
  const [guardianEmail, setGuardianEmail] = useState(initialDraft?.guardianEmail ?? "");
  const [guardianPhone, setGuardianPhone] = useState(initialDraft?.guardianPhone ?? "");
  const [relationship, setRelationship] = useState(
    initialDraft?.guardianRelationship ?? "father"
  );
  const [sessionId, setSessionId] = useState<number>(
    initialDraft?.sessionId ?? sessions[0]?.id ?? 0
  );
  const [programId, setProgramId] = useState<number>(
    initialDraft?.programId ?? programs[0]?.id ?? 0
  );
  const [groupId, setGroupId] = useState<number>(initialDraft?.groupId ?? 0);
  const [joinedOn, setJoinedOn] = useState(initialDraft?.joinedOn ?? "");
  const [extras, setExtras] = useState<Extras>({
    medicalSummary: initialDraft?.medicalSummary ?? "",
    accessibilityNeeds: initialDraft?.accessibilityNeeds ?? "",
    pickupRestrictions: initialDraft?.pickupRestrictions ?? ""
  });

  const visibleGroups = groups.filter(
    (group) => group.sessionId === sessionId && group.programId === programId
  );
  const sessionLabel = sessions.find((item) => item.id === sessionId)?.label ?? "—";
  const programLabel = programs.find((item) => item.id === programId)?.label ?? "—";
  const groupLabel = groups.find((item) => item.id === groupId)?.label ?? "—";
  const steps = [text.student, text.guardian, text.placement, text.review];

  function clearMessages() {
    setError(null);
    setSavedMessage(null);
    setDuplicateReview(false);
    setDuplicateCount(null);
  }

  function validateStep(current: number): boolean {
    if (current === 1) {
      if (
        displayName.trim().length < 2 ||
        nameNative.trim().length < 2 ||
        !gender ||
        (!photo && !photoBound)
      ) {
        setError(text.studentError);
        return false;
      }
    }

    if (
      current === 2 &&
      (guardianName.trim().length < 2 || !relationship || !validEmail(guardianEmail))
    ) {
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

  function body(confirmNewPerson = false): AdmissionBody {
    return {
      draftId: draftId ?? undefined,
      displayName: optional(displayName),
      nameNative: optional(nameNative),
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || undefined,
      preferredLocale,
      sessionId,
      programId,
      groupId: groupId || undefined,
      joinedOn: joinedOn || undefined,
      guardianName: optional(guardianName),
      guardianEmail: optional(guardianEmail),
      guardianPhone: optional(guardianPhone),
      guardianRelationship: relationship || undefined,
      medicalSummary: optional(extras.medicalSummary),
      accessibilityNeeds: optional(extras.accessibilityNeeds),
      pickupRestrictions: optional(extras.pickupRestrictions),
      photoToken: photoToken ?? undefined,
      confirmNewPerson
    };
  }

  async function stagePhoto(): Promise<string | null> {
    if (!photo) return photoToken;
    if (photoToken) return photoToken;
    if (photoUploadLock.current) return null;

    photoUploadLock.current = true;
    setPhotoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("photo", photo);
      const response = await fetch("/api/admissions/staff-photo", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        photoToken?: string;
      };
      if (!response.ok || !payload.photoToken) {
        setError(payload.error || text.photoUploadError);
        return null;
      }
      setPhotoToken(payload.photoToken);
      return payload.photoToken;
    } catch {
      setError(text.photoUploadError);
      return null;
    } finally {
      photoUploadLock.current = false;
      setPhotoUploading(false);
    }
  }

  async function saveDraft(options: { quiet?: boolean } = {}): Promise<number | null> {
    if (submissionLock.current || !sessionId || !programId) return draftId;

    submissionLock.current = true;
    setBusy(true);
    setError(null);
    if (!options.quiet) setSavedMessage(null);

    try {
      let stagedPhotoToken = photoToken;
      if (photo && !stagedPhotoToken) {
        stagedPhotoToken = await stagePhoto();
        if (!stagedPhotoToken) return null;
      }

      const payloadBody = {
        ...body(false),
        photoToken: stagedPhotoToken ?? undefined
      };
      const response = await fetch("/api/admissions/staff-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadBody)
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: {
          application_id?: number;
          revision?: number;
          photo_bound?: boolean;
        };
      };
      if (!response.ok || !payload.result?.application_id) {
        setError(payload.error || text.draftError);
        return null;
      }

      setDraftId(payload.result.application_id);
      if (payload.result.photo_bound === true || stagedPhotoToken) setPhotoBound(true);
      setSavedMessage(text.draftSaved);
      return payload.result.application_id;
    } catch {
      setError(text.draftError);
      return null;
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  async function nextStep() {
    clearMessages();
    if (!validateStep(step)) return;
    if (step === 2 && !joinedOn) setJoinedOn(browserToday());

    const savedId = await saveDraft({ quiet: true });
    if (!savedId) return;
    setStep((current) => Math.min(current + 1, 4));
  }

  function previousStep() {
    clearMessages();
    setStep((current) => Math.max(current - 1, 1));
  }

  async function finalize(confirmNewPerson = false) {
    if (submissionLock.current) return;
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    let currentDraftId = draftId;
    if (!currentDraftId) {
      currentDraftId = await saveDraft({ quiet: true });
      if (!currentDraftId) return;
    }

    submissionLock.current = true;
    setBusy(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response = await fetch("/api/admissions/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...body(confirmNewPerson),
          draftId: currentDraftId,
          photoToken: photoToken ?? undefined,
          confirmNewPerson
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        duplicateReviewRequired?: boolean;
        candidateCount?: number;
        result?: {
          draftId?: number;
          personId?: number;
          studentNumber?: string;
          enrollmentId?: number;
          guardianPersonId?: number;
          guardianEmail?: string;
        };
      };

      if (response.status === 409 && payload.duplicateReviewRequired) {
        if (payload.result?.draftId) setDraftId(payload.result.draftId);
        setDuplicateReview(true);
        setDuplicateCount(payload.candidateCount ?? 0);
        setError(payload.error || text.duplicate);
        return;
      }

      if (
        !response.ok ||
        !payload.result?.personId ||
        !payload.result.studentNumber ||
        !payload.result.enrollmentId
      ) {
        setError(payload.error || text.error);
        return;
      }

      setDuplicateReview(false);
      setDuplicateCount(null);
      setSuccess({
        personId: payload.result.personId,
        studentNumber: payload.result.studentNumber,
        enrollmentId: payload.result.enrollmentId,
        guardianPersonId: payload.result.guardianPersonId,
        guardianEmail: payload.result.guardianEmail
      });
    } catch {
      setError(text.error);
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  function reset() {
    setStep(1);
    setBusy(false);
    setPhotoUploading(false);
    setError(null);
    setSavedMessage(null);
    setDuplicateReview(false);
    setDuplicateCount(null);
    setSuccess(null);
    setDraftId(null);
    setPhotoBound(false);
    setPhotoToken(null);
    setPhoto(null);
    setDisplayName("");
    setNameNative("");
    setDateOfBirth("");
    setGender("");
    setPreferredLocale(locale);
    setGuardianName("");
    setGuardianEmail("");
    setGuardianPhone("");
    setRelationship("father");
    setSessionId(sessions[0]?.id ?? 0);
    setProgramId(programs[0]?.id ?? 0);
    setGroupId(0);
    setJoinedOn("");
    setExtras({
      medicalSummary: "",
      accessibilityNeeds: "",
      pickupRestrictions: ""
    });
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
          <Link className="action-button action-button-primary" href={`/${locale}/students/${success.personId}?created=1`}>
            {text.openProfile}
          </Link>
          <Link className="action-button" href={`/${locale}/documents?student=${success.personId}`}>
            {text.documents}
          </Link>
          <button className="action-button" type="button" onClick={reset}>
            {text.addAnother}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="configuration-form client-v2-form" aria-busy={busy || photoUploading}>
      <section className="workspace-context-strip" aria-label={text.progress} data-page-section>
        <div>
          <strong>{text.progress}</strong>
          <span>{text.step} {step} {text.of} 4</span>
        </div>
        <p>{steps.map((label, index) => `${index + 1}. ${label}`).join(" · ")}</p>
      </section>

      {step === 1 ? (
        <section className="panel" data-admission-step="1">
          <header className="panel-header">
            <div><h2>{text.student}</h2><p>{text.studentHelp}</p></div>
          </header>
          <div className="configuration-form-grid">
            <FieldGroup label={text.name}>
              <input required minLength={2} maxLength={160} autoComplete="off" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </FieldGroup>
            <FieldGroup label={text.native}>
              <input required minLength={2} maxLength={160} dir="auto" value={nameNative} onChange={(event) => setNameNative(event.target.value)} />
            </FieldGroup>
            <FieldGroup label={text.dob}>
              <input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
            </FieldGroup>
            <FieldGroup label={text.gender}>
              <select required value={gender} onChange={(event) => setGender(event.target.value as StaffAdmissionFormDraft["gender"])}>
                <option value="">{text.select}</option>
                <option value="male">{text.male}</option>
                <option value="female">{text.female}</option>
                <option value="other">{text.other}</option>
                <option value="undisclosed">{text.undisclosed}</option>
              </select>
            </FieldGroup>
            <FieldGroup label={text.language}>
              <select value={preferredLocale} onChange={(event) => setPreferredLocale(event.target.value as SupportedLocale)}>
                <option value="en">English</option>
                <option value="ur">اردو</option>
              </select>
            </FieldGroup>
          </div>
          <StudentPhotoPicker
            locale={locale}
            file={photo}
            disabled={busy || photoUploading}
            onChange={(file) => {
              setPhoto(file);
              setPhotoToken(null);
              setSavedMessage(null);
            }}
            onError={setError}
          />
          {photoBound && !photo ? <p className="form-message form-success">{text.savedPhoto}</p> : null}
          <details>
            <summary>{text.more}</summary>
            <div className="configuration-form-grid">
              <FieldGroup label={text.medical}>
                <textarea rows={3} maxLength={1000} value={extras.medicalSummary} onChange={(event) => setExtras((value) => ({ ...value, medicalSummary: event.target.value }))} />
              </FieldGroup>
              <FieldGroup label={text.accessibility}>
                <textarea rows={3} maxLength={1000} value={extras.accessibilityNeeds} onChange={(event) => setExtras((value) => ({ ...value, accessibilityNeeds: event.target.value }))} />
              </FieldGroup>
              <FieldGroup label={text.pickup}>
                <textarea rows={3} maxLength={1000} value={extras.pickupRestrictions} onChange={(event) => setExtras((value) => ({ ...value, pickupRestrictions: event.target.value }))} />
              </FieldGroup>
            </div>
          </details>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel" data-admission-step="2">
          <header className="panel-header">
            <div><h2>{text.guardian}</h2><p>{text.guardianHelp}</p></div>
          </header>
          <div className="configuration-form-grid">
            <FieldGroup label={text.guardianName}>
              <input required minLength={2} maxLength={160} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} />
            </FieldGroup>
            <FieldGroup label={text.relationship}>
              <select required value={relationship} onChange={(event) => setRelationship(event.target.value as StaffAdmissionFormDraft["guardianRelationship"])}>
                <option value="father">{text.father}</option>
                <option value="mother">{text.mother}</option>
                <option value="guardian">{text.guardianRole}</option>
                <option value="other">{text.otherRelationship}</option>
              </select>
            </FieldGroup>
            <FieldGroup label={text.email}>
              <input required type="email" inputMode="email" autoCapitalize="none" autoComplete="email" maxLength={320} value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} />
            </FieldGroup>
            <FieldGroup label={text.phone}>
              <input inputMode="tel" autoComplete="tel" maxLength={80} value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} />
            </FieldGroup>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="panel" data-admission-step="3">
          <header className="panel-header">
            <div><h2>{text.placement}</h2><p>{text.placementHelp}</p></div>
          </header>
          <div className="configuration-form-grid">
            <FieldGroup label={text.session}>
              <select required value={sessionId || ""} onChange={(event) => { setSessionId(Number(event.target.value)); setGroupId(0); }}>
                <option value="" disabled>{text.select}</option>
                {sessions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label={text.program}>
              <select required value={programId || ""} onChange={(event) => { setProgramId(Number(event.target.value)); setGroupId(0); }}>
                <option value="" disabled>{text.select}</option>
                {programs.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label={text.group}>
              <select required value={groupId || ""} onChange={(event) => setGroupId(Number(event.target.value))}>
                <option value="" disabled>{text.select}</option>
                {visibleGroups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label={text.joined}>
              <input required type="date" value={joinedOn} onChange={(event) => setJoinedOn(event.target.value)} />
            </FieldGroup>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="panel" data-admission-step="4">
          <header className="panel-header">
            <div><h2>{text.review}</h2><p>{text.reviewHelp}</p></div>
          </header>
          <div className="student-detail-grid">
            <div><span>{text.student}</span><strong>{displayName}</strong><small>{nameNative}</small></div>
            <div><span>{text.guardian}</span><strong>{guardianName}</strong><small>{guardianEmail}</small></div>
            <div><span>{text.placement}</span><strong>{programLabel} · {groupLabel}</strong><small>{sessionLabel} · {joinedOn}</small></div>
            <div><span>{text.photoReady}</span><strong>{photo?.name || (photoBound ? text.savedPhoto : text.photoRequired)}</strong></div>
          </div>
        </section>
      ) : null}

      {duplicateReview ? (
        <section className="panel" aria-labelledby="duplicate-admission-title">
          <header className="panel-header"><h2 id="duplicate-admission-title">{text.duplicateTitle}</h2></header>
          <p>{error || text.duplicate}</p>
          {duplicateCount !== null ? <p><strong>{duplicateCount}</strong> {text.duplicateCount}</p> : null}
          <div className="quick-actions">
            <button className="action-button" type="button" disabled={busy || photoUploading} onClick={() => { clearMessages(); setStep(1); }}>
              {text.changeDetails}
            </button>
            <button className="action-button action-button-primary" type="button" disabled={busy || photoUploading} onClick={() => void finalize(true)}>
              {busy ? text.creating : text.createSeparate}
            </button>
          </div>
        </section>
      ) : null}

      {!duplicateReview && error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      {savedMessage ? <p className="form-message form-success" role="status">{savedMessage}</p> : null}

      {!duplicateReview ? (
        <div className="quick-actions">
          {step > 1 ? (
            <button className="action-button" type="button" disabled={busy || photoUploading} onClick={previousStep}>
              {text.back}
            </button>
          ) : null}
          <button className="action-button" type="button" disabled={busy || photoUploading || !sessions.length || !programs.length} onClick={() => void saveDraft()}>
            {busy ? text.savingDraft : text.saveDraft}
          </button>
          {step < 4 ? (
            <button className="action-button action-button-primary" type="button" disabled={busy || photoUploading || !sessions.length || !programs.length} onClick={() => void nextStep()}>
              {busy || photoUploading ? text.savingDraft : text.continue}
            </button>
          ) : null}
          {step === 4 ? (
            <button className="action-button action-button-primary" type="button" disabled={busy || photoUploading || !draftId} onClick={() => void finalize(false)}>
              {busy || photoUploading ? text.creating : text.confirmAdmission}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
