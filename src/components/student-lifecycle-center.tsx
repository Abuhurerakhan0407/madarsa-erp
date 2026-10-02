"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentLifecycleCenter } from "@/lib/students/lifecycle";
import {
  analyzeStudentImportCsv,
  STUDENT_IMPORT_TEMPLATE_CSV,
  type StudentImportAnalysis,
  type StudentImportIssue
} from "@/lib/students/csv-import";

type Copy = {
  csvFile: string;
  template: string;
  templateHint: string;
  placement: string;
  joinedOn: string;
  preview: string;
  importAction: string;
  importing: string;
  valid: string;
  warnings: string;
  invalid: string;
  duplicates: string;
  rows: string;
  row: string;
  student: string;
  guardian: string;
  issue: string;
  status: string;
  validRow: string;
  warningRow: string;
  invalidRow: string;
  noGuardian: string;
  reviewConfirm: string;
  downloadErrors: string;
  summary: string;
  created: string;
  linked: string;
  skipped: string;
  failed: string;
  recent: string;
  none: string;
  chooseCsv: string;
  csvError: string;
  importError: string;
  placementRequired: string;
  invalidRowsBlock: string;
  success: string;
};

type ImportResult = {
  created: number;
  linked: number;
  skipped: number;
  failed: number;
  state: string;
};

const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

function triggerCsv(content: string, filename: string) {
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, 1200);
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed.");
  }
  return payload;
}

function issueText(issues: StudentImportIssue[]) {
  return issues.map((item) => item.message).join(" · ");
}

