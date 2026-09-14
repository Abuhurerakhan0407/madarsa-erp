"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { localizeAuthDestination } from "@/lib/auth/redirects";
import { getDirection, localeLabels, locales, type SupportedLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";
export type LoginAuthState = "missing_code" | "callback_failed" | null;

const copy = {
  en: {
    brand: "School administration platform",
    kicker: "Secure access",
    welcome: "Welcome back",
    create: "Create your institution account",
    signinBody: "Sign in to continue.",
    createBody: "Create an account. Your institution setup continues next.",
    email: "Email address",
    password: "Password",
    signin: "Sign in",
    signing: "Signing in…",
    createButton: "Create account",
    creating: "Creating account…",
    newAccount: "New institution? Create an account",
    existing: "Already have an account? Sign in",
    confirmed: "Account created. Check your email to confirm your address, then continue.",
    authFailed: "Unable to sign in. Check your email and password, then try again.",
    signupFailed: "Unable to create the account right now. Check the details and try again.",
    missing_code: "The confirmation link is incomplete. Request a fresh confirmation email and try again.",
    callback_failed: "We could not confirm that sign-in link. Request a fresh link and try again.",
    language: "Language"
  },
  ur: {
    brand: "ادارہ انتظامی پلیٹ فارم",
    kicker: "محفوظ رسائی",
    welcome: "خوش آمدید",
    create: "اپنے ادارے کا اکاؤنٹ بنائیں",
    signinBody: "جاری رکھنے کے لیے سائن ان کریں۔",
    createBody: "اکاؤنٹ بنائیں۔ ادارے کی ترتیب اگلے مرحلے میں ہوگی۔",
    email: "ای میل ایڈریس",
    password: "پاس ورڈ",
    signin: "سائن ان",
    signing: "سائن ان ہو رہا ہے…",
    createButton: "اکاؤنٹ بنائیں",
    creating: "اکاؤنٹ بن رہا ہے…",
    newAccount: "نیا ادارہ؟ اکاؤنٹ بنائیں",
    existing: "اکاؤنٹ پہلے سے ہے؟ سائن ان کریں",
    confirmed: "اکاؤنٹ بن گیا۔ ای میل کی تصدیق کے بعد جاری رکھیں۔",
    authFailed: "سائن ان نہیں ہو سکا۔ ای میل اور پاس ورڈ چیک کر کے دوبارہ کوشش کریں۔",
    signupFailed: "اس وقت اکاؤنٹ نہیں بن سکا۔ معلومات چیک کر کے دوبارہ کوشش کریں۔",
    missing_code: "تصدیقی لنک نامکمل ہے۔ نئی تصدیقی ای میل منگوا کر دوبارہ کوشش کریں۔",
    callback_failed: "اس سائن ان لنک کی تصدیق نہیں ہو سکی۔ نیا لنک منگوا کر دوبارہ کوشش کریں۔",
    language: "زبان"
  }
} as const;

export function LoginWorkspace({
  initialLocale,
  nextTarget,
  initialAuthState
}: {
  initialLocale: SupportedLocale;
  nextTarget: string | null;
  initialAuthState: LoginAuthState;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<LoginAuthState>(initialAuthState);
  const t = copy[locale];
  const visibleError = error ?? (authState ? t[authState] : null);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getDirection(locale);
  }, [locale]);

  const destination = () => mode === "signup"
    ? localizeAuthDestination("/onboarding", locale)
    : localizeAuthDestination(nextTarget, locale);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setAuthState(null);
    setMessage(null);
    let navigating = false;

    try {
      const next = destination();
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (authError) throw authError;
        navigating = true;
        router.push(next);
        router.refresh();
        return;
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        }
      });
      if (authError) throw authError;
      if (data.session) {
        navigating = true;
        router.push(next);
        router.refresh();
        return;
      }
      setMessage(t.confirmed);
    } catch {
      setError(mode === "signin" ? t.authFailed : t.signupFailed);
    } finally {
      if (!navigating) setBusy(false);
    }
  }

  const pendingLabel = mode === "signin" ? t.signing : t.creating;

  return (
    <main className="auth-screen professional-auth-screen" lang={locale} dir={getDirection(locale)}>
      <section className="auth-card professional-auth-card" aria-labelledby="auth-title">
        <aside className="auth-presentation" aria-hidden="true">
          <div className="auth-brand auth-brand-light">
            <span className="brand-mark" aria-hidden="true">I</span>
            <div><strong>Ilmgaah</strong><span>{t.brand}</span></div>
          </div>
          <div className="auth-presentation-copy">
            <p className="auth-presentation-kicker">Ilmgaah</p>
            <h2>{mode === "signin" ? t.welcome : t.create}</h2>
            <p>{mode === "signin" ? t.signinBody : t.createBody}</p>
          </div>
        </aside>
        <div className="auth-form-panel">
          <nav className="locale-switcher" aria-label={t.language}>
            {locales.map((language) => (
              <button
                key={language}
                type="button"
                className="locale-link"
                aria-current={language === locale ? "page" : undefined}
                onClick={() => setLocale(language)}
              >
                {localeLabels[language]}
              </button>
            ))}
          </nav>
          <div className="auth-heading">
            <p className="state-kicker">{t.kicker}</p>
            <h1 id="auth-title">{mode === "signin" ? t.welcome : t.create}</h1>
            <p>{mode === "signin" ? t.signinBody : t.createBody}</p>
          </div>
          <form onSubmit={submit} aria-busy={busy || undefined}>
            <label className="field-label">
              {t.email}
              <input className="text-field" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
            </label>
            <label className="field-label">
              {t.password}
              <input className="text-field" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
            </label>
            {visibleError ? <p className="form-message form-error" role="alert">{visibleError}</p> : null}
            {message ? <p className="form-message" role="status">{message}</p> : null}
            <button className="action-button action-button-primary auth-submit" type="submit" disabled={busy} aria-busy={busy || undefined}>
              {busy ? <><span className="inline-spinner" aria-hidden="true" /><span>{pendingLabel}</span></> : mode === "signin" ? t.signin : t.createButton}
            </button>
          </form>
          <button className="auth-mode-switch" type="button" disabled={busy} onClick={() => {
            setMode((value) => value === "signin" ? "signup" : "signin");
            setError(null);
            setAuthState(null);
            setMessage(null);
          }}>
            {mode === "signin" ? t.newAccount : t.existing}
          </button>
        </div>
      </section>
    </main>
  );
}
