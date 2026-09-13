"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Locale } from "@/lib/i18n/config";

type Result = {
  personId: number;
  name: string;
  nativeName: string | null;
  studentNumber: string;
  status: string;
  program: string;
  group: string;
};

const copy = {
  en: {
    label: "Find student",
    placeholder: "Name, student/admission no. or guardian phone",
    empty: "No matching students",
    loading: "Searching…",
    error: "Student search is unavailable right now.",
    retry: "Retry"
  },
  ur: {
    label: "طالب علم تلاش کریں",
    placeholder: "نام، طالب علم/داخلہ نمبر یا سرپرست فون",
    empty: "کوئی طالب علم نہیں ملا",
    loading: "تلاش جاری ہے…",
    error: "طالب علم کی تلاش فی الحال دستیاب نہیں ہے۔",
    retry: "دوبارہ کوشش کریں"
  },
  ar: {
    label: "البحث عن طالب",
    placeholder: "الاسم أو رقم الطالب/القبول أو هاتف ولي الأمر",
    empty: "لا يوجد طالب مطابق",
    loading: "جارٍ البحث…",
    error: "البحث عن الطلاب غير متاح الآن.",
    retry: "إعادة المحاولة"
  }
} as const;

const LISTBOX_ID = "global-student-search-results";

export function GlobalStudentSearch({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    const value = q.trim();
    if (value.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError(false);

      try {
        const response = await fetch(
          `/api/students/search?q=${encodeURIComponent(value)}&locale=${locale}`,
          { signal: controller.signal, cache: "no-store" }
        );

        if (!response.ok) throw new Error(`Student search failed with ${response.status}`);

        const json = await response.json();
        const nextResults = Array.isArray(json.results) ? json.results : [];
        setResults(nextResults);
        setActiveIndex(-1);
        setOpen(true);
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") {
          setResults([]);
          setActiveIndex(-1);
          setError(true);
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, locale, retryNonce]);

  function changeQuery(value: string) {
    setQ(value);
    setOpen(false);
    setError(false);
    setActiveIndex(-1);

    if (value.trim().length < 2) {
      setResults([]);
      setBusy(false);
    }
  }

  function moveActive(delta: number) {
    if (results.length === 0) return;
    setOpen(true);
    setActiveIndex((current) => {
      if (current < 0) return delta > 0 ? 0 : results.length - 1;
      return (current + delta + results.length) % results.length;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === "Escape") {
      if (open) event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      setOpen(false);
      router.push(`/${locale}/students/${results[activeIndex].personId}`);
    }
  }

  const activeId =
    open && activeIndex >= 0 && results[activeIndex]
      ? `global-student-search-option-${results[activeIndex].personId}`
      : undefined;

  return (
    <div
      ref={box}
      style={{ position: "relative", minWidth: "min(34rem,42vw)", flex: "1 1 24rem" }}
    >
      <label className="sr-only" htmlFor="global-student-search">
        {t.label}
      </label>
      <input
        id="global-student-search"
        className="text-field"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={activeId}
        value={q}
        onChange={(event) => changeQuery(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => q.trim().length >= 2 && setOpen(true)}
        placeholder={t.placeholder}
        autoComplete="off"
      />

      {open ? (
        <div
          id={LISTBOX_ID}
          role="listbox"
          aria-label={t.label}
          style={{
            position: "absolute",
            insetInline: 0,
            top: "calc(100% + .45rem)",
            zIndex: 80,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: ".85rem",
            boxShadow: "0 18px 45px rgb(20 49 32 / 16%)",
            padding: ".45rem",
            maxHeight: "24rem",
            overflowY: "auto"
          }}
        >
          {busy ? (
            <p role="status" aria-live="polite" style={{ padding: ".7rem", margin: 0 }}>
              {t.loading}
            </p>
          ) : error ? (
            <div role="alert" style={{ padding: ".7rem" }}>
              <p style={{ margin: "0 0 .55rem" }}>{t.error}</p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setRetryNonce((value) => value + 1)}
              >
                {t.retry}
              </button>
            </div>
          ) : results.length ? (
            results.map((result, index) => (
              <Link
                id={`global-student-search-option-${result.personId}`}
                key={result.personId}
                role="option"
                aria-selected={index === activeIndex}
                href={`/${locale}/students/${result.personId}`}
                onMouseMove={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => {
                  setOpen(false);
                  setActiveIndex(-1);
                }}
                style={{
                  display: "grid",
                  padding: ".7rem .8rem",
                  borderRadius: ".65rem",
                  textDecoration: "none",
                  color: "inherit",
                  gap: ".15rem",
                  outline: index === activeIndex ? "2px solid currentColor" : undefined,
                  outlineOffset: index === activeIndex ? "-2px" : undefined
                }}
              >
                <strong>{result.name}</strong>
                {result.nativeName ? <span dir="auto">{result.nativeName}</span> : null}
                <small>
                  {result.studentNumber} · {result.program} · {result.group} · {result.status}
                </small>
              </Link>
            ))
          ) : (
            <p role="status" aria-live="polite" style={{ padding: ".7rem", margin: 0 }}>
              {t.empty}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
