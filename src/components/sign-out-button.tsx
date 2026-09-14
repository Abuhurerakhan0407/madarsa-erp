"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UiLocale = "en" | "ur";

const copy = {
  en: {
    signOut: "Sign out",
    signingOut: "Signing out…",
    error: "Unable to sign out. Please try again."
  },
  ur: {
    signOut: "سائن آؤٹ",
    signingOut: "سائن آؤٹ ہو رہا ہے…",
    error: "سائن آؤٹ نہیں ہو سکا۔ دوبارہ کوشش کریں۔"
  }
} as const;

export function SignOutButton({
  label,
  initials,
  title,
  locale
}: {
  label: string;
  initials: string;
  title: string;
  locale: UiLocale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = copy[locale];

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(text.error);
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="user-button"
        aria-label={`${label}: ${title}. ${busy ? text.signingOut : text.signOut}`}
        aria-busy={busy || undefined}
        title={`${title} — ${busy ? text.signingOut : text.signOut}`}
        onClick={signOut}
        disabled={busy}
      >
        {busy ? <span className="inline-spinner" aria-hidden="true" /> : initials}
      </button>
      {error ? <span className="form-message form-error" role="alert">{error}</span> : null}
    </>
  );
}
