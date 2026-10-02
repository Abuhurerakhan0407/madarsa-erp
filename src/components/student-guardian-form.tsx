"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";

type Guardian = { name: string; relationship: string; phone: string | null; occupation: string | null; education: string | null; canCollect: boolean } | null;

const copy = {
  en: { title: "Primary guardian", body: "Maintain the student's main family contact and pickup authority.", name: "Guardian name", relationship: "Relationship", phone: "Phone", occupation: "Occupation", education: "Education", collect: "Authorized to collect student", save: "Save guardian", saving: "Saving…", saved: "Guardian details saved.", error: "Unable to save guardian details.", father: "Father", mother: "Mother", guardian: "Guardian" },
  ur: { title: "بنیادی سرپرست", body: "طالب علم کے بنیادی خاندانی رابطے اور پک اپ اختیار کو برقرار رکھیں۔", name: "سرپرست کا نام", relationship: "رشتہ", phone: "فون", occupation: "پیشہ", education: "تعلیم", collect: "طالب علم کو لے جانے کی اجازت", save: "سرپرست محفوظ کریں", saving: "محفوظ ہو رہا ہے…", saved: "سرپرست کی معلومات محفوظ ہو گئیں۔", error: "سرپرست کی معلومات محفوظ نہیں ہو سکیں۔", father: "والد", mother: "والدہ", guardian: "سرپرست" }
} as const;

export function StudentGuardianForm({ locale, personId, guardian }: { locale: SupportedLocale; personId: number; guardian: Guardian }) {
  const text = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) || "").trim() || undefined;
    const body = {
      name: String(form.get("name") || "").trim(),
      relationship: form.get("relationship"),
      phone: optional("phone"),
      occupation: optional("occupation"),
      education: optional("education"),
      canCollect: form.get("canCollect") === "on"
    };
    try {
      const response = await fetch(`/api/students/${personId}/guardian`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(payload.error || text.error); return; }
      setSaved(true);
      router.refresh();
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <header className="panel-header"><div><h2>{text.title}</h2><span>{text.body}</span></div></header>
    <form className="configuration-form" aria-busy={busy} onSubmit={submit}>
      <div className="configuration-form-grid">
        <label className="field-label">{text.name}<input className="text-field" name="name" defaultValue={guardian?.name || ""} required minLength={2} maxLength={160} /></label>
        <label className="field-label">{text.relationship}<select className="text-field" name="relationship" defaultValue={guardian?.relationship || "guardian"}><option value="father">{text.father}</option><option value="mother">{text.mother}</option><option value="guardian">{text.guardian}</option></select></label>
        <label className="field-label">{text.phone}<input className="text-field" name="phone" inputMode="tel" defaultValue={guardian?.phone || ""} maxLength={80} /></label>
        <label className="field-label">{text.occupation}<input className="text-field" name="occupation" defaultValue={guardian?.occupation || ""} maxLength={160} /></label>
        <label className="field-label">{text.education}<input className="text-field" name="education" defaultValue={guardian?.education || ""} maxLength={160} /></label>
      </div>
      <label className="check-row"><input name="canCollect" type="checkbox" defaultChecked={guardian ? guardian.canCollect : true} /> <span>{text.collect}</span></label>
      <button className="action-button action-button-primary" type="submit" disabled={busy}>{busy ? text.saving : text.save}</button>
      {saved ? <p className="form-message" role="status">{text.saved}</p> : null}
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
    </form>
  </section>;
}
