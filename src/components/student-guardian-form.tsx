"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";

type Guardian = {
  personId: number;
  name: string;
  relationship: string;
  phone: string | null;
  occupation: string | null;
  education: string | null;
  canCollect: boolean;
} | null;

type GuardianSearchResult = {
  personId: number;
  name: string;
  relationship: string;
  phone: string | null;
  occupation: string | null;
  education: string | null;
  canCollect: boolean;
  children: string[];
};

const copy = {
  en: {
    title: "Primary guardian",
    body: "Maintain the student's main family contact and pickup authority.",
    name: "Guardian name",
    relationship: "Relationship",
    phone: "Phone",
    occupation: "Occupation",
    education: "Education",
    collect: "Authorized to collect student",
    save: "Save guardian",
    saving: "Saving…",
    saved: "Guardian details saved.",
    error: "Unable to save guardian details.",
    father: "Father",
    mother: "Mother",
    guardian: "Guardian",
    linkTitle: "Link existing guardian",
    linkBody: "Search by guardian name to reuse one family record for siblings.",
    search: "Search guardians",
    searchPlaceholder: "Type at least 2 characters",
    searching: "Searching…",
    searchError: "Unable to search guardians.",
    noResults: "No matching guardians.",
    useGuardian: "Use this guardian",
    selected: "Selected",
    newGuardian: "Use new guardian"
  },
  ur: {
    title: "بنیادی سرپرست",
    body: "طالب علم کے بنیادی خاندانی رابطے اور پک اپ اختیار کو برقرار رکھیں۔",
    name: "سرپرست کا نام",
    relationship: "رشتہ",
    phone: "فون",
    occupation: "پیشہ",
    education: "تعلیم",
    collect: "طالب علم کو لے جانے کی اجازت",
    save: "سرپرست محفوظ کریں",
    saving: "محفوظ ہو رہا ہے…",
    saved: "سرپرست کی معلومات محفوظ ہو گئیں۔",
    error: "سرپرست کی معلومات محفوظ نہیں ہو سکیں۔",
    father: "والد",
    mother: "والدہ",
    guardian: "سرپرست",
    linkTitle: "موجودہ سرپرست منسلک کریں",
    linkBody: "خاندان کا ایک ریکارڈ دوبارہ استعمال کرنے کے لیے سرپرست کے نام سے تلاش کریں۔",
    search: "سرپرست تلاش کریں",
    searchPlaceholder: "کم از کم 2 حروف لکھیں",
    searching: "تلاش ہو رہی ہے…",
    searchError: "سرپرست تلاش نہیں ہو سکے۔",
    noResults: "کوئی سرپرست نہیں ملا۔",
    useGuardian: "یہ سرپرست استعمال کریں",
    selected: "منتخب",
    newGuardian: "نیا سرپرست استعمال کریں"
  }
} as const;

