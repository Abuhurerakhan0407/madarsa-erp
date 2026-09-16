"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { admissionProgramTypes } from "@/lib/admissions/foundation";
import { admissionsFoundationCopy } from "@/lib/admissions/foundation-copy";
import type { ConfigurationLocale } from "@/lib/configuration/model";

type Status = "idle" | "working" | "success" | "error";

export function AdmissionsFoundationSetup({ locale }: { locale: ConfigurationLocale }) {
  const router = useRouter();
  const copy = admissionsFoundationCopy[locale];
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("working");
    setError("");

    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();

    try {
      const response = await fetch("/api/admissions/foundation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionKey: value("sessionKey"),
          sessionLabels: {
            en: value("sessionEn"),
            ur: value("sessionUr")
          },
          startsOn: value("startsOn"),
          endsOn: value("endsOn"),
          programKey: value("programKey"),
          programLabels: {
            en: value("programEn"),
            ur: value("programUr")
          },
          programType: value("programType")
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || copy.error);
        setStatus("error");
        return;
      }

      setStatus("success");
      router.refresh();
    } catch {
      setError(copy.error);
      setStatus("error");
    }
  }

  return (
    <section className="configuration-section" aria-labelledby="admissions-foundation-title">
      <header className="section-heading">
        <div>
          <p>{copy.kicker}</p>
          <h2 id="admissions-foundation-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
      </header>

      <form className="preset-preview" onSubmit={submit}>
        <div className="preset-preview-grid">
          <fieldset className="configuration-detail-card">
            <legend>{copy.session}</legend>
            <label className="field-label">
              {copy.sessionKey}
              <input className="text-field" name="sessionKey" pattern="[a-z0-9][a-z0-9_-]{1,63}" required placeholder="2026_27" />
            </label>
            <label className="field-label">
              {copy.sessionEn}
              <input className="text-field" name="sessionEn" maxLength={120} required />
            </label>
            <label className="field-label">
              {copy.sessionUr}
              <input className="text-field" name="sessionUr" maxLength={120} required dir="rtl" />
            </label>
            <label className="field-label">
              {copy.startsOn}
              <input className="text-field" name="startsOn" type="date" required />
            </label>
            <label className="field-label">
              {copy.endsOn}
              <input className="text-field" name="endsOn" type="date" required />
            </label>
          </fieldset>

          <fieldset className="configuration-detail-card">
            <legend>{copy.program}</legend>
            <label className="field-label">
              {copy.programKey}
              <input className="text-field" name="programKey" pattern="[a-z][a-z0-9_]{1,63}" required placeholder="dars_e_nizami" />
            </label>
            <label className="field-label">
              {copy.programEn}
              <input className="text-field" name="programEn" maxLength={120} required />
            </label>
            <label className="field-label">
              {copy.programUr}
              <input className="text-field" name="programUr" maxLength={120} required dir="rtl" />
            </label>
            <label className="field-label">
              {copy.programType}
              <select className="text-field" name="programType" defaultValue="" required>
                <option value="" disabled>{copy.chooseType}</option>
                {admissionProgramTypes.map((type) => (
                  <option key={type} value={type}>{copy.types[type]}</option>
                ))}
              </select>
            </label>
          </fieldset>
        </div>

        <p>{copy.disclosure}</p>
        <button className="action-button action-button-primary" disabled={status === "working"} type="submit">
          {status === "working" ? copy.working : copy.submit}
        </button>
        <p aria-live="polite">
          {status === "success" ? copy.success : status === "error" ? error || copy.error : ""}
        </p>
      </form>
    </section>
  );
}
