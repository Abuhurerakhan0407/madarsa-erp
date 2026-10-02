"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";

const copy = {
  en: {
    kicker: "Teacher / staff record", title: "Add teacher or staff member", body: "Create the basic staff record first. Email and phone can be added safely from the profile after creation.",
    name: "Full name", native: "Name in Urdu", gender: "Gender", language: "Preferred language", department: "Department", designation: "Designation", joined: "Joining date",
    choose: "Select", male: "Male", female: "Female", other: "Other", undisclosed: "Prefer not to say", save: "Create record", saving: "Creating…", cancel: "Cancel", error: "Unable to create teacher / staff member."
  },
  ur: {
    kicker: "استاد / عملہ ریکارڈ", title: "استاد یا عملے کا رکن شامل کریں", body: "پہلے بنیادی عملہ ریکارڈ بنائیں۔ ای میل اور فون بعد میں پروفائل سے محفوظ طریقے سے شامل کیے جا سکتے ہیں۔",
    name: "پورا نام", native: "اردو نام", gender: "جنس", language: "پسندیدہ زبان", department: "شعبہ", designation: "عہدہ", joined: "تاریخ شمولیت",
    choose: "منتخب کریں", male: "مرد", female: "عورت", other: "دیگر", undisclosed: "بتانا نہیں چاہتے", save: "ریکارڈ بنائیں", saving: "بن رہا ہے…", cancel: "منسوخ", error: "استاد / عملہ ریکارڈ نہیں بن سکا۔"
  }
} as const;

export function TeacherCreateForm({ locale }: { locale: SupportedLocale }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const text = copy[locale];
  async function submit(form: HTMLFormElement) {
    if (busy) return; setBusy(true); setError(null); const data = new FormData(form);
    const body = { displayName: String(data.get("displayName") || ""), nameNative: String(data.get("nameNative") || ""), gender: String(data.get("gender") || ""), preferredLocale: String(data.get("preferredLocale") || locale), departmentKey: String(data.get("departmentKey") || ""), designation: String(data.get("designation") || ""), joinedOn: String(data.get("joinedOn") || "") };
    try {
      const response = await fetch("/api/teachers/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({})) as { error?: string; result?: { employment_id?: number } };
      if (!response.ok) { setError(locale === "ur" ? text.error : (payload.error || text.error)); return; }
      const employmentId = Number(payload.result?.employment_id); if (!Number.isSafeInteger(employmentId) || employmentId <= 0) { setError(text.error); return; }
      router.push(`/${locale}/staff/${employmentId}`); router.refresh();
    } catch { setError(text.error); } finally { setBusy(false); }
  }
  return <form className="professional-card flow-form" aria-busy={busy || undefined} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
    <div><p className="state-kicker">{text.kicker}</p><h2>{text.title}</h2><p>{text.body}</p></div>
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
    <div className="form-grid">
      <label className="field-label">{text.name}<input className="text-field" name="displayName" required minLength={2} maxLength={160} disabled={busy} /></label>
      <label className="field-label">{text.native}<input className="text-field" name="nameNative" maxLength={160} dir="auto" disabled={busy} /></label>
      <label className="field-label">{text.gender}<select className="text-field" name="gender" defaultValue="" disabled={busy}><option value="">{text.choose}</option><option value="male">{text.male}</option><option value="female">{text.female}</option><option value="other">{text.other}</option><option value="undisclosed">{text.undisclosed}</option></select></label>
      <label className="field-label">{text.language}<select className="text-field" name="preferredLocale" defaultValue={locale} disabled={busy}><option value="en">English</option><option value="ur">اردو</option><option value="ar">العربية</option></select></label>
      <label className="field-label">{text.department}<input className="text-field" name="departmentKey" maxLength={80} defaultValue="academics" disabled={busy} /></label>
      <label className="field-label">{text.designation}<input className="text-field" name="designation" required minLength={2} maxLength={120} placeholder={locale === "ur" ? "مثلاً استاد" : "e.g. Teacher"} disabled={busy} /></label>
      <label className="field-label">{text.joined}<input className="text-field" name="joinedOn" type="date" required disabled={busy} /></label>
    </div>
    <div className="quick-actions"><button className="action-button action-button-primary" type="submit" disabled={busy}>{busy ? <><span className="inline-spinner" aria-hidden="true" />{text.saving}</> : text.save}</button><button className="action-button" type="button" disabled={busy} onClick={() => router.push(`/${locale}/staff`)}>{text.cancel}</button></div>
  </form>;
}
