"use client";

import { useState } from "react";

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
};

export function ConfigurationPresetSelector({
  presets,
  selectedLabel,
  terminologyLabel,
  domainsLabel,
  draftLabel
}: ConfigurationPresetSelectorProps) {
  const [selectedKey, setSelectedKey] = useState(presets[0]?.key ?? "");
  const selected = presets.find((preset) => preset.key === selectedKey) ?? presets[0];

  if (!selected) return null;

  return (
    <div className="preset-workspace">
      <div className="preset-grid" aria-label={selectedLabel}>
        {presets.map((preset) => (
          <button
            aria-pressed={preset.key === selected.key}
            className="preset-card"
            key={preset.key}
            onClick={() => setSelectedKey(preset.key)}
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
      </article>
    </div>
  );
}
