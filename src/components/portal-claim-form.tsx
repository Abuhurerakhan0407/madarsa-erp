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
    error: "Unable to activate portal access. Check the code and try again."
  },
  ur: {
    code: "پورٹل رسائی کوڈ",
    activating: "فعال ہو رہا ہے…",
    activate: "پورٹل رسائی فعال کریں",
    error: "پورٹل رسائی فعال نہیں ہو سکی۔ کوڈ چیک کرکے دوبارہ کوشش کریں۔"
  }
} as const;

export function PortalClaimForm({ initialCode, locale }: { initialCode: string; locale: SupportedLocale }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = copy[locale];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error("claim_failed");
      const tenantId = Number(body.tenant_id);
      if (!Number.isInteger(tenantId) || tenantId <= 0) throw new Error("invalid_response");
      router.push(portalHref("/portal", locale, { tenant: tenantId }));
      router.refresh();
    } catch {
      setError(t.error);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flow-form" aria-busy={busy || undefined}>
      <label className="field-label">
        {t.code}
        <input className="text-field" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="MDR-…" required pattern="MDR-[A-F0-9]{18}" autoComplete="one-time-code" disabled={busy} />
      </label>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      <button className="action-button action-button-primary" disabled={busy} aria-busy={busy || undefined}>
        {busy ? <><span className="inline-spinner" aria-hidden="true" /><span>{t.activating}</span></> : t.activate}
      </button>
    </form>
  );
}
