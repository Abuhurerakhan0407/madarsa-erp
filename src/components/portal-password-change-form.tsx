"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { portalHref } from "@/lib/portal/locale";

const copy = {
  en: {
    newPassword: "New password",
    confirm: "Confirm new password",
    guidance: "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.",
    mismatch: "Passwords do not match.",
    error: "Unable to change password. Please try again.",
    changing: "Changing password…",
    submit: "Set new password"
  },
  ur: {
    newPassword: "نیا پاس ورڈ",
    confirm: "نئے پاس ورڈ کی تصدیق",
    guidance: "کم از کم 12 حروف استعمال کریں، جن میں بڑے اور چھوٹے انگریزی حروف، ایک نمبر اور ایک علامت شامل ہو۔",
    mismatch: "دونوں پاس ورڈ ایک جیسے نہیں ہیں۔",
    error: "پاس ورڈ تبدیل نہیں ہو سکا۔ دوبارہ کوشش کریں۔",
    changing: "پاس ورڈ تبدیل ہو رہا ہے…",
    submit: "نیا پاس ورڈ مقرر کریں"
  }
} as const;

export function PortalPasswordChangeForm({ locale, tenant }: { locale: SupportedLocale; tenant?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = copy[locale];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError(t.mismatch);
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/portal/password/change", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        setError(t.error);
        return;
      }
      form.reset();
      router.replace(portalHref("/portal", locale, { tenant }));
      router.refresh();
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flow-stack" onSubmit={submit} aria-busy={busy || undefined}>
      <label>
        <span>{t.newPassword}</span>
        <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} />
      </label>
      <label>
        <span>{t.confirm}</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} />
      </label>
      <p>{t.guidance}</p>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      <button className="action-button action-button-primary" type="submit" disabled={busy} aria-busy={busy || undefined}>
        {busy ? <><span className="inline-spinner" aria-hidden="true" /><span>{t.changing}</span></> : t.submit}
      </button>
    </form>
  );
}
