"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PresetActionLabels } from "@/lib/configuration/preset-action-labels";

type PresetView = {
  key: string;
  name: string;
  description: string;
  domains: readonly string[];
  terms: readonly { concept: string; singular: string; plural: string }[];
};

type ConfigurationPresetSelectorProps = {
  presets: readonly PresetView[];
  selectedLabel: string;
  terminologyLabel: string;
  domainsLabel: string;
  draftLabel: string;
  actionLabels: PresetActionLabels;
};

export function ConfigurationPresetSelector({
  presets,
  selectedLabel,
  terminologyLabel,
  domainsLabel,
  draftLabel,
  actionLabels
}: ConfigurationPresetSelectorProps) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState(presets[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = presets.find((preset) => preset.key === selectedKey) ?? presets[0];

  if (!selected) return null;

  async function createDrafts() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/configuration/preset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presetKey: selected.key })
      });

      if (!response.ok) {
        throw new Error(actionLabels.failed);
      }

      setMessage(actionLabels.applied);
      router.refresh();
    } catch {
      setError(actionLabels.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="preset-workspace">
      <div className="preset-grid" aria-label={selectedLabel}>
        {presets.map((preset) => (
          <button
            aria-pressed={preset.key === selected.key}
            className="preset-card"
            key={preset.key}
            onClick={() => {
              setSelectedKey(preset.key);
              setMessage(null);
              setError(null);
            }}
            type="button"
          >
            <strong>{preset.name}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>

      <article className="preset-preview" aria-live="polite">
        <header>
          <div>
            <span>{selectedLabel}</span>
            <h3>{selected.name}</h3>
          </div>
          <span className="status-pill">{draftLabel}</span>
        </header>

        <div className="preset-preview-grid">
          <section>
            <h4>{domainsLabel}</h4>
            <div className="tag-list">
              {selected.domains.map((domain) => <span key={domain}>{domain}</span>)}
            </div>
          </section>

          <section>
            <h4>{terminologyLabel}</h4>
            <dl className="term-list">
              {selected.terms.map((term) => (
                <div key={term.concept}>
                  <dt>{term.concept}</dt>
                  <dd>{term.singular} · {term.plural}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <button
          className="action-button action-button-primary"
          disabled={busy}
          onClick={createDrafts}
          type="button"
        >
          {busy ? actionLabels.applying : actionLabels.apply}
        </button>
        {message ? <p className="form-message" role="status">{message}</p> : null}
        {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
      </article>
    </div>
  );
}
