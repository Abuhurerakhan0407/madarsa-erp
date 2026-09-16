"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale, SupportedLocale } from "@/lib/i18n/config";

type Student = {
  personId: number;
  name: string;
  nativeName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  preferredLocale: Locale;
  medicalSummary: string | null;
  accessibilityNeeds: string | null;
  pickupRestrictions: string | null;
};

const copy = {
  en: {
    name: "Student name",
    native: "Name in Urdu",
    dob: "Date of birth",
    gender: "Gender",
    language: "Preferred language",
    medical: "Medical notes",
    accessibility: "Accessibility / learning needs",
    pickup: "Pickup restrictions",
    save: "Save changes",
    saving: "Saving…",
    error: "Unable to save changes.",
    select: "Select",
    male: "Male",
    female: "Female",
    other: "Other",
    undisclosed: "Undisclosed"
  },
  ur: {
    name: "طالب علم کا نام",
    native: "اردو نام",
    dob: "تاریخ پیدائش",
    gender: "جنس",
    language: "ترجیحی زبان",
    medical: "طبی نوٹس",
    accessibility: "خصوصی / تعلیمی ضروریات",
    pickup: "پک اپ پابندیاں",
    save: "تبدیلیاں محفوظ کریں",
    saving: "محفوظ ہو رہا ہے…",
    error: "تبدیلیاں محفوظ نہیں ہو سکیں۔",
    select: "منتخب کریں",
    male: "مرد",
    female: "خاتون",
    other: "دیگر",
    undisclosed: "درج نہیں"
  }
} as const;

export function StudentEditForm({ locale, student }: { locale: SupportedLocale; student: Student }) {
  const text = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) || "").trim() || undefined;
    const selectedLocale = String(form.get("preferredLocale") || "").trim();
    const body = {
      displayName: String(form.get("displayName") || "").trim(),
      nameNative: optional("nameNative"),
      dateOfBirth: optional("dateOfBirth"),
      gender: optional("gender"),
      preferredLocale: selectedLocale || student.preferredLocale,
      medicalSummary: optional("medicalSummary"),
      accessibilityNeeds: optional("accessibilityNeeds"),
      pickupRestrictions: optional("pickupRestrictions")
    };
    try {
      const response = await fetch(`/api/students/${student.personId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error || text.error);
        return;
      }
      router.push(`/${locale}/students/${student.personId}`);
      router.refresh();
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  const preferredLocaleDefault = student.preferredLocale === "en" || student.preferredLocale === "ur"
    ? student.preferredLocale
    : "";

  return <form className="configuration-form" aria-busy={busy} onSubmit={submit}>
    <section className="panel"><div className="configuration-form-grid">
      <label className="field-label">{text.name}<input className="text-field" name="displayName" defaultValue={student.name} required minLength={2} maxLength={160} /></label>
      <label className="field-label">{text.native}<input className="text-field" name="nameNative" defaultValue={student.nativeName || ""} dir="auto" maxLength={160} /></label>
      <label className="field-label">{text.dob}<input className="text-field" name="dateOfBirth" type="date" defaultValue={student.dateOfBirth || ""} /></label>
      <label className="field-label">{text.gender}<select className="text-field" name="gender" defaultValue={student.gender || ""}><option value="">—</option><option value="male">{text.male}</option><option value="female">{text.female}</option><option value="other">{text.other}</option><option value="undisclosed">{text.undisclosed}</option></select></label>
      <label className="field-label">{text.language}<select className="text-field" name="preferredLocale" defaultValue={preferredLocaleDefault}><option value="">{text.select}</option><option value="en">English</option><option value="ur">اردو</option></select></label>
    </div></section>
    <section className="panel"><div className="configuration-form-grid">
      <label className="field-label">{text.medical}<textarea className="text-field" name="medicalSummary" defaultValue={student.medicalSummary || ""} rows={3} maxLength={1000} /></label>
      <label className="field-label">{text.accessibility}<textarea className="text-field" name="accessibilityNeeds" defaultValue={student.accessibilityNeeds || ""} rows={3} maxLength={1000} /></label>
      <label className="field-label">{text.pickup}<textarea className="text-field" name="pickupRestrictions" defaultValue={student.pickupRestrictions || ""} rows={3} maxLength={1000} /></label>
    </div></section>
    <button className="action-button action-button-primary" type="submit" disabled={busy}>{busy ? text.saving : text.save}</button>
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
  </form>;
}
