"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UiLocale = "en" | "ur";

const copy = {
  en: {
    account: "Account",
    signedInAs: "Signed in as",
    signOut: "Sign out",
    signingOut: "Signing out…",
    error: "Unable to sign out. Please try again."
  },
  ur: {
    account: "اکاؤنٹ",
    signedInAs: "سائن اِن",
    signOut: "سائن آؤٹ",
    signingOut: "سائن آؤٹ ہو رہا ہے…",
    error: "سائن آؤٹ نہیں ہو سکا۔ دوبارہ کوشش کریں۔"
  }
} as const;

export function SignOutButton({
  label,
  initials,
  title,
  locale = "en",
  afterSignOut = "/login"
}: {
  label: string;
  initials: string;
  title: string;
  locale?: UiLocale;
  afterSignOut?: string;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
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
      menuRef.current?.removeAttribute("open");
      document.cookie = "ILMGAAH_LAST_ROUTE=; Path=/; Max-Age=0; SameSite=Lax";
      router.replace(afterSignOut);
      router.refresh();
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="account-menu" ref={menuRef}>
      <summary
        className="user-button"
        aria-label={`${label}: ${title}`}
        title={`${text.account}: ${title}`}
      >
        <span aria-hidden="true">{initials}</span>
      </summary>
      <div className="account-menu-popover">
        <div className="account-menu-identity">
          <span>{text.signedInAs}</span>
          <strong>{title}</strong>
        </div>
        <button
          type="button"
          className="account-menu-signout"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={signOut}
        >
          {busy ? <span className="inline-spinner" aria-hidden="true" /> : null}
          <span>{busy ? text.signingOut : text.signOut}</span>
        </button>
        {error ? <span className="form-message form-error" role="alert">{error}</span> : null}
      </div>
    </details>
  );
}
