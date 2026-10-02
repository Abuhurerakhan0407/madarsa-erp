"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PortalExitButtonProps = {
  homeHref: string | null;
  loginHref: string;
  homeLabel: string;
  loginLabel: string;
  errorLabel: string;
};

export function PortalExitButton({ homeHref, loginHref, homeLabel, loginLabel, errorLabel }: PortalExitButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leavePortal() {
    if (busy) return;
    setBusy(true);
    setError(null);

    if (homeHref) {
      router.replace(homeHref);
      router.refresh();
      return;
    }

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(errorLabel);
        setBusy(false);
        return;
      }
      router.replace(loginHref);
      router.refresh();
    } catch {
      setError(errorLabel);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="action-button"
        onClick={leavePortal}
        disabled={busy}
        aria-busy={busy || undefined}
      >
        {homeHref ? homeLabel : loginLabel}
      </button>
      {error ? <span className="form-message form-error" role="alert">{error}</span> : null}
    </>
  );
}
