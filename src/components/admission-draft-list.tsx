"use client";

import Link from "next/link";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";

export type AdmissionDraftListItem = {
  id: number;
  applicantName: string;
  program: string;
  session: string;
  updatedAt: string;
};

const copy = {
  en: {
    empty: "No saved admission drafts.",
    emptyBody: "Start a new admission. Completed steps are saved here automatically.",
    resume: "Resume",
    discard: "Discard",
    discarding: "Discarding…",
    confirm: "Discard this admission draft? This cannot be undone.",
    error: "Unable to discard the draft. Try again.",
    updated: "Updated"
  },
  ur: {
    empty: "کوئی محفوظ داخلہ ڈرافٹ نہیں۔",
    emptyBody: "نیا داخلہ شروع کریں۔ مکمل مراحل خودکار طور پر یہاں محفوظ ہوں گے۔",
    resume: "جاری رکھیں",
    discard: "حذف کریں",
    discarding: "حذف ہو رہا ہے…",
    confirm: "یہ داخلہ ڈرافٹ حذف کریں؟ اسے واپس نہیں لایا جا سکے گا۔",
    error: "ڈرافٹ حذف نہیں ہو سکا۔ دوبارہ کوشش کریں۔",
    updated: "تازہ کاری"
  }
} as const;

const dateLocale: Record<SupportedLocale, string> = {
  en: "en-IN",
  ur: "ur-IN"
};

export function AdmissionDraftList({
  locale,
  initialItems
}: {
  locale: SupportedLocale;
  initialItems: AdmissionDraftListItem[];
}) {
  const text = copy[locale];
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function discard(id: number) {
    if (busyId !== null || !window.confirm(text.confirm)) return;
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch("/api/admissions/staff-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "discard", draftId: id })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || text.error);
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
    } catch {
      setError(text.error);
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) {
    return (
      <div className="empty-state">
        <strong>{text.empty}</strong>
        <p>{text.emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="workspace-record-list">
      {items.map((item) => (
        <article className="workspace-record-row" key={item.id}>
          <div className="workspace-record-main">
            <strong>{item.applicantName}</strong>
            <small>{item.program} · {item.session}</small>
          </div>
          <div className="workspace-record-meta">
            <span>
              {text.updated}:{" "}
              <time dateTime={item.updatedAt}>
                {new Intl.DateTimeFormat(dateLocale[locale], {
                  dateStyle: "medium",
                  timeStyle: "short"
                }).format(new Date(item.updatedAt))}
              </time>
            </span>
          </div>
          <div className="quick-actions">
            <Link
              className="action-button action-button-primary"
              href={`/${locale}/students/new?draft=${item.id}`}
            >
              {text.resume}
            </Link>
            <button
              className="action-button"
              type="button"
              disabled={busyId !== null}
              aria-busy={busyId === item.id || undefined}
              onClick={() => void discard(item.id)}
            >
              {busyId === item.id ? text.discarding : text.discard}
            </button>
          </div>
        </article>
      ))}
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
    </div>
  );
}
