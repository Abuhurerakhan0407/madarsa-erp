"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { safeAuthRedirect } from "@/lib/auth/redirects";
import type { SupportedLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { JAMIA_CLIENT } from "@/lib/client-branding";

type Mode = "signin" | "signup";
type FieldErrors = { email?: string; password?: string };

const copy = {
  en: {
    productLine: "Hifz • Arabic • Residential Hostel",
    connected: "One calm workspace for the madrasa",
    presentationTitle: "Jamia Islamia Uloomul Quraan",
    presentationBody:
      "Admissions, Talaba, attendance, Hifz, Ustadhs, hostel and Guardian Portal in one clear workspace.",
    areas: ["Talaba", "Attendance", "Hifz", "Hostel", "Guardian Portal"],
    secure: "Secure Jamia access",
    signInTitle: "Welcome back",
    signUpTitle: "Create your institution account",
    signInBody: "Sign in to continue to the Jamia workspace.",
    signUpBody: "Create an account. Institution setup continues after sign in.",
    email: "Email address",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    create: "Create account",
    creating: "Creating account…",
    newInstitution: "New institution? Create an account",
    existing: "Already have an account? Sign in",
    emailRequired: "Enter a valid email address.",
    passwordRequired: "Use 12–128 characters with uppercase, lowercase, number, and symbol.",
    invalidCredentials: "Email or password is incorrect.",
    forgotPassword: "Forgot password?",
    rateLimited: "Too many attempts. Please wait a moment and try again.",
    genericError: "Unable to sign in. Please try again.",
    language: "Language"
  },
  ur: {
    productLine: "حفظ • عربی • رہائشی ہاسٹل",
    connected: "مدرسے کے لیے ایک سادہ ورک اسپیس",
    presentationTitle: "جامعہ اسلامیہ علوم القرآن",
    presentationBody:
      "داخلہ، طلبہ، حاضری، حفظ، اساتذہ، ہاسٹل اور گارڈین پورٹل ایک ہی واضح ورک اسپیس میں۔",
    areas: ["طلبہ", "حاضری", "حفظ", "ہاسٹل", "گارڈین پورٹل"],
    secure: "جامعہ کی محفوظ رسائی",
    signInTitle: "خوش آمدید",
    signUpTitle: "ادارے کا اکاؤنٹ بنائیں",
    signInBody: "جامعہ کے ورک اسپیس میں جانے کے لیے سائن اِن کریں۔",
    signUpBody: "اکاؤنٹ بنائیں۔ سائن اِن کے بعد ادارے کا سیٹ اپ جاری رہے گا۔",
    email: "ای میل",
    password: "پاس ورڈ",
    signIn: "سائن اِن",
    signingIn: "سائن اِن ہو رہا ہے…",
    create: "اکاؤنٹ بنائیں",
    creating: "اکاؤنٹ بن رہا ہے…",
    newInstitution: "نیا ادارہ؟ اکاؤنٹ بنائیں",
    existing: "اکاؤنٹ موجود ہے؟ سائن اِن کریں",
    emailRequired: "درست ای میل درج کریں۔",
    passwordRequired: "پاس ورڈ 12 سے 128 حروف کا ہو اور اس میں بڑا حرف، چھوٹا حرف، نمبر اور علامت شامل ہو۔",
    invalidCredentials: "ای میل یا پاس ورڈ درست نہیں۔",
    forgotPassword: "پاس ورڈ بھول گئے؟",
    rateLimited: "بہت زیادہ کوششیں ہوئیں۔ کچھ دیر بعد دوبارہ کوشش کریں۔",
    genericError: "سائن اِن نہیں ہو سکا۔ دوبارہ کوشش کریں۔",
    language: "زبان"
  }
} as const;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function authErrorMessage(message: string, locale: SupportedLocale) {
  const text = copy[locale];
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return text.invalidCredentials;
  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("email rate")
  ) {
    return text.rateLimited;
  }
  return message.trim() || text.genericError;
}

function persistLocale(locale: SupportedLocale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ur" ? "rtl" : "ltr";
}

