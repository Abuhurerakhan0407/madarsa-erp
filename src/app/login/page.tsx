"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { safeAuthRedirect } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

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

  function requestedDestination() {
    const requested = new URLSearchParams(window.location.search).get("next");
    return requested ? safeAuthRedirect(requested) : mode === "signup" ? "/onboarding" : "/en";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const next = requestedDestination();
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (signInError) throw signInError;
        continueTo(next);
        return;
      }

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

      setMessage("Account created. Check your email to confirm your address, then continue.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen professional-auth-screen">
      <section className="auth-card professional-auth-card" aria-labelledby="auth-title">
        <aside className="auth-presentation" aria-label="Ilmgaah">
          <div className="auth-brand auth-brand-light">
            <span className="brand-mark" aria-hidden="true">I</span>
            <div>
              <strong>Ilmgaah</strong>
              <span>Institution operations platform</span>
            </div>
          </div>

          <div className="auth-presentation-copy">
            <p className="auth-presentation-kicker">One connected workspace</p>
            <h2>Run the institution without fragmented registers and spreadsheets.</h2>
            <p>
              Admissions, student records, academics, attendance, Qur&apos;an learning,
              campus operations, communication and reporting stay together in one system.
            </p>
          </div>

          <div className="auth-presentation-points" aria-label="Core areas">
            <span>Admissions</span>
            <span>Attendance</span>
            <span>Qur&apos;an</span>
            <span>Academics</span>
            <span>Reports</span>
          </div>
        </aside>

        <div className="auth-form-panel">
          <div className="auth-heading">
            <p className="state-kicker">Secure Ilmgaah access</p>
            <h1 id="auth-title">{mode === "signin" ? "Welcome back" : "Create your institution account"}</h1>
            <p>
              {mode === "signin"
                ? "Sign in to enter your institution workspace."
                : "Create an account. Your institution setup continues next."}
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
        </div>
      </section>
    </main>
  );
}