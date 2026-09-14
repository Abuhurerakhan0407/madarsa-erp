"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";

type Result = { personId: number; name: string; nativeName: string | null; studentNumber: string; status: string; program: string; group: string };
const copy = {
  en: { label: "Find student", placeholder: "Name, student/admission no. or guardian phone", empty: "No matching students", loading: "Searching…", opening: "Opening student…" },
  ur: { label: "طالب علم تلاش کریں", placeholder: "نام، طالب علم/داخلہ نمبر یا سرپرست فون", empty: "کوئی طالب علم نہیں ملا", loading: "تلاش جاری ہے…", opening: "طالب علم کھل رہا ہے…" },
  ar: { label: "البحث عن طالب", placeholder: "الاسم أو رقم الطالب/القبول أو هاتف ولي الأمر", empty: "لا يوجد طالب مطابق", loading: "جارٍ البحث…", opening: "جارٍ فتح الطالب…" }
} as const;

export function GlobalStudentSearch({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => setNavigating(false), [pathname]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    const value = q.trim();
    if (value.length < 2) {
      const timer = window.setTimeout(() => {
        setResults([]);
        setOpen(false);
        setActiveIndex(-1);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/students/search?q=${encodeURIComponent(value)}&locale=${locale}`, { signal: controller.signal, cache: "no-store" });
        const json = await response.json();
        const nextResults = response.ok && Array.isArray(json.results) ? json.results as Result[] : [];
        setResults(nextResults);
        setOpen(true);
        setActiveIndex(nextResults.length ? 0 : -1);
        if (nextResults[0]) router.prefetch(`/${locale}/students/${nextResults[0].personId}`);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setResults([]);
          setActiveIndex(-1);
        }
      } finally {
        setBusy(false);
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, locale, router]);

  function changeQuery(value: string) {
    setQ(value);
    if (value.trim().length < 2) {
      setResults([]);
      setBusy(false);
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function openStudent(personId: number) {
    setNavigating(true);
    setOpen(false);
    router.push(`/${locale}/students/${personId}`);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === "ArrowDown" && results.length) {
        setOpen(true);
        setActiveIndex(0);
        event.preventDefault();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((previous) => (previous + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((previous) => (previous - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        openStudent(results[activeIndex].personId);
      } else if (results.length === 1) {
        event.preventDefault();
        openStudent(results[0].personId);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return <div ref={box} className="global-search-box" style={{ minWidth: 0, flex: "1 1 16rem", maxWidth: "34rem" }}>
    <label className="sr-only" htmlFor="global-student-search">{t.label}</label>
    <input id="global-student-search" className="text-field" type="search" value={q} onChange={(event) => changeQuery(event.target.value)} onFocus={() => q.trim().length >= 2 && setOpen(true)} onKeyDown={handleKeyDown} role="combobox" aria-expanded={open} aria-controls="global-search-listbox" aria-autocomplete="list" aria-busy={busy || navigating || undefined} aria-activedescendant={activeIndex >= 0 ? `global-search-option-${results[activeIndex]?.personId}` : undefined} placeholder={t.placeholder} autoComplete="off" />
    {busy || navigating ? <span className="global-search-progress" title={navigating ? t.opening : t.loading}><span className="inline-spinner" aria-hidden="true" /><span className="sr-only">{navigating ? t.opening : t.loading}</span></span> : null}
    {open ? <div id="global-search-listbox" role="listbox" aria-label={t.label} style={{ position: "absolute", insetInline: 0, top: "calc(100% + .45rem)", zIndex: 80, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: ".85rem", boxShadow: "0 18px 45px rgb(20 49 32 / 16%)", padding: ".45rem", maxHeight: "24rem", overflowY: "auto" }}>
      {busy ? <p style={{ padding: ".7rem", margin: 0, display: "flex", alignItems: "center", gap: ".5rem" }} role="status" aria-live="polite"><span className="inline-spinner" aria-hidden="true" />{t.loading}</p> : results.length ? results.map((result, index) => <Link key={result.personId} id={`global-search-option-${result.personId}`} role="option" aria-selected={index === activeIndex} href={`/${locale}/students/${result.personId}`} prefetch={false} onMouseEnter={() => router.prefetch(`/${locale}/students/${result.personId}`)} onFocus={() => router.prefetch(`/${locale}/students/${result.personId}`)} onClick={() => { setNavigating(true); setOpen(false); }} style={{ display: "grid", padding: ".7rem .8rem", borderRadius: ".65rem", textDecoration: "none", color: "inherit", gap: ".15rem", background: index === activeIndex ? "var(--surface-hover, #f3f4f6)" : "transparent", outline: index === activeIndex ? "2px solid var(--border)" : "none" }}><strong>{result.name}</strong>{result.nativeName ? <span dir="auto">{result.nativeName}</span> : null}<small>{result.studentNumber} · {result.program} · {result.group} · {result.status}</small></Link>) : <p style={{ padding: ".7rem", margin: 0 }} role="status">{t.empty} — try a different name or ID</p>}
    </div> : null}
  </div>;
}
