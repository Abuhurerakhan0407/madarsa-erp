"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";

const copy = {
  en: {
    account: "Your account",
    accountFallback: "Authenticated owner account",
    yourName: "Your name",
    institution: "Institution",
    institutionBody: "Create the isolated workspace that will own your institution data.",
    institutionName: "Institution name",
    slug: "Institution URL key",
    slugHelp: "Lowercase letters, numbers, and hyphens.",
    branch: "First branch",
    branchBody: "You can add more branches after setup.",
    branchName: "Branch name",
    branchCode: "Branch code",
    security: "Your institution workspace, owner membership, branch, and owner permissions are created together.",
    submit: "Create institution workspace",
    submitting: "Creating secure workspace…",
    failed: "Institution setup could not be completed. Check the details and try again.",
    defaultBranch: "Main Branch"
  },
  ur: {
    account: "آپ کا اکاؤنٹ",
    accountFallback: "تصدیق شدہ مالک اکاؤنٹ",
    yourName: "آپ کا نام",
    institution: "ادارہ",
    institutionBody: "اپنے ادارے کے ڈیٹا کے لیے الگ اور محفوظ ورک اسپیس بنائیں۔",
    institutionName: "ادارے کا نام",
    slug: "ادارے کا URL کلید",
    slugHelp: "صرف چھوٹے انگریزی حروف، اعداد اور ہائفن استعمال کریں۔",
    branch: "پہلی برانچ",
    branchBody: "سیٹ اپ کے بعد مزید برانچز شامل کی جا سکتی ہیں۔",
    branchName: "برانچ کا نام",
    branchCode: "برانچ کوڈ",
    security: "آپ کا ادارہ ورک اسپیس، مالک رکنیت، برانچ اور مالک کی اجازتیں ایک ساتھ بنائی جاتی ہیں۔",
    submit: "ادارہ ورک اسپیس بنائیں",
    submitting: "محفوظ ورک اسپیس بن رہا ہے…",
    failed: "ادارے کا سیٹ اپ مکمل نہیں ہو سکا۔ معلومات چیک کر کے دوبارہ کوشش کریں۔",
    defaultBranch: "مرکزی برانچ"
  }
} as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function OnboardingForm({ email, locale }: { email?: string; locale: SupportedLocale }) {
  const router = useRouter();
  const text = copy[locale];
  const [displayName, setDisplayName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [branchName, setBranchName] = useState(text.defaultBranch);
  const [branchCode, setBranchCode] = useState("MAIN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    let navigating = false;

    try {
      const response = await fetch("/api/onboarding/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          institutionName,
          slug,
          branchName,
          branchCode
        })
      });

      if (!response.ok) {
        throw new Error("onboarding_failed");
      }

      navigating = true;
      router.push(`/${locale}`);
      router.refresh();
    } catch {
      setError(text.failed);
    } finally {
      if (!navigating) setBusy(false);
    }
  }

  return (
    <form className="onboarding-form" onSubmit={submit} aria-busy={busy || undefined}>
      <div className="onboarding-section">
        <div>
          <span className="onboarding-step">01</span>
          <h2>{text.account}</h2>
          <p>{email || text.accountFallback}</p>
        </div>
        <label className="field-label">
          {text.yourName}
          <input
            className="text-field"
            autoComplete="name"
            minLength={2}
            maxLength={160}
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={busy}
          />
        </label>
      </div>

      <div className="onboarding-section">
        <div>
          <span className="onboarding-step">02</span>
          <h2>{text.institution}</h2>
          <p>{text.institutionBody}</p>
        </div>
        <div className="onboarding-fields">
          <label className="field-label">
            {text.institutionName}
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
              disabled={busy}
            />
          </label>
          <label className="field-label">
            {text.slug}
            <input
              className="text-field"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugify(event.target.value));
              }}
              disabled={busy}
            />
            <small>{text.slugHelp}</small>
          </label>
        </div>
      </div>

      <div className="onboarding-section">
        <div>
          <span className="onboarding-step">03</span>
          <h2>{text.branch}</h2>
          <p>{text.branchBody}</p>
        </div>
        <div className="onboarding-fields">
          <label className="field-label">
            {text.branchName}
            <input
              className="text-field"
              minLength={2}
              maxLength={160}
              required
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field-label">
            {text.branchCode}
            <input
              className="text-field"
              pattern="[A-Z0-9][A-Z0-9_-]{0,31}"
              required
              value={branchCode}
              onChange={(event) => setBranchCode(event.target.value.toUpperCase())}
              disabled={busy}
            />
          </label>
        </div>
      </div>

      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}

      <div className="onboarding-actions">
        <p>{text.security}</p>
        <button className="action-button action-button-primary" type="submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? <><span className="inline-spinner" aria-hidden="true" /><span>{text.submitting}</span></> : text.submit}
        </button>
      </div>
    </form>
  );
}
