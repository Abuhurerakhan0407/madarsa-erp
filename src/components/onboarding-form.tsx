"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function OnboardingForm({ email }: { email?: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [branchName, setBranchName] = useState("Main Branch");
  const [branchCode, setBranchCode] = useState("MAIN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          institutionName,
          slug,
          branchName,
          branchCode
        })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Institution setup failed.");
      }

      router.push("/en");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Institution setup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="onboarding-form" onSubmit={submit}>
      <div className="onboarding-section">
        <div>
          <span className="onboarding-step">01</span>
          <h2>Your account</h2>
          <p>{email || "Authenticated owner account"}</p>
        </div>
        <label className="field-label">
          Your name
          <input
            className="text-field"
            autoComplete="name"
            minLength={2}
            maxLength={160}
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
      </div>

      <div className="onboarding-section">
        <div>
          <span className="onboarding-step">02</span>
          <h2>Institution</h2>
          <p>Create the isolated tenant that will own your institution data.</p>
        </div>
        <div className="onboarding-fields">
          <label className="field-label">
            Institution name
            <input
              className="text-field"
              minLength={2}
              maxLength={160}
              required
              value={institutionName}
              onChange={(event) => {
                const value = event.target.value;
                setInstitutionName(value);
                if (!slugEdited) setSlug(slugify(value));
              }}
            />
          </label>
          <label className="field-label">
            Institution URL key
            <input
              className="text-field"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugify(event.target.value));
              }}
            />
            <small>Lowercase letters, numbers, and hyphens.</small>
          </label>
        </div>
      </div>

      <div className="onboarding-section">
        <div>
          <span className="onboarding-step">03</span>
          <h2>First branch</h2>
          <p>You can add more branches after setup.</p>
        </div>
        <div className="onboarding-fields">
          <label className="field-label">
            Branch name
            <input
              className="text-field"
              minLength={2}
              maxLength={160}
              required
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
            />
          </label>
          <label className="field-label">
            Branch code
            <input
              className="text-field"
              pattern="[A-Z0-9][A-Z0-9_-]{0,31}"
              required
              value={branchCode}
              onChange={(event) => setBranchCode(event.target.value.toUpperCase())}
            />
          </label>
        </div>
      </div>

      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}

      <div className="onboarding-actions">
        <p>Your tenant, owner membership, branch, and owner permissions are created together.</p>
        <button className="action-button action-button-primary" type="submit" disabled={busy}>
          {busy ? "Creating secure workspace…" : "Create institution workspace"}
        </button>
      </div>
    </form>
  );
}
