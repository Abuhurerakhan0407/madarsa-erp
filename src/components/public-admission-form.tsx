"use client";

import { useState, type FormEvent } from "react";
import type {
  PublicAdmissionLocale,
  PublicAdmissionSection
} from "@/lib/admissions/public-intake-model";

type LocalizedLabels = Record<string, string>;

type IntakeOption = {
  key: string;
  labels: LocalizedLabels;
};

type PublicAdmissionFormProps = {
  tenantName: string;
  branchName: string;
  tenantSlug: string;
  locale: PublicAdmissionLocale;
  formLabels: LocalizedLabels;
  sessions: Array<IntakeOption & { startsOn: string; endsOn: string; isDefault: boolean }>;
  programs: Array<IntakeOption & { programType: string }>;
  sections: PublicAdmissionSection[];
};

type SubmitResult = {
  trackingId: string;
  trackingToken: string;
};

const ui = {
  en: {
    admissions: "Admissions",
    branch: "Branch",
    session: "Academic session",
    program: "Program",
    required: "Required",
    consent: "I confirm the information is accurate and consent to its use for this admission application.",
    submit: "Submit application",
    submitting: "Submitting securely…",
    successTitle: "Application submitted",
    successBody: "Keep this private tracking information. It will be required for applicant tracking and future updates.",
    reference: "Tracking reference",
    secret: "Private tracking key",
    trackApplication: "Track this application",
    newApplication: "Submit another application",
    error: "We could not submit the application. Check the highlighted information and try again.",
    language: "Language"
  },
  ur: {
    admissions: "داخلہ",
    branch: "شاخ",
    session: "تعلیمی سال",
    program: "پروگرام",
    required: "ضروری",
    consent: "میں تصدیق کرتا/کرتی ہوں کہ معلومات درست ہیں اور داخلہ درخواست کے لیے ان کے استعمال کی اجازت دیتا/دیتی ہوں۔",
    submit: "درخواست جمع کریں",
    submitting: "محفوظ طریقے سے جمع ہو رہی ہے…",
    successTitle: "درخواست جمع ہو گئی",
    successBody: "یہ نجی ٹریکنگ معلومات محفوظ رکھیں۔ درخواست کی پیش رفت اور آئندہ اپ ڈیٹس کے لیے اس کی ضرورت ہوگی۔",
    reference: "ٹریکنگ حوالہ",
    secret: "نجی ٹریکنگ کلید",
    trackApplication: "اس درخواست کی پیش رفت دیکھیں",
    newApplication: "ایک اور درخواست جمع کریں",
    error: "درخواست جمع نہیں ہو سکی۔ معلومات چیک کریں اور دوبارہ کوشش کریں۔",
    language: "زبان"
  },
  ar: {
    admissions: "القبول",
    branch: "الفرع",
    session: "العام الدراسي",
    program: "البرنامج",
    required: "مطلوب",
    consent: "أؤكد صحة المعلومات وأوافق على استخدامها لغرض طلب الالتحاق.",
    submit: "إرسال الطلب",
    submitting: "جارٍ الإرسال بأمان…",
    successTitle: "تم إرسال الطلب",
    successBody: "احتفظ بمعلومات التتبع الخاصة هذه. ستُطلب لتتبع الطلب والتحديثات المستقبلية.",
    reference: "مرجع التتبع",
    secret: "مفتاح التتبع الخاص",
    trackApplication: "تتبع هذا الطلب",
    newApplication: "إرسال طلب آخر",
    error: "تعذر إرسال الطلب. تحقق من المعلومات وحاول مرة أخرى.",
    language: "اللغة"
  }
} as const;

function label(labels: LocalizedLabels, locale: PublicAdmissionLocale): string {
  return labels[locale] || labels.en || Object.values(labels)[0] || "";
}

function inputType(type: string): string {
  if (type === "email") return "email";
  if (type === "phone") return "tel";
  if (type === "date") return "date";
  return "text";
}

