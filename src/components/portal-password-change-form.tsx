"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { portalHref } from "@/lib/portal/locale";

const copy = {
  en: {
    newPassword: "New password",
    confirm: "Confirm new password",
    rule: "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.",
    mismatch: "Passwords do not match.",
    error: "Unable to change password.",
    changing: "Changing password…",
    submit: "Set new password"
  },
  ur: {
    newPassword: "نیا پاس ورڈ",
    confirm: "نئے پاس ورڈ کی تصدیق",
    rule: "کم از کم 12 حروف استعمال کریں، جن میں بڑا حرف، چھوٹا حرف، نمبر اور علامت شامل ہو۔",
    mismatch: "پاس ورڈ ایک جیسے نہیں ہیں۔",
    error: "پاس ورڈ تبدیل نہیں ہو سکا۔",
    changing: "پاس ورڈ تبدیل ہو رہا ہے…",
    submit: "نیا پاس ورڈ محفوظ کریں"
  }
} as const;

export function PortalPasswordChangeForm({
  locale,
  tenantId
}: {
  locale: SupportedLocale;
  tenantId?: string;
}) {
  const router = useRouter();
  const t = copy[locale];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || t.error);
        return;
      }
      form.reset();
      router.replace(portalHref("/portal", locale, { tenant: tenantId }));
      router.refresh();
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flow-stack" onSubmit={submit}>
      <label>
        <span>{t.newPassword}</span>
        <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
      </label>
      <label>
        <span>{t.confirm}</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
      </label>
      <p>{t.rule}</p>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      <button className="action-button action-button-primary" type="submit" disabled={busy} aria-busy={busy || undefined}>
        {busy ? t.changing : t.submit}
      </button>
    </form>
  );
}
