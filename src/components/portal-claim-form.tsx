"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import { portalHref } from "@/lib/portal/locale";

const copy = {
  en: {
    code: "Portal access code",
    activating: "Activating…",
    activate: "Activate portal access",
    invalid: "Unable to claim portal access.",
    invalidAccount: "Portal account response is invalid."
  },
  ur: {
    code: "پورٹل رسائی کوڈ",
    activating: "فعال کیا جا رہا ہے…",
    activate: "پورٹل رسائی فعال کریں",
    invalid: "پورٹل رسائی فعال نہیں ہو سکی۔",
    invalidAccount: "پورٹل اکاؤنٹ کا جواب درست نہیں ہے۔"
  }
} as const;

export function PortalClaimForm({ initialCode, locale }: { initialCode: string; locale: SupportedLocale }) {
  const router = useRouter();
  const t = copy[locale];
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      });
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : t.invalid);
      const tenantId = Number(body.tenant_id);
      if (!Number.isInteger(tenantId) || tenantId <= 0) throw new Error(t.invalidAccount);
      router.push(portalHref("/portal", locale, { tenant: tenantId }));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.invalid);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flow-form">
      <label className="field-label">
        {t.code}
        <input
          className="text-field"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="MDR-…"
          required
          pattern="MDR-[A-F0-9]{18}"
          autoComplete="one-time-code"
          inputMode="text"
        />
      </label>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      <button className="action-button action-button-primary" disabled={busy} aria-busy={busy || undefined}>
        {busy ? t.activating : t.activate}
      </button>
    </form>
  );
}
