"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StudentStatusCertificateAction({ personId, label }: { personId: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/documents/student-status-certificate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId, requestKey: crypto.randomUUID() })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to issue certificate.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to issue certificate.");
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button className="action-button" type="button" onClick={() => void issue()} disabled={busy}>{busy ? "Issuing…" : label}</button>
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
  </div>;
}
