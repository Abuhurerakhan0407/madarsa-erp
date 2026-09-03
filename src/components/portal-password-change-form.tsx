"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function PortalPasswordChangeForm() {
  const router = useRouter();
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
      setError("Passwords do not match.");
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
        setError(payload.error || "Unable to change password.");
        return;
      }
      form.reset();
      router.replace("/portal");
      router.refresh();
    } catch {
      setError("Unable to change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flow-stack" onSubmit={submit}>
      <label>
        <span>New password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <label>
        <span>Confirm new password</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <p>Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      <button className="action-button action-button-primary" type="submit" disabled={busy}>
        {busy ? "Changing password…" : "Set new password"}
      </button>
    </form>
  );
}