export function StudentLifecycleCenter({
  data,
  copy
}: {
  data: StudentLifecycleCenter;
  copy: Copy;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const readVersion = useRef(0);
  const activeSession = data.sessions.find((session) => session.status === "active") ?? data.sessions[0] ?? null;
  const currentGroups = useMemo(
    () => data.groups.filter((group) => group.status === "active" && (!activeSession || group.sessionId === activeSession.id)),
    [data.groups, activeSession]
  );
  const importJobs = useMemo(
    () => data.jobs.filter((job) => job.operationType === "import").slice(0, 8),
    [data.jobs]
  );

  const [analysis, setAnalysis] = useState<StudentImportAnalysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [groupId, setGroupId] = useState(currentGroups[0]?.id ?? 0);
  const [joinedOn, setJoinedOn] = useState(activeSession?.startsOn ?? new Date().toISOString().slice(0, 10));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const invalidRows = analysis?.rows.filter((preview) => preview.issues.some((item) => item.severity === "error")).length ?? 0;
  const warningCount = analysis?.issues.filter((item) => item.severity === "warning").length ?? 0;
  const duplicateCount = analysis?.issues.filter((item) => item.code === "duplicate_in_file").length ?? 0;
  const canImport = Boolean(
    analysis
    && analysis.validRows.length > 0
    && invalidRows === 0
    && groupId
    && joinedOn
    && confirmed
    && !busy
  );

  function downloadTemplate() {
    triggerCsv(STUDENT_IMPORT_TEMPLATE_CSV, "ilmgaah-student-import-template.csv");
  }

  function downloadErrors() {
    if (!analysis) return;
    const issues: StudentImportIssue[] = [
      ...analysis.headerWarnings.map((message) => ({
        rowNumber: 1,
        severity: "warning" as const,
        code: "header_warning",
        message
      })),
      ...analysis.issues
    ];
    if (!issues.length) return;
    const rows = [
      ["row_number", "severity", "code", "explanation"].join(","),
      ...issues.map((item) => [
        csvCell(item.rowNumber),
        csvCell(item.severity),
        csvCell(item.code),
        csvCell(item.message)
      ].join(","))
    ];
    triggerCsv(rows.join("\r\n"), "ilmgaah-student-import-errors.csv");
  }

  async function readCsv(file: File | null) {
    const version = ++readVersion.current;
    setMessage(null);
    setResult(null);
    setConfirmed(false);

    if (!file) {
      setFileName("");
      setAnalysis(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileName(file.name);
      setAnalysis(null);
      setMessage({ tone: "error", text: copy.csvError });
      return;
    }

    setFileName(file.name);
    try {
      const text = await file.text();
      if (version !== readVersion.current) return;
      const next = analyzeStudentImportCsv(text);
      setAnalysis(next);
      if (next.issues.some((item) => item.severity === "error")) {
        setMessage({ tone: "error", text: copy.invalidRowsBlock });
      }
    } catch (error) {
      if (version !== readVersion.current) return;
      setAnalysis(null);
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : copy.csvError
      });
    }
  }

  async function runImport() {
    if (!analysis || lock.current || !canImport) return;
    const group = currentGroups.find((item) => item.id === groupId);
    if (!group) {
      setMessage({ tone: "error", text: copy.placementRequired });
      return;
    }

    lock.current = true;
    setBusy(true);
    setMessage(null);
    setResult(null);
    const requestKey = `student-import:${crypto.randomUUID()}`;

    try {
      const payload = await postJson("/api/students/lifecycle/import", {
        sessionId: group.sessionId,
        programId: group.programId,
        groupId: group.id,
        joinedOn,
        rows: analysis.validRows,
        requestKey
      });
      const nextResult: ImportResult = {
        created: Number(payload.succeeded_items ?? 0),
        linked: Number(payload.guardian_linked_items ?? 0),
        skipped: Number(payload.blocked_items ?? 0),
        failed: Number(payload.failed_items ?? 0),
        state: typeof payload.state === "string" ? payload.state : "completed"
      };
      setResult(nextResult);
      setMessage({ tone: "success", text: copy.success });
      setConfirmed(false);
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : copy.importError
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="student-import-shell">
      {message ? (
        <div
          className={message.tone === "success" ? "form-message form-success" : "form-message form-error"}
          role={message.tone === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      ) : null}

      <section className="panel student-import-setup">
        <div className="student-import-heading">
          <div>
            <h2>{copy.csvFile}</h2>
            <p>{copy.templateHint}</p>
          </div>
          <button className="secondary-button" type="button" onClick={downloadTemplate} disabled={busy}>
            {copy.template}
          </button>
        </div>

        <label
          className="student-import-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (busy) return;
            void readCsv(event.dataTransfer.files?.[0] ?? null);
          }}
        >
          <span>{fileName || copy.chooseCsv}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => void readCsv(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="student-import-placement">
          <label className="field-label">
            {copy.placement}
            <select
              className="text-field"
              value={groupId}
              disabled={busy}
              onChange={(event) => {
                setGroupId(Number(event.target.value));
                setConfirmed(false);
              }}
            >
              <option value={0}>—</option>
              {currentGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.programLabel} · {group.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            {copy.joinedOn}
            <input
              className="text-field"
              type="date"
              value={joinedOn}
              disabled={busy}
              onChange={(event) => {
                setJoinedOn(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
        </div>
      </section>

      {analysis ? (
        <section className="panel student-import-preview" aria-live="polite">
          <div className="student-import-heading">
            <div>
              <h2>{copy.preview}</h2>
              <p>{analysis.rows.length} {copy.rows}</p>
            </div>
            {(analysis.issues.length || analysis.headerWarnings.length) ? (
              <button className="secondary-button" type="button" onClick={downloadErrors} disabled={busy}>
                {copy.downloadErrors}
              </button>
            ) : null}
          </div>

          <div className="student-import-metrics">
            <div><span>{copy.valid}</span><strong>{analysis.validRows.length}</strong></div>
            <div><span>{copy.warnings}</span><strong>{warningCount + analysis.headerWarnings.length}</strong></div>
            <div><span>{copy.invalid}</span><strong>{invalidRows}</strong></div>
            <div><span>{copy.duplicates}</span><strong>{duplicateCount}</strong></div>
          </div>

          {analysis.headerWarnings.length ? (
            <div className="student-import-header-warnings">
              {analysis.headerWarnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}

          <div className="student-import-row-list">
            {analysis.rows.map((preview) => {
              const hasError = preview.issues.some((item) => item.severity === "error");
              const hasWarning = preview.issues.some((item) => item.severity === "warning");
              const status = hasError ? copy.invalidRow : hasWarning ? copy.warningRow : copy.validRow;
              return (
                <article
                  className={`student-import-row ${hasError ? "is-error" : hasWarning ? "is-warning" : "is-valid"}`}
                  key={preview.rowNumber}
                >
                  <div className="student-import-row-number">{copy.row} {preview.rowNumber}</div>
                  <div className="student-import-row-main">
                    <strong>{preview.row?.display_name || "—"}</strong>
                    <span>{copy.guardian}: {preview.row?.guardian?.name || copy.noGuardian}</span>
                    {preview.issues.length ? <small>{copy.issue}: {issueText(preview.issues)}</small> : null}
                  </div>
                  <span className="status-pill">{status}</span>
                </article>
              );
            })}
          </div>

          <label className="student-import-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || invalidRows > 0 || analysis.validRows.length === 0}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>{copy.reviewConfirm}</span>
          </label>

          {busy ? (
            <div className="student-import-progress" role="status">
              <progress />
              <span>{copy.importing}</span>
            </div>
          ) : null}

          <button
            className="action-button action-button-primary student-import-primary"
            type="button"
            disabled={!canImport}
            aria-busy={busy || undefined}
            onClick={() => void runImport()}
          >
            {busy ? copy.importing : copy.importAction}
          </button>
        </section>
      ) : null}

      {result ? (
        <section className="panel student-import-result" aria-live="polite">
          <h2>{copy.summary}</h2>
          <div className="student-import-metrics">
            <div><span>{copy.created}</span><strong>{result.created}</strong></div>
            <div><span>{copy.linked}</span><strong>{result.linked}</strong></div>
            <div><span>{copy.skipped}</span><strong>{result.skipped}</strong></div>
            <div><span>{copy.failed}</span><strong>{result.failed}</strong></div>
          </div>
        </section>
      ) : null}

      <section className="panel student-import-history">
        <h2>{copy.recent}</h2>
        {importJobs.length ? (
          <div className="student-import-row-list">
            {importJobs.map((job) => (
              <article className="student-import-row" key={job.id}>
                <div className="student-import-row-number">#{job.id}</div>
                <div className="student-import-row-main">
                  <strong>{job.state}</strong>
                  <span>{new Date(job.createdAt).toLocaleString()}</span>
                </div>
                <span className="status-pill">
                  {job.succeededItems}/{job.totalItems}
                </span>
              </article>
            ))}
          </div>
        ) : <p className="empty-state">{copy.none}</p>}
      </section>
    </div>
  );
}
