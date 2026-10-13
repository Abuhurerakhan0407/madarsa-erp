"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { SupportedLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { JAMIA_CLIENT } from "@/lib/client-branding";
import {
  getRecoveryErrorMessage,
  isValidEmail,
  recoveryCopy
} from "@/lib/auth/password-recovery";

function persistLocale(locale: SupportedLocale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ur" ? "rtl" : "ltr";
}

export function ForgotPasswordForm({ initialLocale }: { initialLocale: SupportedLocale }) {
  const supabase = useState(() => createClient())[0];
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const text = recoveryCopy[locale];

  function selectLocale(nextLocale: SupportedLocale) {
    if (nextLocale === locale || busy) return;
    setLocale(nextLocale);
    setEmailError(null);
    setError(null);
    persistLocale(nextLocale);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!isValidEmail(email)) {
      setEmailError(text.emailRequired);
      return;
    }

    setBusy(true);
    setError(null);
    setEmailError(null);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: redirectUrl }
      );

      if (resetError) {
        throw resetError;
      }

      setSubmitted(true);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : text.genericError;
      setError(getRecoveryErrorMessage(message, locale));
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
            {["Talaba", "Attendance", "Hifz", "Hostel", "Guardian Portal"].map((area) => (
              <span key={area}>{area}</span>
            ))}
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
            <h1 id="auth-title">{text.forgotTitle}</h1>
            <p>{text.forgotBody}</p>
          </div>

          {submitted ? (
            <div className="auth-card-success" role="status">
              <p>{text.forgotSuccess}</p>
              <Link href="/login" className="action-button action-button-primary" style={{ textAlign: "center" }}>
                {text.backToSignIn}
              </Link>
            </div>
          ) : (
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
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "forgot-email-error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (emailError) setEmailError(null);
                  }}
                />
                {emailError ? (
                  <small id="forgot-email-error" className="field-error">{emailError}</small>
                ) : null}
              </label>

              {error ? <p className="form-message form-error" role="alert">{error}</p> : null}

              <button
                className="action-button action-button-primary auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy ? text.forgotSubmitting : text.forgotSubmit}
              </button>
            </form>
          )}

          <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
            <Link href="/login" className="auth-mode-switch" style={{ display: "inline-block" }}>
              {text.backToSignIn}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
