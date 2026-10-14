"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { JAMIA_CLIENT } from "@/lib/client-branding";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  getRecoveryErrorMessage,
  isValidPassword,
  recoveryCopy
} from "@/lib/auth/password-recovery";

type SessionState = "checking" | "authenticated" | "invalid_or_expired";

function persistLocale(locale: SupportedLocale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ur" ? "rtl" : "ltr";
}

export function ResetPasswordForm({ initialLocale }: { initialLocale: SupportedLocale }) {
  const router = useRouter();
  const supabase = useState(() => createClient())[0];
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const text = recoveryCopy[locale];

  useEffect(() => {
    let active = true;

    async function evaluateSession() {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error") || params.get("error_code");

      if (errorParam) {
        if (active) setSessionState("invalid_or_expired");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;

        if (session) {
          setSessionState("authenticated");
        } else {
          setSessionState("invalid_or_expired");
        }
      } catch {
        if (active) setSessionState("invalid_or_expired");
      }
    }

    evaluateSession();
    return () => {
      active = false;
    };
  }, [supabase]);

  function selectLocale(nextLocale: SupportedLocale) {
    if (nextLocale === locale || busy) return;
    setLocale(nextLocale);
    setFieldErrors({});
    setError(null);
    persistLocale(nextLocale);
  }

  function validate(): boolean {
    const nextErrors: { password?: string; confirm?: string } = {};

    if (!isValidPassword(password)) {
      nextErrors.password = text.passwordRequirements;
    }

    if (password !== confirmPassword) {
      nextErrors.confirm = text.passwordsMismatch;
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !validate()) return;

    setBusy(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password
      });

      if (updateError) {
        throw updateError;
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
            <h1 id="auth-title">
              {sessionState === "invalid_or_expired"
                ? text.linkExpiredTitle
                : text.resetTitle}
            </h1>
            <p>
              {sessionState === "invalid_or_expired"
                ? text.linkExpiredBody
                : text.resetBody}
            </p>
          </div>

          {sessionState === "checking" ? (
            <p className="field-label" style={{ textAlign: "center", padding: "2rem 0" }}>
              …
            </p>
          ) : sessionState === "invalid_or_expired" ? (
            <div style={{ display: "grid", gap: "1rem" }}>
              <Link
                href="/forgot-password"
                className="action-button action-button-primary"
                style={{ textAlign: "center" }}
              >
                {text.requestNewLink}
              </Link>
              <Link
                href="/login"
                className="auth-mode-switch"
                style={{ textAlign: "center", display: "inline-block" }}
              >
                {text.backToSignIn}
              </Link>
            </div>
          ) : submitted ? (
            <div className="auth-card-success" role="status">
              <p>{text.resetSuccess}</p>
              <button
                type="button"
                className="action-button action-button-primary"
                onClick={() => {
                  router.replace(`/${locale}`);
                  router.refresh();
                }}
              >
                {text.continueToApp}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate aria-busy={busy || undefined}>
              <label className="field-label">
                {text.newPassword}
                <input
                  className="text-field"
                  type="password"
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  value={password}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "reset-password-error" : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((current) => ({ ...current, password: undefined }));
                    }
                  }}
                />
                {fieldErrors.password ? (
                  <small id="reset-password-error" className="field-error">{fieldErrors.password}</small>
                ) : null}
              </label>

              <label className="field-label">
                {text.confirmPassword}
                <input
                  className="text-field"
                  type="password"
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  value={confirmPassword}
                  aria-invalid={Boolean(fieldErrors.confirm)}
                  aria-describedby={fieldErrors.confirm ? "reset-confirm-error" : undefined}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (fieldErrors.confirm) {
                      setFieldErrors((current) => ({ ...current, confirm: undefined }));
                    }
                  }}
                />
                {fieldErrors.confirm ? (
                  <small id="reset-confirm-error" className="field-error">{fieldErrors.confirm}</small>
                ) : null}
              </label>

              {error ? <p className="form-message form-error" role="alert">{error}</p> : null}

              <button
                className="action-button action-button-primary auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy ? text.resetSubmitting : text.resetSubmit}
              </button>
            </form>
          )}

          {sessionState === "authenticated" && !submitted ? (
            <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
              <Link href="/login" className="auth-mode-switch" style={{ display: "inline-block" }}>
                {text.backToSignIn}
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
