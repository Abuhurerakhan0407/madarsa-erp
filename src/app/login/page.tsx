"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

function safeNextPath(): string {
  if (typeof window === "undefined") return "/en";
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/en";
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function continueTo(path: string) {
    router.push(path);
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (signInError) throw signInError;
        continueTo(safeNextPath());
        return;
      }

      const next = "/onboarding";
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        }
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        continueTo(next);
        return;
      }

      setMessage("Account created. Check your email to confirm your address, then continue setup.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">M</span>
          <div>
            <strong>Madarsa ERP</strong>
            <span>Institution operating system</span>
          </div>
        </div>

        <div className="auth-heading">
          <p className="state-kicker">Secure workspace</p>
          <h1 id="auth-title">{mode === "signin" ? "Welcome back" : "Create your institution account"}</h1>
          <p>
            {mode === "signin"
              ? "Sign in to continue to your institution workspace."
              : "Create an owner account. Institution setup comes next."}
          </p>
        </div>

        <form onSubmit={submit}>
          <label className="field-label">
            Email address
            <input
              className="text-field"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field-label">
            Password
            <input
              className="text-field"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
          {message ? <p className="form-message" role="status">{message}</p> : null}

          <button className="action-button action-button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          className="auth-mode-switch"
          type="button"
          onClick={() => {
            setMode((current) => current === "signin" ? "signup" : "signin");
            setError(null);
            setMessage(null);
          }}
        >
          {mode === "signin" ? "New institution? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
