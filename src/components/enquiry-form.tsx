"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n/config";

type Option = { id: number; label: string };
const copy = {
  en: { applicant: "Applicant name", guardian: "Guardian name", phone: "Guardian phone", email: "Guardian email", session: "Academic session", program: "Program interest", language: "Preferred language", source: "Source", sourceHint: "Walk-in / referral / website", notes: "Notes", followup: "Next follow-up", consent: "Contact consent recorded", save: "Create enquiry", saving: "Saving…", error: "Unable to create enquiry." },
  ur: { applicant: "درخواست گزار کا نام", guardian: "سرپرست کا نام", phone: "سرپرست کا فون", email: "سرپرست کا ای میل", session: "تعلیمی سال", program: "پروگرام میں دلچسپی", language: "ترجیحی زبان", source: "ذریعہ", sourceHint: "بالمشافہ / حوالہ / ویب سائٹ", notes: "نوٹس", followup: "اگلا رابطہ", consent: "رابطے کی رضامندی درج ہے", save: "استفسار بنائیں", saving: "محفوظ ہو رہا ہے…", error: "استفسار نہیں بن سکا۔" },
  ar: { applicant: "اسم المتقدم", guardian: "اسم ولي الأمر", phone: "هاتف ولي الأمر", email: "بريد ولي الأمر", session: "العام الدراسي", program: "البرنامج المطلوب", language: "اللغة المفضلة", source: "المصدر", sourceHint: "زيارة / إحالة / الموقع", notes: "ملاحظات", followup: "المتابعة التالية", consent: "تم تسجيل موافقة التواصل", save: "إنشاء استفسار", saving: "جارٍ الحفظ…", error: "تعذر إنشاء الاستفسار." }
} as const;

export function EnquiryForm({ locale, sessions, programs }: { locale: Locale; sessions: Option[]; programs: Option[] }) {
  const text = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const followup = String(form.get("nextFollowUpAt") || "");
    try {
      const parsedFollowup = new Date(followup);
      if (!followup || !Number.isFinite(parsedFollowup.getTime())) throw new Error("Invalid follow-up date");
      const body = { applicantName: form.get("applicantName"), guardianName: form.get("guardianName"), phone: form.get("phone"), email: form.get("email"), sessionId: Number(form.get("sessionId")), programId: Number(form.get("programId")), preferredLocale: form.get("preferredLocale"), source: form.get("source"), notes: form.get("notes"), nextFollowUpAt: parsedFollowup.toISOString(), consent: form.get("consent") === "on" };
      const response = await fetch("/api/admissions/enquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({})) as { error?: string; result?: { id?: number; possible_duplicates?: number } };
      if (!response.ok || !payload.result?.id) return setError(payload.error || text.error);
      const duplicateQuery = payload.result.possible_duplicates
        ? `?possibleDuplicates=${payload.result.possible_duplicates}`
        : "";
      router.push(`/${locale}/admissions/enquiries/${payload.result.id}${duplicateQuery}`);
      router.refresh();
    } catch { setError(text.error); } finally { setBusy(false); }
  }
  return <form aria-busy={busy} className="configuration-form" onSubmit={submit}>
    <div className="configuration-form-grid">
      <label className="field-label">{text.applicant}<input className="text-field" name="applicantName" required minLength={2} maxLength={160} /></label>
      <label className="field-label">{text.guardian}<input className="text-field" name="guardianName" maxLength={160} /></label>
      <label className="field-label">{text.phone}<input className="text-field" name="phone" inputMode="tel" maxLength={40} /></label>
      <label className="field-label">{text.email}<input className="text-field" name="email" type="email" maxLength={320} /></label>
      <label className="field-label">{text.session}<select className="text-field" name="sessionId" required defaultValue=""><option value="" disabled>—</option>{sessions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label className="field-label">{text.program}<select className="text-field" name="programId" required defaultValue=""><option value="" disabled>—</option>{programs.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label className="field-label">{text.language}<select className="text-field" name="preferredLocale" defaultValue={locale}><option value="en">English</option><option value="ur">اردو</option><option value="ar">العربية</option></select></label>
      <label className="field-label">{text.source}<input className="text-field" name="source" maxLength={80} placeholder={text.sourceHint} /></label>
      <label className="field-label">{text.followup}<input className="text-field" name="nextFollowUpAt" type="datetime-local" required /></label>
    </div>
    <label className="field-label">{text.notes}<textarea className="text-field" name="notes" rows={4} maxLength={2000} /></label>
    <label className="check-row"><input name="consent" type="checkbox" required /> <span>{text.consent}</span></label>
    <button className="action-button action-button-primary" disabled={busy || !sessions.length || !programs.length} type="submit">{busy ? text.saving : text.save}</button>
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
  </form>;
}
