"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n/config";

type Placement = { currentGroupId: number | null; groups: Array<{ id: number; label: string }> };

const copy = {
  en: { group: "Class / group", unassigned: "Not assigned", reason: "Reason / note", reasonHint: "Optional administrative note for the placement change", save: "Update placement", saving: "Updating…", saved: "Placement updated.", error: "Unable to update placement.", noGroups: "No active groups exist for this student's current session and program. Create the academic group first." },
  ur: { group: "کلاس / گروپ", unassigned: "مقرر نہیں", reason: "وجہ / نوٹ", reasonHint: "پلیسمنٹ تبدیلی کے لیے اختیاری انتظامی نوٹ", save: "پلیسمنٹ اپ ڈیٹ کریں", saving: "اپ ڈیٹ ہو رہا ہے…", saved: "پلیسمنٹ اپ ڈیٹ ہو گئی۔", error: "پلیسمنٹ اپ ڈیٹ نہیں ہو سکی۔", noGroups: "اس طالب علم کے موجودہ تعلیمی سال اور پروگرام کے لیے کوئی فعال گروپ موجود نہیں۔ پہلے تعلیمی گروپ بنائیں۔" },
  ar: { group: "الفصل / المجموعة", unassigned: "غير معين", reason: "السبب / ملاحظة", reasonHint: "ملاحظة إدارية اختيارية لتغيير التوزيع", save: "تحديث التوزيع", saving: "جارٍ التحديث…", saved: "تم تحديث التوزيع.", error: "تعذر تحديث التوزيع.", noGroups: "لا توجد مجموعات نشطة للعام والبرنامج الحاليين لهذا الطالب. أنشئ المجموعة الأكاديمية أولاً." }
} as const;

export function StudentPlacementForm({ locale, personId, placement }: { locale: Locale; personId: number; placement: Placement }) {
  const text = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    const rawGroup = String(form.get("groupId") || "");
    const body = { groupId: rawGroup ? Number(rawGroup) : null, reason: String(form.get("reason") || "").trim() };
    try {
      const response = await fetch(`/api/students/${personId}/placement`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(payload.error || text.error); return; }
      setMessage(text.saved);
      router.refresh();
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  return <form className="configuration-form" aria-busy={busy} onSubmit={submit}>
    {!placement.groups.length ? <div className="privacy-callout"><strong>{text.noGroups}</strong></div> : null}
    <div className="configuration-form-grid">
      <label className="field-label">{text.group}<select className="text-field" name="groupId" defaultValue={placement.currentGroupId ?? ""}><option value="">{text.unassigned}</option>{placement.groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
      <label className="field-label">{text.reason}<input className="text-field" name="reason" maxLength={500} placeholder={text.reasonHint} /></label>
    </div>
    <button className="action-button action-button-primary" type="submit" disabled={busy}>{busy ? text.saving : text.save}</button>
    {message ? <p className="form-message" role="status">{message}</p> : null}
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
  </form>;
}
