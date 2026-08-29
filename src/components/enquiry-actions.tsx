"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { enquiryChannelLabel, enquiryStatusLabel } from "@/lib/admissions/enquiry-labels";
import type { Locale } from "@/lib/i18n/config";

const copy = {
  en: { title: "Record follow-up", channel: "Channel", outcome: "Outcome", status: "New status", next: "Next follow-up (optional)", save: "Complete follow-up", start: "Start admission application", working: "Working…", duplicate: "Possible duplicate found. Confirm only after checking records.", reason: "Duplicate override reason (20+ characters)", confirm: "I reviewed the possible duplicate", error: "Unable to update enquiry.", token: "Applicant tracking credentials — copy now" },
  ur: { title: "رابطہ درج کریں", channel: "ذریعہ", outcome: "نتیجہ", status: "نئی حالت", next: "اگلا رابطہ (اختیاری)", save: "رابطہ مکمل کریں", start: "داخلہ درخواست شروع کریں", working: "کارروائی جاری ہے…", duplicate: "ممکنہ نقل ملی۔ ریکارڈ دیکھنے کے بعد ہی تصدیق کریں۔", reason: "نقل کی منظوری کی وجہ (کم از کم 20 حروف)", confirm: "میں نے ممکنہ نقل کا جائزہ لیا", error: "استفسار اپ ڈیٹ نہیں ہوا۔", token: "درخواست گزار کی ٹریکنگ معلومات — ابھی نقل کریں" },
  ar: { title: "تسجيل المتابعة", channel: "القناة", outcome: "النتيجة", status: "الحالة الجديدة", next: "المتابعة التالية (اختياري)", save: "إكمال المتابعة", start: "بدء طلب القبول", working: "جارٍ التنفيذ…", duplicate: "تم العثور على تطابق محتمل. أكد بعد مراجعة السجلات.", reason: "سبب تجاوز التكرار (20 حرفًا على الأقل)", confirm: "راجعت التطابق المحتمل", error: "تعذر تحديث الاستفسار.", token: "بيانات تتبع المتقدم — انسخها الآن" }
} as const;

export function EnquiryActions({ enquiryId, locale, status, hasOpenFollowUp, applicationId }: { enquiryId: number; locale: Locale; status: string; hasOpenFollowUp: boolean; applicationId: number | null }) {
  const text = copy[locale]; const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [duplicate, setDuplicate] = useState(false); const [tracking, setTracking] = useState<{ id: string; token: string } | null>(null);
  async function followup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); const form = new FormData(event.currentTarget); const next = String(form.get("nextFollowUpAt") || "");
    try {
      const parsedNext = next ? new Date(next) : null;
      if (parsedNext && !Number.isFinite(parsedNext.getTime())) throw new Error("Invalid follow-up date");
      const response = await fetch("/api/admissions/enquiries/followup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enquiryId, channel: form.get("channel"), outcome: form.get("outcome"), newStatus: form.get("newStatus"), nextFollowUpAt: parsedNext?.toISOString() ?? null }) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) setError(payload.error || text.error); else router.refresh();
    } catch { setError(text.error); } finally { setBusy(false); }
  }
  async function startApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admissions/enquiries/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enquiryId, confirmDuplicate: form.get("confirmDuplicate") === "on", overrideReason: form.get("overrideReason") }) });
      const payload = await response.json().catch(() => ({})) as { error?: string; result?: { duplicate_review_required?: boolean; application_id?: number; tracking_id?: string; trackingToken?: string } };
      if (payload.result?.duplicate_review_required) setDuplicate(true);
      else if (!response.ok || !payload.result?.application_id || !payload.result.tracking_id || !payload.result.trackingToken) setError(payload.error || text.error);
      else { setTracking({ id: payload.result.tracking_id, token: payload.result.trackingToken }); router.refresh(); }
    } catch { setError(text.error); } finally { setBusy(false); }
  }
  return <section className="configuration-detail-card"><h2>{text.title}</h2>
    {hasOpenFollowUp && !applicationId ? <form aria-busy={busy} className="configuration-form" onSubmit={followup}>
      <label className="field-label">{text.channel}<select className="text-field" name="channel" defaultValue="phone"><option value="phone">{enquiryChannelLabel(locale, "phone")}</option><option value="email">{enquiryChannelLabel(locale, "email")}</option><option value="whatsapp">{enquiryChannelLabel(locale, "whatsapp")}</option><option value="in_person">{enquiryChannelLabel(locale, "in_person")}</option></select></label>
      <label className="field-label">{text.outcome}<textarea className="text-field" name="outcome" minLength={2} maxLength={2000} required /></label>
      <label className="field-label">{text.status}<select className="text-field" name="newStatus" defaultValue="contacted"><option value="contacted">{enquiryStatusLabel(locale, "contacted")}</option><option value="qualified">{enquiryStatusLabel(locale, "qualified")}</option><option value="lost">{enquiryStatusLabel(locale, "lost")}</option><option value="archived">{enquiryStatusLabel(locale, "archived")}</option></select></label>
      <label className="field-label">{text.next}<input className="text-field" name="nextFollowUpAt" type="datetime-local" /></label>
      <button className="action-button action-button-primary" disabled={busy} type="submit">{busy ? text.working : text.save}</button>
    </form> : null}
    {status === "qualified" && !applicationId ? <form aria-busy={busy} className="configuration-form" onSubmit={startApplication}>
      {duplicate ? <><p className="form-message form-error">{text.duplicate}</p><label className="check-row"><input name="confirmDuplicate" type="checkbox" required /><span>{text.confirm}</span></label><label className="field-label">{text.reason}<textarea className="text-field" name="overrideReason" minLength={20} maxLength={2000} required /></label></> : null}
      <button className="action-button action-button-primary" disabled={busy} type="submit">{busy ? text.working : text.start}</button>
    </form> : null}
    {tracking ? <div className="form-message" role="status"><strong>{text.token}</strong><p><code>{tracking.id}</code></p><p><code>{tracking.token}</code></p></div> : null}
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
  </section>;
}
