"use client";

import { useState, type FormEvent } from "react";
import { admissionStateLabel } from "@/lib/admissions/enquiry-labels";
import type { PublicAdmissionLocale } from "@/lib/admissions/public-intake-model";

type TrackingResult = {
  state?: string;
  submittedAt?: string;
  tenantName?: string;
  programLabels?: Record<string, string>;
  sessionLabels?: Record<string, string>;
};

type PublicAdmissionTrackerProps = {
  locale: PublicAdmissionLocale;
  initialReference?: string;
};

const ui = {
  en: {
    kicker: "Admissions tracking",
    title: "Track your application",
    body: "Enter the tracking reference and private key shown after submission. The private key is never included in the URL.",
    reference: "Tracking reference",
    secret: "Private tracking key",
    submit: "Check status",
    loading: "Checking securely…",
    language: "Language",
    notFound: "We could not verify those tracking details.",
    submitted: "Submitted",
    program: "Program",
    session: "Academic session",
    institution: "Institution",
    status: "Current status",
    received: "Received",
    again: "Check another application"
  },
  ur: {
    kicker: "داخلہ ٹریکنگ",
    title: "اپنی درخواست کی پیش رفت دیکھیں",
    body: "درخواست جمع ہونے کے بعد دکھایا گیا ٹریکنگ حوالہ اور نجی کلید درج کریں۔ نجی کلید کبھی URL میں شامل نہیں کی جاتی۔",
    reference: "ٹریکنگ حوالہ",
    secret: "نجی ٹریکنگ کلید",
    submit: "حالت دیکھیں",
    loading: "محفوظ طریقے سے چیک ہو رہا ہے…",
    language: "زبان",
    notFound: "ان ٹریکنگ معلومات کی تصدیق نہیں ہو سکی۔",
    submitted: "جمع شدہ",
    program: "پروگرام",
    session: "تعلیمی سال",
    institution: "ادارہ",
    status: "موجودہ حالت",
    received: "موصول",
    again: "دوسری درخواست چیک کریں"
  }
} as const;

function label(labels: Record<string, string> | undefined, locale: PublicAdmissionLocale): string {
  return labels?.[locale] || labels?.en || "—";
}

export function PublicAdmissionTracker({ locale, initialReference = "" }: PublicAdmissionTrackerProps) {
  const text = ui[locale];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/public/admissions/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          trackingId: String(data.get("trackingId") ?? ""),
          trackingToken: String(data.get("trackingToken") ?? "")
        })
      });
      const payload = (await response.json()) as TrackingResult & { error?: string };
      if (!response.ok) {
        setError(payload.error || text.notFound);
        return;
      }
      setResult(payload);
    } catch {
      setError(text.notFound);
    } finally {
      setBusy(false);
    }
  }

  const stateLabel = result?.state ? admissionStateLabel(locale, result.state) : "—";

  return (
    <main className="tracking-shell" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
      <section className="tracking-card">
        <header className="tracking-header">
          <div>
            <div className="tracking-brand">I</div>
            <p className="tracking-kicker">{text.kicker}</p>
            <h1>{text.title}</h1>
            <p>{text.body}</p>
          </div>
          <div className="tracking-languages" aria-label={text.language}>
            <a aria-current={locale === "en" ? "page" : undefined} href={`?lang=en${initialReference ? `&ref=${encodeURIComponent(initialReference)}` : ""}`}>EN</a>
            <a aria-current={locale === "ur" ? "page" : undefined} href={`?lang=ur${initialReference ? `&ref=${encodeURIComponent(initialReference)}` : ""}`}>اردو</a>
          </div>
        </header>

        <form className="tracking-form" onSubmit={submit}>
          <label>
            <span>{text.reference}</span>
            <input name="trackingId" defaultValue={initialReference} autoComplete="off" required />
          </label>
          <label>
            <span>{text.secret}</span>
            <input name="trackingToken" type="password" autoComplete="off" minLength={32} maxLength={128} required />
          </label>
          {error ? <p className="tracking-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={busy}>{busy ? text.loading : text.submit}</button>
        </form>

        {result ? (
          <section className="tracking-result" aria-live="polite">
            <div><span>{text.status}</span><strong>{stateLabel}</strong></div>
            <div><span>{text.institution}</span><strong>{result.tenantName || "—"}</strong></div>
            <div><span>{text.program}</span><strong>{label(result.programLabels, locale)}</strong></div>
            <div><span>{text.session}</span><strong>{label(result.sessionLabels, locale)}</strong></div>
            <div><span>{text.received}</span><strong>{result.submittedAt ? new Intl.DateTimeFormat(locale === "en" ? "en-IN" : locale === "ur" ? "ur-IN" : "ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.submittedAt)) : "—"}</strong></div>
            <button type="button" className="secondary" onClick={() => { setResult(null); setError(null); }}>{text.again}</button>
          </section>
        ) : null}
      </section>
    </main>
  );
}
