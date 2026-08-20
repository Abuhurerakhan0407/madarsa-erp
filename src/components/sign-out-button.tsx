"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  label,
  initials,
  title
}: {
  label: string;
  initials: string;
  title: string;
}) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <button
      type="button"
      className="user-button"
      aria-label={`${label}: ${title}`}
      title={`${title} — Sign out`}
      onClick={signOut}
      disabled={busy}
    >
      {busy ? "…" : initials}
    </button>
  );
}
