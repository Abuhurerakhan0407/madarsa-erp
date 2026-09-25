"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalCredentialManager } from "@/components/portal-credential-manager";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { PortalOperatorCenter } from "@/lib/portal/runtime";

type Props = {
  center: PortalOperatorCenter;
  initialTab?: "parents" | "teachers";
  locale: SupportedLocale;
};

const copy = {
  en: {
    communication: "Portal communication",
    publishNotice: "Publish a notice",
    audience: "Audience",
    everyone: "Everyone with portal access",
    parentsGuardians: "Parents / guardians",
    teachersEmployees: "Teachers / employees",
    priority: "Priority",
    normal: "Normal",
    important: "Important",
    urgent: "Urgent",

    title: "Title",
    message: "Message",
    publishing: "Publishing…",
    publish: "Publish notice",
    publishError: "Unable to publish the notice. Please try again."
  },
  ur: {
    communication: "پورٹل رابطہ",
    publishNotice: "اطلاع شائع کریں",
    audience: "مخاطبین",
    everyone: "تمام پورٹل صارفین",
    parentsGuardians: "والدین / سرپرست",
    teachersEmployees: "اساتذہ / ملازمین",
    priority: "ترجیح",
    normal: "معمول",
    important: "اہم",
    urgent: "فوری",
    title: "عنوان",
    message: "پیغام",
    publishing: "شائع ہو رہی ہے…",
    publish: "اطلاع شائع کریں",
    publishError: "اطلاع شائع نہیں ہو سکی۔ دوبارہ کوشش کریں۔"
  }
} as const;

export function PortalAdminCenter({ center, initialTab = "parents", locale }: Props) {
  const router = useRouter();
  const t = copy[locale];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  async function publish(form: FormData) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);

    try {
      const payload = {
        audienceType: String(form.get("audienceType") ?? "tenant"),
        priority: String(form.get("priority") ?? "normal"),
        title: String(form.get("title") ?? ""),
        body: String(form.get("body") ?? "")
      };
      const response = await fetch("/api/portals/notices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || t.publishError);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.publishError);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flow-stack" lang={locale}>
      <PortalCredentialManager center={center} initialTab={initialTab} locale={locale} />

      <section className="professional-card">
        <p className="state-kicker">{t.communication}</p>
        <h2>{t.publishNotice}</h2>
        {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}
        <form action={publish} className="flow-form" aria-busy={busy || undefined}>
          <label className="field-label">
            {t.audience}
            <select name="audienceType" className="text-field" defaultValue="tenant">

              <option value="tenant">{t.everyone}</option>
              <option value="parents">{t.parentsGuardians}</option>
              <option value="employees">{t.teachersEmployees}</option>
            </select>
          </label>
          <label className="field-label">
            {t.priority}
            <select name="priority" className="text-field" defaultValue="normal">
              <option value="normal">{t.normal}</option>
              <option value="important">{t.important}</option>
              <option value="urgent">{t.urgent}</option>
            </select>
          </label>
          <label className="field-label">
            {t.title}
            <input name="title" className="text-field" required minLength={2} maxLength={160} disabled={busy} />
          </label>
          <label className="field-label">
            {t.message}
            <textarea name="body" className="text-field" required minLength={2} maxLength={4000} rows={5} disabled={busy} />
          </label>

          <button className="action-button action-button-primary" disabled={busy} type="submit">
            {busy ? t.publishing : t.publish}
          </button>
        </form>
      </section>
    </div>
  );
}
