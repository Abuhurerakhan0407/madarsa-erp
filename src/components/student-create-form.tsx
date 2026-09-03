"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FieldGroup } from "@/components/workspace-ui";
import type { Locale } from "@/lib/i18n/config";

type Option = { id: number; label: string };
type GroupOption = Option & { sessionId: number; programId: number };
type CreateBody = {
  displayName: string;
  nameNative?: string;
  dateOfBirth?: string;
  gender?: string;
  preferredLocale: Locale;
  sessionId: number;
  programId: number;
  groupId?: number;
  joinedOn?: string;
  medicalSummary?: string;
  accessibilityNeeds?: string;
  pickupRestrictions?: string;
  guardian?: { name: string; relationship: string; phone?: string };
  confirmNewPerson?: boolean;
};

const copy = {
  en: { student: "Student details", academic: "Academic placement", guardian: "Guardian", wellbeing: "Health & safeguarding", name: "Student name", native: "Name in Urdu / Arabic", dob: "Date of birth", gender: "Gender", language: "Preferred language", session: "Academic session", program: "Program", group: "Class / group", joined: "Joining date", guardianName: "Guardian name", relationship: "Relationship", phone: "Guardian phone", medical: "Medical notes", accessibility: "Accessibility / learning needs", pickup: "Pickup restrictions", save: "Create student", saving: "Creating…", duplicate: "A possible matching person already exists. Review the details before creating a separate student record.", confirm: "Create as separate student", error: "Unable to create the student.", none: "Not assigned", male: "Male", female: "Female", other: "Other", undisclosed: "Undisclosed", father: "Father", mother: "Mother", guardianRole: "Guardian" },
  ur: { student: "طالب علم کی تفصیلات", academic: "تعلیمی تعیناتی", guardian: "سرپرست", wellbeing: "صحت اور حفاظت", name: "طالب علم کا نام", native: "اردو / عربی نام", dob: "تاریخ پیدائش", gender: "جنس", language: "ترجیحی زبان", session: "تعلیمی سال", program: "پروگرام", group: "کلاس / گروپ", joined: "شمولیت کی تاریخ", guardianName: "سرپرست کا نام", relationship: "رشتہ", phone: "سرپرست کا فون", medical: "طبی نوٹس", accessibility: "خصوصی / تعلیمی ضروریات", pickup: "پک اپ پابندیاں", save: "طالب علم بنائیں", saving: "بنایا جا رہا ہے…", duplicate: "ممکنہ طور پر ملتا جلتا فرد پہلے سے موجود ہے۔ الگ ریکارڈ بنانے سے پہلے تفصیلات چیک کریں۔", confirm: "الگ طالب علم بنائیں", error: "طالب علم نہیں بنایا جا سکا۔", none: "متعین نہیں", male: "مرد", female: "خاتون", other: "دیگر", undisclosed: "درج نہیں", father: "والد", mother: "والدہ", guardianRole: "سرپرست" },
  ar: { student: "بيانات الطالب", academic: "التسجيل الأكاديمي", guardian: "ولي الأمر", wellbeing: "الصحة والحماية", name: "اسم الطالب", native: "الاسم بالأردية / العربية", dob: "تاريخ الميلاد", gender: "الجنس", language: "اللغة المفضلة", session: "العام الدراسي", program: "البرنامج", group: "الفصل / المجموعة", joined: "تاريخ الالتحاق", guardianName: "اسم ولي الأمر", relationship: "صلة القرابة", phone: "هاتف ولي الأمر", medical: "ملاحظات طبية", accessibility: "احتياجات التعلم / الوصول", pickup: "قيود الاستلام", save: "إنشاء الطالب", saving: "جارٍ الإنشاء…", duplicate: "يوجد شخص محتمل مطابق. راجع البيانات قبل إنشاء سجل طالب منفصل.", confirm: "إنشاء طالب منفصل", error: "تعذر إنشاء الطالب.", none: "غير معين", male: "ذكر", female: "أنثى", other: "أخرى", undisclosed: "غير مذكور", father: "الأب", mother: "الأم", guardianRole: "ولي أمر" }
} as const;

function value(form: FormData, name: string) { const v = String(form.get(name) || "").trim(); return v || undefined; }

