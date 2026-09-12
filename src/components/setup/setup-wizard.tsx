"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { admissionProgramTypes } from "@/lib/admissions/foundation";
import type { GuidedSetupSnapshot } from "@/lib/configuration/setup-readiness";

type Locale = "en" | "ur" | "ar";
type WorkingStep = "institution" | "academic" | "group" | null;

type Copy = {
  title: string;
  intro: string;
  complete: string;
  pending: string;
  institutionTitle: string;
  institutionBody: string;
  institutionName: string;
  legalName: string;
  timezone: string;
  primaryLanguage: string;
  supportedLanguages: string;
  saveDetails: string;
  academicTitle: string;
  academicBody: string;
  sessionKey: string;
  sessionName: string;
  startsOn: string;
  endsOn: string;
  programKey: string;
  programName: string;
  programType: string;
  activateAcademicYear: string;
  classTitle: string;
  classBody: string;
  classKey: string;
  className: string;
  academicYear: string;
  program: string;
  capacity: string;
  createClass: string;
  startTitle: string;
  startBody: string;
  readiness: string;
  students: string;
  addStudent: string;
  openAttendance: string;
  openQuran: string;
  dashboard: string;
  saving: string;
  saved: string;
  error: string;
  choose: string;
};

const copy: Record<Locale, Copy> = {
  en: {
    title: "Guided institution setup",
    intro: "Four short steps using the same governed records and permissions as the rest of Ilmgaah.",
    complete: "Complete",
    pending: "Needs attention",
    institutionTitle: "1. Madrasa details",
    institutionBody: "Confirm the institution name, timezone and languages used across daily work.",
    institutionName: "Institution name",
    legalName: "Legal name (optional)",
    timezone: "Timezone",
    primaryLanguage: "Primary language",
    supportedLanguages: "Supported languages",
    saveDetails: "Save madrasa details",
    academicTitle: "2. Academic year",
    academicBody: "Create the active academic year and a starter teaching program using the existing academic foundation.",
    sessionKey: "Academic year key",
    sessionName: "Academic year name",
    startsOn: "Starts on",
    endsOn: "Ends on",
    programKey: "Starter program key",
    programName: "Starter program name",
    programType: "Program type",
    activateAcademicYear: "Activate academic year",
    classTitle: "3. Programs & classes",
    classBody: "Create the first class for an active academic year and teaching program.",
    classKey: "Class key",
    className: "Class name",
    academicYear: "Academic year",
    program: "Program",
    capacity: "Capacity (optional)",
    createClass: "Create first class",
    startTitle: "4. Start",
    startBody: "Core setup is ready. Continue with the first real operational task.",
    readiness: "Configuration readiness",
    students: "Students",
    addStudent: "Add first student",
    openAttendance: "Open attendance",
    openQuran: "Review Qur'an / Hifz",
    dashboard: "Go to dashboard",
    saving: "Saving…",
    saved: "Saved.",
    error: "Unable to save. Review the values and try again.",
    choose: "Choose"
  },
  ur: {
    title: "مرحلہ وار ادارہ سیٹ اپ",
    intro: "چار مختصر مراحل، انہی محفوظ ریکارڈز اور اجازتوں کے ساتھ جو پورے Ilmgaah میں استعمال ہوتے ہیں۔",
    complete: "مکمل",
    pending: "توجہ درکار",
    institutionTitle: "1. مدرسہ کی تفصیلات",
    institutionBody: "ادارے کا نام، ٹائم زون اور روزمرہ استعمال کی زبانیں تصدیق کریں۔",
    institutionName: "ادارے کا نام",
    legalName: "قانونی نام (اختیاری)",
    timezone: "ٹائم زون",
    primaryLanguage: "بنیادی زبان",
    supportedLanguages: "دستیاب زبانیں",
    saveDetails: "مدرسہ کی تفصیلات محفوظ کریں",
    academicTitle: "2. تعلیمی سال",
    academicBody: "موجودہ تعلیمی بنیاد استعمال کرتے ہوئے فعال تعلیمی سال اور ابتدائی پروگرام بنائیں۔",
    sessionKey: "تعلیمی سال کی کلید",
    sessionName: "تعلیمی سال کا نام",
    startsOn: "آغاز",
    endsOn: "اختتام",
    programKey: "ابتدائی پروگرام کی کلید",
    programName: "ابتدائی پروگرام کا نام",
    programType: "پروگرام کی قسم",
    activateAcademicYear: "تعلیمی سال فعال کریں",
    classTitle: "3. پروگرام اور کلاسیں",
    classBody: "فعال تعلیمی سال اور پروگرام کے لیے پہلی کلاس بنائیں۔",
    classKey: "کلاس کی کلید",
    className: "کلاس کا نام",
    academicYear: "تعلیمی سال",
    program: "پروگرام",
    capacity: "گنجائش (اختیاری)",
    createClass: "پہلی کلاس بنائیں",
    startTitle: "4. آغاز",
    startBody: "بنیادی سیٹ اپ تیار ہے۔ اب پہلا حقیقی آپریشنل کام شروع کریں۔",
    readiness: "کنفیگریشن تیاری",
    students: "طلبہ",
    addStudent: "پہلا طالب علم شامل کریں",
    openAttendance: "حاضری کھولیں",
    openQuran: "قرآن / حفظ دیکھیں",
    dashboard: "ڈیش بورڈ پر جائیں",
    saving: "محفوظ ہو رہا ہے…",
    saved: "محفوظ ہو گیا۔",
    error: "محفوظ نہیں ہو سکا۔ معلومات چیک کر کے دوبارہ کوشش کریں۔",
    choose: "منتخب کریں"
  },
  ar: {
    title: "إعداد المؤسسة خطوة بخطوة",
    intro: "أربع خطوات قصيرة تستخدم نفس السجلات والصلاحيات المحكومة في Ilmgaah.",
    complete: "مكتمل",
    pending: "يحتاج إلى انتباه",
    institutionTitle: "1. بيانات المدرسة",
    institutionBody: "أكد اسم المؤسسة والمنطقة الزمنية واللغات المستخدمة في العمل اليومي.",
    institutionName: "اسم المؤسسة",
    legalName: "الاسم القانوني (اختياري)",
    timezone: "المنطقة الزمنية",
    primaryLanguage: "اللغة الأساسية",
    supportedLanguages: "اللغات المدعومة",
    saveDetails: "حفظ بيانات المدرسة",
    academicTitle: "2. العام الدراسي",
    academicBody: "أنشئ العام الدراسي النشط وبرنامجاً تعليمياً أولياً باستخدام الأساس الأكاديمي الحالي.",
    sessionKey: "مفتاح العام الدراسي",
    sessionName: "اسم العام الدراسي",
    startsOn: "تاريخ البداية",
    endsOn: "تاريخ النهاية",
    programKey: "مفتاح البرنامج الأول",
    programName: "اسم البرنامج الأول",
    programType: "نوع البرنامج",
    activateAcademicYear: "تفعيل العام الدراسي",
    classTitle: "3. البرامج والفصول",
    classBody: "أنشئ الفصل الأول لعام دراسي وبرنامج نشطين.",
    classKey: "مفتاح الفصل",
    className: "اسم الفصل",
    academicYear: "العام الدراسي",
    program: "البرنامج",
    capacity: "السعة (اختياري)",
    createClass: "إنشاء الفصل الأول",
    startTitle: "4. ابدأ",
    startBody: "اكتمل الإعداد الأساسي. انتقل الآن إلى أول مهمة تشغيلية حقيقية.",
    readiness: "جاهزية الإعداد",
    students: "الطلاب",
    addStudent: "إضافة أول طالب",
    openAttendance: "فتح الحضور",
    openQuran: "مراجعة القرآن / الحفظ",
    dashboard: "الذهاب إلى لوحة التحكم",
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ.",
    error: "تعذر الحفظ. راجع القيم وحاول مرة أخرى.",
    choose: "اختر"
  }
};

