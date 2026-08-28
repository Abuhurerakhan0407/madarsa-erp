"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { studentNumberingCopy } from "@/lib/configuration/student-numbering-copy";
import {
  studentNumberPreview,
  type StudentNumberResetPeriod
} from "@/lib/configuration/student-numbering";
import type { ConfigurationLocale } from "@/lib/configuration/model";

type Status = "idle" | "working" | "success" | "error";

export function StudentNumberingSetup({
  locale,
  currentPattern
}: {
  locale: ConfigurationLocale;
  currentPattern: string | null;
}) {
  const router = useRouter();
  const copy = studentNumberingCopy[locale];
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [pattern, setPattern] = useState("STU-{BRANCH}-{SESSION}-{SEQ}");
  const [startValue, setStartValue] = useState(1);
  const [padding, setPadding] = useState(5);
  const [resetPeriod, setResetPeriod] = useState<StudentNumberResetPeriod>("session");

  const preview = useMemo(
    () => studentNumberPreview({ pattern, startValue, padding, resetPeriod }),
    [pattern, startValue, padding, resetPeriod]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("working");
    setError("");

    try {
      const response = await fetch("/api/configuration/student-numbering", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pattern, startValue, padding, resetPeriod })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setError(payload.error || copy.error);
        return;
      }

      setStatus("success");
      router.refresh();
    } catch {
      setStatus("error");
      setError(copy.error);
    }
  }

  return (
    <section className="configuration-section" aria-labelledby="student-numbering-title">
      <header className="section-heading">
        <div>
          <p>{copy.kicker}</p>
          <h2 id="student-numbering-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
      </header>

      {currentPattern ? (
        <article className="configuration-detail-card">
          <span>{copy.active}</span>
          <div className="number-preview"><code>{currentPattern}</code></div>
          <p>{copy.safety}</p>
        </article>
      ) : (
        <form className="preset-preview" onSubmit={submit}>
          <div className="preset-preview-grid">
            <section>
              <label className="field-label">
                {copy.pattern}
                <input
                  className="text-field"
                  name="pattern"
                  value={pattern}
                  onChange={(event) => setPattern(event.target.value)}
                  minLength={3}
                  maxLength={160}
                  autoComplete="off"
                  required
                />
              </label>
              <p>{copy.patternHelp}</p>
              <div className="number-preview">
                <small>{copy.preview}</small>
                <code>{preview}</code>
              </div>
            </section>

            <section>
              <label className="field-label">
                {copy.startValue}
                <input
                  className="text-field"
                  name="startValue"
                  type="number"
                  min={1}
                  max={999999999999}
                  step={1}
                  value={startValue}
                  onChange={(event) => setStartValue(Number(event.target.value))}
                  required
                />
              </label>
              <label className="field-label">
                {copy.padding}
                <input
                  className="text-field"
                  name="padding"
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  value={padding}
                  onChange={(event) => setPadding(Number(event.target.value))}
                  required
                />
              </label>
              <label className="field-label">
                {copy.resetPeriod}
                <select
                  className="text-field"
                  name="resetPeriod"
                  value={resetPeriod}
                  onChange={(event) => setResetPeriod(event.target.value as StudentNumberResetPeriod)}
                >
                  <option value="never">{copy.never}</option>
                  <option value="yearly">{copy.yearly}</option>
                  <option value="session">{copy.session}</option>
                </select>
              </label>
            </section>
          </div>

          <p>{copy.safety}</p>
          <button className="action-button action-button-primary" disabled={status === "working"} type="submit">
            {status === "working" ? copy.publishing : copy.publish}
          </button>
          <p aria-live="polite" className={status === "error" ? "form-message form-error" : "form-message"}>
            {status === "success" ? copy.success : status === "error" ? error || copy.error : ""}
          </p>
        </form>
      )}
    </section>
  );
}