export function StudentCreateForm({ locale, sessions, programs, groups }: { locale: Locale; sessions: Option[]; programs: Option[]; groups: GroupOption[] }) {
  const text = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateBody, setDuplicateBody] = useState<CreateBody | null>(null);
  const [sessionId, setSessionId] = useState<number>(sessions[0]?.id ?? 0);
  const [programId, setProgramId] = useState<number>(programs[0]?.id ?? 0);
  const visibleGroups = useMemo(() => groups.filter((group) => group.sessionId === sessionId && group.programId === programId), [groups, sessionId, programId]);

  async function create(body: CreateBody) {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/students", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({})) as { error?: string; duplicateReviewRequired?: boolean; result?: { personId?: number } };
      if (response.status === 409 && payload.duplicateReviewRequired) { setDuplicateBody(body); setError(payload.error || text.duplicate); return; }
      if (!response.ok || !payload.result?.personId) { setError(payload.error || text.error); return; }
      setDuplicateBody(null);
      router.push(`/${locale}/students/${payload.result.personId}?created=1`);
      router.refresh();
    } catch { setError(text.error); } finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const guardianName = value(form, "guardianName");
    const body: CreateBody = {
      displayName: String(form.get("displayName") || "").trim(),
      nameNative: value(form, "nameNative"), dateOfBirth: value(form, "dateOfBirth"), gender: value(form, "gender"), preferredLocale: String(form.get("preferredLocale") || locale) as Locale,
      sessionId: Number(form.get("sessionId")), programId: Number(form.get("programId")), groupId: Number(form.get("groupId")) || undefined, joinedOn: value(form, "joinedOn"),
      medicalSummary: value(form, "medicalSummary"), accessibilityNeeds: value(form, "accessibilityNeeds"), pickupRestrictions: value(form, "pickupRestrictions"),
      guardian: guardianName ? { name: guardianName, relationship: String(form.get("relationship") || "guardian"), phone: value(form, "guardianPhone") } : undefined
    };
    setDuplicateBody(null);
    await create(body);
  }

  return <form className="configuration-form client-v2-form" aria-busy={busy} onSubmit={submit}>
    <section className="panel"><header className="panel-header"><h2>{text.student}</h2></header><div className="configuration-form-grid">
      <FieldGroup label={text.name}><input name="displayName" required minLength={2} maxLength={160} autoComplete="off" /></FieldGroup>
      <FieldGroup label={text.native}><input name="nameNative" maxLength={160} dir="auto" /></FieldGroup>
      <FieldGroup label={text.dob}><input name="dateOfBirth" type="date" /></FieldGroup>
      <FieldGroup label={text.gender}><select name="gender" defaultValue=""><option value="">—</option><option value="male">{text.male}</option><option value="female">{text.female}</option><option value="other">{text.other}</option><option value="undisclosed">{text.undisclosed}</option></select></FieldGroup>
      <FieldGroup label={text.language}><select name="preferredLocale" defaultValue={locale}><option value="en">English</option><option value="ur">اردو</option><option value="ar">العربية</option></select></FieldGroup>
    </div></section>

    <section className="panel"><header className="panel-header"><h2>{text.academic}</h2></header><div className="configuration-form-grid">
      <FieldGroup label={text.session}><select name="sessionId" required value={sessionId || ""} onChange={(event) => setSessionId(Number(event.target.value))}><option value="" disabled>—</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FieldGroup>
      <FieldGroup label={text.program}><select name="programId" required value={programId || ""} onChange={(event) => setProgramId(Number(event.target.value))}><option value="" disabled>—</option>{programs.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FieldGroup>
      <FieldGroup label={text.group}><select name="groupId" defaultValue=""><option value="">{text.none}</option>{visibleGroups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></FieldGroup>
      <FieldGroup label={text.joined}><input name="joinedOn" type="date" /></FieldGroup>
    </div></section>

    <section className="panel"><header className="panel-header"><h2>{text.guardian}</h2></header><div className="configuration-form-grid">
      <FieldGroup label={text.guardianName}><input name="guardianName" maxLength={160} /></FieldGroup>
      <FieldGroup label={text.relationship}><select name="relationship" defaultValue="father"><option value="father">{text.father}</option><option value="mother">{text.mother}</option><option value="guardian">{text.guardianRole}</option></select></FieldGroup>
      <FieldGroup label={text.phone}><input name="guardianPhone" inputMode="tel" maxLength={80} /></FieldGroup>
    </div></section>

    <section className="panel"><header className="panel-header"><h2>{text.wellbeing}</h2></header><div className="configuration-form-grid">
      <FieldGroup label={text.medical}><textarea name="medicalSummary" rows={3} maxLength={1000} /></FieldGroup>
      <FieldGroup label={text.accessibility}><textarea name="accessibilityNeeds" rows={3} maxLength={1000} /></FieldGroup>
      <FieldGroup label={text.pickup}><textarea name="pickupRestrictions" rows={3} maxLength={1000} /></FieldGroup>
    </div></section>

    <div className="quick-actions"><button className="action-button action-button-primary" type="submit" disabled={busy || !sessions.length || !programs.length}>{busy ? text.saving : text.save}</button>{duplicateBody ? <button className="action-button" type="button" disabled={busy} onClick={() => create({ ...duplicateBody, confirmNewPerson: true })}>{text.confirm}</button> : null}</div>
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
  </form>;
}