export function LoginForm({ initialLocale }: { initialLocale: SupportedLocale }) {
  const router = useRouter();
  const supabase = useState(() => createClient())[0];
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const text = copy[locale];

  function continueTo(path: string) {
    router.replace(path);
    router.refresh();
  }

  function requestedDestination() {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("next");
    if (requested) return safeAuthRedirect(requested);
    if (mode === "signup") return "/onboarding";
    if (params.get("source") === "app") return "/app-entry";
    return `/${locale}`;
  }

  function selectLocale(nextLocale: SupportedLocale) {
    if (nextLocale === locale || busy) return;
    setLocale(nextLocale);
    setFieldErrors({});
    setError(null);
    persistLocale(nextLocale);
  }

  function validate(): boolean {
    const nextErrors: FieldErrors = {};
    if (!isValidEmail(email.trim())) nextErrors.email = text.emailRequired;
    if (mode === "signup" ? !(password.length >= 12 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) : password.length < 8) nextErrors.password = text.passwordRequired;
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !validate()) return;

    setBusy(true);
    setError(null);

    try {
      const next = requestedDestination();
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (signInError) throw signInError;
        continueTo(next);
        return;
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? text.genericError);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (signInError) throw signInError;
      continueTo(next);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : text.genericError;
      setError(authErrorMessage(message, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen professional-auth-screen client-jamia-auth">
      <section className="auth-card professional-auth-card" aria-labelledby="auth-title">
        <aside className="auth-presentation" aria-label="Ilmgaah">
          <div className="auth-brand auth-brand-light jamia-auth-brand">
            <span className="brand-mark jamia-brand-mark" aria-hidden="true">ج</span>
            <div>
              <strong>{locale === "ur" ? JAMIA_CLIENT.shortNameUr : JAMIA_CLIENT.shortName}</strong>
              <span>{text.productLine}</span>
            </div>
          </div>

          <div className="auth-presentation-copy">
            <p className="auth-presentation-kicker">{text.connected}</p>
            <h2>{text.presentationTitle}</h2>
            <p>{text.presentationBody}</p>
          </div>

          <div className="auth-presentation-points" aria-label="Core areas">
            {text.areas.map((area) => <span key={area}>{area}</span>)}
          </div>
          <div className="jamia-auth-meta">
            <span>{JAMIA_CLIENT.director}</span>
            <a href="tel:9450825657">{JAMIA_CLIENT.phone}</a>
          </div>
        </aside>

        <div className="auth-form-panel">
          <div className="auth-login-language" aria-label={text.language}>
            <button
              type="button"
              className="auth-language-button"
              aria-pressed={locale === "en"}
              disabled={busy}
              onClick={() => selectLocale("en")}
            >
              English
            </button>
            <button
              type="button"
              className="auth-language-button"
              aria-pressed={locale === "ur"}
              disabled={busy}
              onClick={() => selectLocale("ur")}
            >
              اردو
            </button>
          </div>

          <div className="auth-heading">
            <p className="state-kicker">{text.secure}</p>
            <h1 id="auth-title">{mode === "signin" ? text.signInTitle : text.signUpTitle}</h1>
            <p>{mode === "signin" ? text.signInBody : text.signUpBody}</p>
          </div>

          <form onSubmit={submit} noValidate aria-busy={busy || undefined}>
            <label className="field-label">
              {text.email}
              <input
                className="text-field"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                required
                value={email}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
                }}
              />
              {fieldErrors.email ? (
                <small id="login-email-error" className="field-error">{fieldErrors.email}</small>
              ) : null}
            </label>

            <label className="field-label">
              {text.password}
              <input
                className="text-field"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? 12 : 8}
                required
                value={password}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }
                }}
              />
              {fieldErrors.password ? (
                <small id="login-password-error" className="field-error">{fieldErrors.password}</small>
              ) : null}
            </label>

            {mode === "signin" ? (
              <div className="auth-forgot-row">
                <Link href="/forgot-password" className="auth-forgot-link">
                  {text.forgotPassword}
                </Link>
              </div>
            ) : null}

            {error ? <p className="form-message form-error" role="alert">{error}</p> : null}

            <button className="action-button action-button-primary auth-submit" type="submit" disabled={busy}>
              {busy
                ? mode === "signin" ? text.signingIn : text.creating
                : mode === "signin" ? text.signIn : text.create}
            </button>
          </form>

          <button
            className="auth-mode-switch"
            type="button"
            disabled={busy}
            onClick={() => {
              setMode((current) => current === "signin" ? "signup" : "signin");
              setError(null);
              setFieldErrors({});
            }}
          >
            {mode === "signin" ? text.newInstitution : text.existing}
          </button>
        </div>
      </section>
    </main>
  );
}
