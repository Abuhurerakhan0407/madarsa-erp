"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { portalHref } from "@/lib/portal/locale";

const copy = {
  en: {
    password: "New password",
    confirm: "Confirm new password",
    show: "Show password",
    rule: "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.",
    mismatch: "Passwords do not match.",
    error: "Unable to change password.",
    changing: "Changing password…",
    submit: "Set new password"
  },
  ur: {
    password: "نیا پاس ورڈ",
    confirm: "نئے پاس ورڈ کی تصدیق",
    show: "پاس ورڈ دکھائیں",
    rule: "کم از کم 12 حروف، بڑے اور چھوٹے حروف، عدد اور علامت استعمال کریں۔",
    mismatch: "دونوں پاس ورڈ ایک جیسے نہیں ہیں۔",

    error: "پاس ورڈ تبدیل نہیں ہو سکا۔",
    changing: "پاس ورڈ تبدیل ہو رہا ہے…",
    submit: "نیا پاس ورڈ مقرر کریں"
  }
} as const;

export function PortalPasswordChangeForm({
  locale,
  tenant
}: {
  locale: SupportedLocale;
  tenant?: string;
}) {
  const router = useRouter();
  const t = copy[locale];
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);

    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError(t.mismatch);
      return;
    }

    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/password/change", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error || t.error);
        return;
      }

      form.reset();
      router.replace(portalHref("/portal", locale, { tenant }));
      router.refresh();
    } catch {
      setError(t.error);

    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="flow-stack portal-password-form" onSubmit={submit}>
      <label className="field-label">
        {t.password}
        <input
          className="text-field"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={busy}
        />
      </label>
      <label className="field-label">
        {t.confirm}
        <input
          className="text-field"
          name="confirmPassword"
          type={show ? "text" : "password"}

          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={busy}
        />
      </label>
      <label className="portal-password-toggle">
        <input
          type="checkbox"
          checked={show}
          onChange={(event) => setShow(event.target.checked)}
          disabled={busy}
        />
        <span>{t.show}</span>
      </label>
      <p className="portal-password-rule">{t.rule}</p>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      <button className="action-button action-button-primary" type="submit" disabled={busy}>
        {busy ? t.changing : t.submit}
      </button>
    </form>
  );
}