function StepStatus({ done, text }: { done: boolean; text: Copy }) {
  return <span className={`module-state module-state-${done ? "complete" : "pending"}`}>{done ? text.complete : text.pending}</span>;
}

async function payload(response: Response): Promise<{ error?: string }> {
  return (await response.json().catch(() => ({}))) as { error?: string };
}

export function SetupWizard({ locale, snapshot }: { locale: Locale; snapshot: GuidedSetupSnapshot }) {
  const router = useRouter();
  const text = copy[locale];
  const [working, setWorking] = useState<WorkingStep>(null);
  const [message, setMessage] = useState<string>("");
  const institution = snapshot.institution;

  async function submitInstitution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking("institution");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const supportedLocales = form.getAll("supportedLocales").map(String);
    const response = await fetch("/api/institution/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: String(form.get("displayName") ?? "").trim(),
        legalName: String(form.get("legalName") ?? "").trim() || null,
        timezone: String(form.get("timezone") ?? "").trim(),
        primaryLocale: String(form.get("primaryLocale") ?? "").trim(),
        supportedLocales
      })
    }).catch(() => null);
    if (!response) {
      setMessage(text.error);
      setWorking(null);
      return;
    }
    const result = await payload(response);
    setMessage(response.ok ? text.saved : result.error || text.error);
    setWorking(null);
    if (response.ok) router.refresh();
  }

  async function submitAcademic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking("academic");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const sessionEn = value("sessionName");
    const programEn = value("programName");
    const response = await fetch("/api/admissions/foundation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionKey: value("sessionKey"),
        sessionLabels: { en: sessionEn, ur: value("sessionUr") || sessionEn, ar: value("sessionAr") || sessionEn },
        startsOn: value("startsOn"),
        endsOn: value("endsOn"),
        programKey: value("programKey"),
        programLabels: { en: programEn, ur: value("programUr") || programEn, ar: value("programAr") || programEn },
        programType: value("programType")
      })
    }).catch(() => null);
    if (!response) {
      setMessage(text.error);
      setWorking(null);
      return;
    }
    const result = await payload(response);
    setMessage(response.ok ? text.saved : result.error || text.error);
    setWorking(null);
    if (response.ok) router.refresh();
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking("group");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const title = String(form.get("className") ?? "").trim();
    const capacityText = String(form.get("capacity") ?? "").trim();
    const response = await fetch("/api/academics/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: Number(form.get("sessionId")),
        programId: Number(form.get("programId")),
        key: String(form.get("classKey") ?? "").trim(),
        labels: { en: title, ur: title, ar: title },
        capacity: capacityText ? Number(capacityText) : null
      })
    }).catch(() => null);
    if (!response) {
      setMessage(text.error);
      setWorking(null);
      return;
    }
    const result = await payload(response);
    setMessage(response.ok ? text.saved : result.error || text.error);
    setWorking(null);
    if (response.ok) router.refresh();
  }

  return (
    <div className="configuration-section" data-page-section>
      <header className="section-heading">
        <div><p className="state-kicker">Client V3</p><h2>{text.title}</h2><p>{text.intro}</p></div>
        <strong>{snapshot.readinessPercent}%</strong>
      </header>

      <div className="configuration-detail-grid">
        <article className="configuration-detail-card">
          <StepStatus done={snapshot.steps.institution} text={text} />
          <h3>{text.institutionTitle}</h3>
          <p>{text.institutionBody}</p>
          <form className="preset-preview" onSubmit={submitInstitution}>
            <label className="field-label">{text.institutionName}<input className="text-field" defaultValue={institution?.displayName ?? ""} maxLength={160} name="displayName" required /></label>
            <label className="field-label">{text.legalName}<input className="text-field" defaultValue={institution?.legalName ?? ""} maxLength={160} name="legalName" /></label>
            <label className="field-label">{text.timezone}<input className="text-field" defaultValue={institution?.timezone ?? "Asia/Kolkata"} maxLength={64} name="timezone" required /></label>
            <label className="field-label">{text.primaryLanguage}<select className="text-field" defaultValue={institution?.primaryLocale ?? locale} name="primaryLocale"><option value="en">English</option><option value="ur">اردو</option><option value="ar">العربية</option></select></label>
            <fieldset className="configuration-detail-card"><legend>{text.supportedLanguages}</legend>{(["en", "ur", "ar"] as const).map((language) => <label key={language}><input defaultChecked={(institution?.supportedLocales ?? ["en", "ur", "ar"]).includes(language)} name="supportedLocales" type="checkbox" value={language} /> {language === "en" ? "English" : language === "ur" ? "اردو" : "العربية"}</label>)}</fieldset>
            <button className="action-button action-button-primary" disabled={working !== null} type="submit">{working === "institution" ? text.saving : text.saveDetails}</button>
          </form>
        </article>

        <article className="configuration-detail-card">
          <StepStatus done={snapshot.steps.academicYear} text={text} />
          <h3>{text.academicTitle}</h3>
          <p>{text.academicBody}</p>
          {snapshot.steps.academicYear ? <p><strong>{snapshot.sessions[0]?.label}</strong> · {snapshot.programs[0]?.label}</p> : (
            <form className="preset-preview" onSubmit={submitAcademic}>
              <label className="field-label">{text.sessionKey}<input className="text-field" name="sessionKey" pattern="[a-z0-9][a-z0-9_-]{1,63}" placeholder="2026_27" required /></label>
              <label className="field-label">{text.sessionName}<input className="text-field" maxLength={120} name="sessionName" required /></label>
              <input name="sessionUr" type="hidden" /><input name="sessionAr" type="hidden" />
              <label className="field-label">{text.startsOn}<input className="text-field" name="startsOn" required type="date" /></label>
              <label className="field-label">{text.endsOn}<input className="text-field" name="endsOn" required type="date" /></label>
              <label className="field-label">{text.programKey}<input className="text-field" name="programKey" pattern="[a-z][a-z0-9_]{1,63}" placeholder="hifz" required /></label>
              <label className="field-label">{text.programName}<input className="text-field" maxLength={120} name="programName" required /></label>
              <input name="programUr" type="hidden" /><input name="programAr" type="hidden" />
              <label className="field-label">{text.programType}<select className="text-field" defaultValue="" name="programType" required><option disabled value="">{text.choose}</option>{admissionProgramTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
              <button className="action-button action-button-primary" disabled={working !== null} type="submit">{working === "academic" ? text.saving : text.activateAcademicYear}</button>
            </form>
          )}
        </article>

        <article className="configuration-detail-card">
          <StepStatus done={snapshot.steps.programsAndClasses} text={text} />
          <h3>{text.classTitle}</h3>
          <p>{text.classBody}</p>
          {snapshot.steps.programsAndClasses ? <p><strong>{snapshot.groups[0]?.label}</strong></p> : snapshot.sessions.length && snapshot.programs.length ? (
            <form className="preset-preview" onSubmit={submitGroup}>
              <label className="field-label">{text.academicYear}<select className="text-field" name="sessionId" required>{snapshot.sessions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label className="field-label">{text.program}<select className="text-field" name="programId" required>{snapshot.programs.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label className="field-label">{text.classKey}<input className="text-field" name="classKey" pattern="[a-z0-9][a-z0-9_-]{0,63}" placeholder="class_1a" required /></label>
              <label className="field-label">{text.className}<input className="text-field" maxLength={120} name="className" required /></label>
              <label className="field-label">{text.capacity}<input className="text-field" max={5000} min={1} name="capacity" type="number" /></label>
              <button className="action-button action-button-primary" disabled={working !== null} type="submit">{working === "group" ? text.saving : text.createClass}</button>
            </form>
          ) : <p>{text.academicBody}</p>}
        </article>

        <article className="configuration-detail-card">
          <StepStatus done={snapshot.steps.start} text={text} />
          <h3>{text.startTitle}</h3>
          <p>{text.startBody}</p>
          <div className="number-preview"><small>{text.readiness}</small><strong>{snapshot.readinessPercent}%</strong></div>
          <div className="number-preview"><small>{text.students}</small><strong>{snapshot.studentTotal}</strong></div>
          <div className="workspace-actions" aria-label="Setup next actions">
            {snapshot.studentTotal === 0 ? <Link className="action-button action-button-primary" href={`/${locale}/students/new`}>{text.addStudent}</Link> : null}
            <Link className="action-button" href={`/${locale}/attendance`}>{text.openAttendance}</Link>
            <Link className="action-button" href={`/${locale}/quran`}>{text.openQuran}</Link>
            <Link className="action-button" href={`/${locale}`}>{text.dashboard}</Link>
          </div>
        </article>
      </div>

      {message ? <p aria-live="polite" className="workspace-inline-state"><strong>{message}</strong></p> : null}
    </div>
  );
}
