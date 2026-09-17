"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const copy = {
  en: {
    account: "Your account",
    authenticated: "Authenticated owner account",
    name: "Your name",
    institution: "Institution",
    institutionBody: "Create the isolated institution that will own your data.",
    institutionName: "Institution name",
    slug: "Institution URL key",
    slugHint: "Lowercase letters, numbers, and hyphens.",
    branch: "First branch",
    branchBody: "You can add more branches after setup.",
    branchName: "Branch name",
    branchCode: "Branch code",
    together: "Your institution, owner membership, branch and owner permissions are created together.",
    creating: "Creating secure workspace…",
    create: "Create institution workspace",
    error: "Institution setup failed.",
    defaultBranch: "Main Branch"
  },
  ur: {
    account: "آپ کا اکاؤنٹ",
    authenticated: "تصدیق شدہ مالک اکاؤنٹ",
    name: "آپ کا نام",
    institution: "ادارہ",
    institutionBody: "اپنے ادارے کے ڈیٹا کے لیے الگ اور محفوظ ادارہ بنائیں۔",
    institutionName: "ادارے کا نام",
    slug: "ادارے کی URL کلید",
    slugHint: "صرف چھوٹے انگریزی حروف، اعداد اور ہائفن استعمال کریں۔",
    branch: "پہلی برانچ",
    branchBody: "سیٹ اپ کے بعد مزید برانچز شامل کی جا سکتی ہیں۔",
    branchName: "برانچ کا نام",
    branchCode: "برانچ کوڈ",
    together: "ادارہ، مالک ممبرشپ، برانچ اور مالک کی اجازتیں ایک ساتھ بنائی جائیں گی۔",
    creating: "محفوظ ورک اسپیس بن رہی ہے…",
    create: "ادارہ ورک اسپیس بنائیں",
    error: "ادارہ سیٹ اپ مکمل نہیں ہو سکا۔",
    defaultBranch: "مرکزی برانچ"
  }
} as const;

export function OnboardingForm({ email, locale }: { email?: string; locale: SupportedLocale }) {
  const router = useRouter();
  const t = copy[locale];
  const [displayName, setDisplayName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [branchName, setBranchName] = useState(t.defaultBranch);
  const [branchCode, setBranchCode] = useState("MAIN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, institutionName, slug, branchName, branchCode })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || t.error);
      router.push(`/${locale}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="onboarding-form" onSubmit={submit}>
      <div className="onboarding-section">
        <div>
          <span className="onboarding-step">01</span>
          <h2>{t.account}</h2>
          <p>{email || t.authenticated}</p>
        </div>
        <label className="field-label">
          {t.name}
          <input className="text-field" autoComplete="name" minLength={2} maxLength={160} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
      </div>

      <div className="onboarding-section">
        <div>
          <span className="onboarding-step">02</span>
          <h2>{t.institution}</h2>
          <p>{t.institutionBody}</p>
        </div>
        <div className="onboarding-fields">
          <label className="field-label">
            {t.institutionName}
            <input
              className="text-field"
              minLength={2}
              maxLength={160}
              required
              value={institutionName}
              onChange={(event) => {
                const value = event.target.value;
                setInstitutionName(value);
                if (!slugEdited) setSlug(slugify(value));
              }}
            />
          </label>
          <label className="field-label">
            {t.slug}
            <input
              className="text-field"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugify(event.target.value));
              }}
            />
            <small>{t.slugHint}</small>
          </label>
        </div>
      </div>

      <div className="onboarding-section">
        <div>
          <span className="onboarding-step">03</span>
          <h2>{t.branch}</h2>
          <p>{t.branchBody}</p>
        </div>
        <div className="onboarding-fields">
          <label className="field-label">
            {t.branchName}
            <input className="text-field" minLength={2} maxLength={160} required value={branchName} onChange={(event) => setBranchName(event.target.value)} />
          </label>
          <label className="field-label">
            {t.branchCode}
            <input className="text-field" pattern="[A-Z0-9][A-Z0-9_-]{0,31}" required value={branchCode} onChange={(event) => setBranchCode(event.target.value.toUpperCase())} />
          </label>
        </div>
      </div>

      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      <div className="onboarding-actions">
        <p>{t.together}</p>
        <button className="action-button action-button-primary" type="submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? t.creating : t.create}
        </button>
      </div>
    </form>
  );
}