export function StudentGuardianForm({
  locale,
  personId,
  guardian
}: {
  locale: SupportedLocale;
  personId: number;
  guardian: Guardian;
}) {
  const text = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<GuardianSearchResult[]>([]);
  const [selectedGuardianId, setSelectedGuardianId] = useState<number | null>(guardian?.personId ?? null);
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianSearchResult | null>(null);

  async function runSearch() {
    const query = search.trim();
    if (query.length < 2) return;
    setSearchBusy(true);
    setSearchError(null);
    setResults([]);
    try {
      const response = await fetch("/api/students/" + personId + "/guardian?q=" + encodeURIComponent(query), {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        guardians?: GuardianSearchResult[];
      };
      if (!response.ok) throw new Error(payload.error || text.searchError);
      setResults(Array.isArray(payload.guardians) ? payload.guardians : []);
    } catch {
      setSearchError(text.searchError);
    } finally {
      setSearchBusy(false);
    }
  }

  function chooseGuardian(result: GuardianSearchResult) {
    setSelectedGuardianId(result.personId);
    setSelectedGuardian(result);
    setResults([]);
    setSearch("");
    setError(null);
    setSaved(false);
  }

  function clearGuardian() {
    setSelectedGuardianId(null);
    setSelectedGuardian(null);
    setResults([]);
    setSearch("");
    setError(null);
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) || "").trim() || undefined;
    const body = {
      name: String(form.get("name") || "").trim(),
      relationship: form.get("relationship"),
      phone: optional("phone"),
      occupation: optional("occupation"),
      education: optional("education"),
      canCollect: form.get("canCollect") === "on",
      guardianPersonId: selectedGuardianId ?? undefined
    };
    try {
      const response = await fetch("/api/students/" + personId + "/guardian", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error || text.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(text.error);
    } finally {
      setBusy(false);
    }
  }

  const formKey = String(selectedGuardianId ?? "new");

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>{text.title}</h2>
          <span>{text.body}</span>
        </div>
      </header>

      <div className="configuration-form">
        <section className="panel">
          <header className="panel-header">
            <div>
              <h3>{text.linkTitle}</h3>
              <span>{text.linkBody}</span>
            </div>
          </header>
          <div className="quick-actions">
            <input
              className="text-field"
              value={search}
              placeholder={text.searchPlaceholder}
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runSearch();
                }
              }}
            />
            <button className="action-button" type="button" disabled={searchBusy || busy} onClick={() => void runSearch()}>
              {searchBusy ? text.searching : text.search}
            </button>
            {selectedGuardianId ? (
              <button className="action-button" type="button" disabled={searchBusy || busy} onClick={clearGuardian}>
                {text.newGuardian}
              </button>
            ) : null}
          </div>

          {searchError ? <p className="form-message form-error" role="alert">{searchError}</p> : null}
          {selectedGuardian ? (
            <p className="form-message" role="status">
              {text.selected}: <strong>{selectedGuardian.name}</strong>
              {selectedGuardian.children.length ? " · " + selectedGuardian.children.join(", ") : ""}
            </p>
          ) : null}
          {results.length ? (
            <div className="flow-stack" role="list">
              {results.map((result) => (
                <article className="demo-card" key={result.personId} role="listitem">
                  <strong>{result.name}</strong>
                  <span>{result.relationship}{result.children.length ? " · " + result.children.join(", ") : ""}</span>
                  <button className="action-button" type="button" disabled={busy || searchBusy} onClick={() => chooseGuardian(result)}>
                    {text.useGuardian}
                  </button>
                </article>
              ))}
            </div>
          ) : search.trim().length >= 2 && !searchBusy ? <p>{text.noResults}</p> : null}
        </section>

        <form key={formKey} className="configuration-form" aria-busy={busy} onSubmit={submit}>
          <input type="hidden" name="guardianPersonId" value={selectedGuardianId ?? guardian?.personId ?? ""} />
          <div className="configuration-form-grid">
            <label className="field-label">
              {text.name}
              <input className="text-field" name="name" defaultValue={selectedGuardian?.name || guardian?.name || ""} required minLength={2} maxLength={160} />
            </label>
            <label className="field-label">
              {text.relationship}
              <select className="text-field" name="relationship" defaultValue={selectedGuardian?.relationship || guardian?.relationship || "guardian"}>
                <option value="father">{text.father}</option>
                <option value="mother">{text.mother}</option>
                <option value="guardian">{text.guardian}</option>
              </select>
            </label>
            <label className="field-label">
              {text.phone}
              <input className="text-field" name="phone" inputMode="tel" defaultValue={selectedGuardian?.phone || guardian?.phone || ""} maxLength={80} />
            </label>
            <label className="field-label">
              {text.occupation}
              <input className="text-field" name="occupation" defaultValue={selectedGuardian?.occupation || guardian?.occupation || ""} maxLength={160} />
            </label>
            <label className="field-label">
              {text.education}
              <input className="text-field" name="education" defaultValue={selectedGuardian?.education || guardian?.education || ""} maxLength={160} />
            </label>
          </div>

          <label className="check-row">
            <input name="canCollect" type="checkbox" defaultChecked={selectedGuardian ? selectedGuardian.canCollect : guardian ? guardian.canCollect : true} />
            <span>{text.collect}</span>
          </label>
          <button className="action-button action-button-primary" type="submit" disabled={busy}>
            {busy ? text.saving : text.save}
          </button>
          {saved ? <p className="form-message" role="status">{text.saved}</p> : null}
          {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
        </form>
      </div>
    </section>
  );
}
