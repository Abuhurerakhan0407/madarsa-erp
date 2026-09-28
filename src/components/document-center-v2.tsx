"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { documentsCopy } from "@/lib/documents/copy";
import { documentAvailable, type ClientDocumentType, type DocumentStudent } from "@/lib/documents/contract";

type Filters = {
  sessionId: number | null;
  programId: number | null;
  groupId: number | null;
  studentPersonId: number | null;
  search: string | null;
};

type GenerationRequest = {
  mode: "download" | "print";
  personIds: number[] | null;
  allFiltered: boolean;
  requestKey: string;
};

const REQUEST_TIMEOUT_MS = 30_000;

const previewPath = (locale: Locale, type: ClientDocumentType, personId: number) =>
  type === "student_id_card" ? `/${locale}/students/${personId}/id-card`
    : type === "student_profile" ? `/${locale}/students/${personId}`
      : type === "status_certificate" ? `/${locale}/documents/student-status/${personId}`
        : type === "exam_report_card" ? `/${locale}/exams/report-card/${personId}`
          : `/${locale}/quran/${personId}`;

function responseFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1]?.trim() || fallback;
}

function triggerDownload(blob: Blob, filename: string) {
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

export function DocumentCenterV2({
  locale,
  type,
  rows,
  total,
  selectionLimit,
  filters
}: {
  locale: Locale;
  type: ClientDocumentType;
  rows: DocumentStudent[];
  total: number;
  selectionLimit: number;
  filters: Filters;
}) {
  const t = documentsCopy[locale];

  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<GenerationRequest | null>(null);
  const requestVersion = useRef(0);
  const actionLock = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const available = useMemo(
    () => rows.filter((row) => documentAvailable(row, type)),
    [rows, type]
  );

  useEffect(() => {
    return () => {
      requestVersion.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      actionLock.current = false;
    };
  }, []);

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= selectionLimit
          ? current
          : [...current, id]
    );
  }

  function selectPage() {
    setSelected((current) =>
      current.length === available.length && available.every((row) => current.includes(row.personId))
        ? []
        : available.map((row) => row.personId).slice(0, selectionLimit)
    );
  }

  async function generate(mode: "download" | "print", personIds: number[] | null, allFiltered: boolean, requestKey = crypto.randomUUID()) {
    if (actionLock.current) return;
    actionLock.current = true;
    const request: GenerationRequest = { mode, personIds, allFiltered, requestKey };
    setLastRequest(request);

    const requestId = ++requestVersion.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT_MS);
    const printWindow = mode === "print" ? window.open("", "_blank") : null;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/documents/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          documentType: type,
          locale,
          personIds,
          allFiltered,
          inline: mode === "print",
          requestKey,
          filters
        })
      });

      if (requestId !== requestVersion.current) {
        printWindow?.close();
        return;
      }

      if (!response.ok) {
        printWindow?.close();
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setError(locale === "ur" ? t.generateError : (payload.error || t.generateError));
        return;
      }

      const blob = await response.blob();
      if (requestId !== requestVersion.current) {
        printWindow?.close();
        return;
      }

      const fallback = `${type.replaceAll("_", "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const filename = responseFilename(response, fallback);

      if (mode === "print") {
        const url = URL.createObjectURL(blob);
        const target = printWindow ?? window.open("", "_blank");
        if (!target) {
          URL.revokeObjectURL(url);
          setError(t.generateError);
          return;
        }
        target.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        triggerDownload(blob, filename);
      }
    } catch {
      if (requestId !== requestVersion.current) return;
      printWindow?.close();
      setError(controller.signal.aborted ? t.generateTimeout : t.generateError);
    } finally {
      window.clearTimeout(timeout);
      if (requestId === requestVersion.current) {
        actionLock.current = false;
        if (controllerRef.current === controller) controllerRef.current = null;
        setBusy(false);
      }
    }
  }

  const generationIds = selected.length ? selected : null;
  const generationAllFiltered = selected.length === 0;
  const printLabel = selected.length ? t.printSelected : t.printAll;

  return (
    <>
      {error ? (
        <div className="form-message form-error document-generate-error" role="alert">
          <span>{error}</span>
          {lastRequest ? (
            <button
              className="secondary-button"
              type="button"
              disabled={busy}
              onClick={() => void generate(lastRequest.mode, lastRequest.personIds, lastRequest.allFiltered, lastRequest.requestKey)}
            >
              {t.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="panel document-bulk-toolbar" aria-busy={busy || undefined}>
        <div className="document-selection-summary">
          <strong>{selected.length} {t.selected}</strong>
          <span>{available.length} {t.available} · {total} {t.showing}</span>
        </div>
        <div className="quick-actions">
          <button className="secondary-button" type="button" onClick={selectPage} disabled={busy || !available.length}>
            {t.selectAll}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={busy || !available.length}
            onClick={() => void generate("print", generationIds, generationAllFiltered)}
          >
            {printLabel}
          </button>
          <button
            className="action-button action-button-primary"
            type="button"
            disabled={busy || !available.length}
            aria-busy={busy || undefined}
            onClick={() => void generate("download", generationIds, generationAllFiltered)}
          >

            {busy ? (
              <>
                <span className="inline-spinner" aria-hidden="true" />
                {t.generating}
              </>
            ) : t.pdf}
          </button>
        </div>
      </section>

      <section className="documents-list">
        {rows.length ? rows.map((student) => {
          const canUse = documentAvailable(student, type);
          return (
            <article className={`panel document-student ${canUse ? "" : "is-disabled"}`} key={student.personId}>
              <header>
                <div className="document-select-line">
                  <input
                    id={`document-select-${student.personId}`}
                    type="checkbox"
                    aria-label={`${t.selectStudent} ${student.name}`}
                    checked={selected.includes(student.personId)}
                    disabled={busy || !canUse}
                    onChange={() => toggle(student.personId)}
                  />

                  <div>
                    <span>{student.studentNumber}{student.admissionNumber ? ` · ${student.admissionNumber}` : ""}</span>
                    <h2>{student.name}</h2>
                    {student.nameNative ? <small dir="auto">{student.nameNative}</small> : null}
                  </div>
                  <label className="document-select-hitbox" htmlFor={`document-select-${student.personId}`} aria-hidden="true" />
                </div>
                <strong>{student.program || "—"} · {student.classGroup || "—"}</strong>
              </header>
              <div className="quick-actions">
                {canUse ? (
                  <Link className="secondary-button" href={previewPath(locale, type, student.personId)}>
                    {t.preview}
                  </Link>
                ) : (
                  <span className="status-pill">{t.unavailable}</span>
                )}
              </div>
            </article>
          );
        }) : <p className="panel empty-state">{t.noStudents}</p>}
      </section>
    </>
  );
}