export function PublicAdmissionForm({
  tenantName,
  branchName,
  tenantSlug,
  locale,
  formLabels,
  sessions,
  programs,
  sections
}: PublicAdmissionFormProps) {
  const text = ui[locale];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const answers = Object.fromEntries(
      sections.flatMap((section) =>
        section.fields.map((field) => [field.key, String(data.get(field.key) ?? "")])
      )
    );

    try {
      const response = await fetch(`/api/public/admissions/${encodeURIComponent(tenantSlug)}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionKey: String(data.get("sessionKey") ?? ""),
          programKey: String(data.get("programKey") ?? ""),
          preferredLocale: locale,
          consent: data.get("consent") === "on",
          answers
        })
      });

      const payload = (await response.json()) as {
        trackingId?: string;
        trackingToken?: string;
        error?: string;
        details?: string[];
      };

      if (!response.ok || !payload.trackingId || !payload.trackingToken) {
        setError(payload.details?.[0] || payload.error || text.error);
        return;
      }

      setResult({ trackingId: payload.trackingId, trackingToken: payload.trackingToken });
      form.reset();
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <main className="public-intake-shell" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
        <section className="public-intake-card public-intake-success" aria-live="polite">
          <div className="public-intake-brand">M</div>
          <p className="public-intake-kicker">{tenantName} · {text.admissions}</p>
          <h1>{text.successTitle}</h1>
          <p>{text.successBody}</p>
          <dl className="tracking-details">
            <div>
              <dt>{text.reference}</dt>
              <dd><code>{result.trackingId}</code></dd>
            </div>
            <div>
              <dt>{text.secret}</dt>
              <dd><code>{result.trackingToken}</code></dd>
            </div>
          </dl>
          <p>
            <a href={`/track?lang=${locale}&ref=${encodeURIComponent(result.trackingId)}`}>
              {text.trackApplication}
            </a>
          </p>
          <button className="public-submit secondary" type="button" onClick={() => setResult(null)}>
            {text.newApplication}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="public-intake-shell" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
      <section className="public-intake-card">
        <header className="public-intake-header">
          <div>
            <div className="public-intake-brand">M</div>
            <p className="public-intake-kicker">{tenantName}</p>
            <h1>{label(formLabels, locale)}</h1>
            <p>{text.branch}: {branchName}</p>
          </div>
          <div className="public-language-switcher" aria-label={text.language}>
            <a aria-current={locale === "en" ? "page" : undefined} href="?lang=en">EN</a>
            <a aria-current={locale === "ur" ? "page" : undefined} href="?lang=ur">اردو</a>
            <a aria-current={locale === "ar" ? "page" : undefined} href="?lang=ar">العربية</a>
          </div>
        </header>

        <form className="public-intake-form" onSubmit={submit}>
          <div className="public-intake-grid">
            <label>
              <span>{text.session}</span>
              <select name="sessionKey" defaultValue={sessions.find((session) => session.isDefault)?.key ?? sessions[0]?.key} required>
                {sessions.map((session) => (
                  <option key={session.key} value={session.key}>
                    {label(session.labels, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{text.program}</span>
              <select name="programKey" defaultValue={programs[0]?.key} required>
                {programs.map((program) => (
                  <option key={program.key} value={program.key}>
                    {label(program.labels, locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {sections.map((section) => (
            <fieldset key={section.key} className="public-intake-section">
              <legend>{label(section.labels, locale)}</legend>
              <div className="public-intake-grid">
                {section.fields.map((field) => (
                  <label key={field.key} className={field.type === "long_text" ? "full-width" : undefined}>
                    <span>
                      {label(field.labels, locale)}
                      {field.required ? <small> · {text.required}</small> : null}
                    </span>
                    {field.type === "long_text" ? (
                      <textarea name={field.key} required={field.required} maxLength={2000} rows={4} />
                    ) : (
                      <input
                        name={field.key}
                        type={inputType(field.type)}
                        required={field.required}
                        maxLength={field.type === "email" ? 320 : field.type === "phone" ? 40 : undefined}
                      />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <label className="public-consent">
            <input name="consent" type="checkbox" required />
            <span>{text.consent}</span>
          </label>

          {error ? <p className="public-intake-error" role="alert">{error}</p> : null}

          <button className="public-submit" type="submit" disabled={busy}>
            {busy ? text.submitting : text.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
