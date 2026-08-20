import { getTranslations } from "next-intl/server";
import { ConfigurationPresetSelector } from "@/components/configuration-preset-selector";
import { configurationPresets } from "@/lib/configuration/presets";
import { renderNumberPreview } from "@/lib/configuration/validators";
import type { ConfigurationLocale } from "@/lib/configuration/model";

const moduleKeys = [
  "institution",
  "branches",
  "languages",
  "terminology",
  "grading",
  "attendance",
  "workflows",
  "documents",
  "numbering"
] as const;

type ConfigurationPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ConfigurationPage({ params }: ConfigurationPageProps) {
  const [{ locale }, t] = await Promise.all([params, getTranslations("Configuration")]);
  const selectedLocale = locale as ConfigurationLocale;
  const numberPreview = renderNumberPreview({
    pattern: "{BRANCH}/{YEAR}/{TYPE}/{COUNTER}",
    padding: 5,
    nextValue: 42,
    branch: "MUM01",
    session: "2026-27",
    year: "2026",
    type: "ADM"
  }).preview;

  const presets = configurationPresets.map((preset) => ({
    key: preset.key,
    name: preset.name[selectedLocale],
    description: t(`presets.${preset.key}`),
    domains: preset.enabledDomains.map((domain) => t(`domains.${domain}`)),
    terms: preset.terminology.map((entry) => ({
      concept: t(`concepts.${entry.conceptKey}`),
      singular: entry.singular[selectedLocale],
      plural: entry.plural[selectedLocale]
    }))
  }));

  return (
    <>
      <section className="page-heading configuration-heading">
        <div>
          <p className="sample-label">{t("phase")}</p>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <div className="readiness-score" aria-label={t("readiness")}>
          <strong>64%</strong>
          <span>{t("readiness")}</span>
        </div>
      </section>

      <section className="configuration-banner" aria-labelledby="next-step-title">
        <div>
          <span>{t("recommended")}</span>
          <h2 id="next-step-title">{t("nextStep")}</h2>
          <p>{t("nextStepBody")}</p>
        </div>
        <a className="action-button action-button-primary" href="#presets">{t("reviewPresets")}</a>
      </section>

      <section aria-labelledby="modules-title" className="configuration-section">
        <header className="section-heading">
          <div>
            <p>{t("governedSetup")}</p>
            <h2 id="modules-title">{t("modulesTitle")}</h2>
          </div>
          <span>{t("modulesProgress", { complete: 5, total: 9 })}</span>
        </header>

        <div className="configuration-module-grid">
          {moduleKeys.map((key, index) => {
            const state = index < 5 ? "complete" : index === 5 ? "attention" : "pending";
            return (
              <article className="configuration-module" key={key}>
                <span className={`module-state module-state-${state}`}>{t(`states.${state}`)}</span>
                <h3>{t(`modules.${key}.title`)}</h3>
                <p>{t(`modules.${key}.body`)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="presets-title" className="configuration-section" id="presets">
        <header className="section-heading">
          <div>
            <p>{t("editableStartingPoint")}</p>
            <h2 id="presets-title">{t("presetsTitle")}</h2>
          </div>
          <span>{t("presetsCount", { count: presets.length })}</span>
        </header>

        <ConfigurationPresetSelector
          domainsLabel={t("enabledDomains")}
          draftLabel={t("draftPreview")}
          presets={presets}
          selectedLabel={t("selectedPreset")}
          terminologyLabel={t("terminologyPreview")}
        />
      </section>

      <section className="configuration-detail-grid">
        <article className="configuration-detail-card">
          <span>{t("versioned")}</span>
          <h2>{t("terminologyTitle")}</h2>
          <p>{t("terminologyBody")}</p>
          <dl className="term-list term-list-compact">
            <div><dt>{t("concepts.student")}</dt><dd>{presets[0]?.terms[0]?.singular}</dd></div>
            <div><dt>{t("concepts.teacher")}</dt><dd>{presets[0]?.terms[1]?.singular}</dd></div>
            <div><dt>{t("concepts.class")}</dt><dd>{presets[0]?.terms[2]?.singular}</dd></div>
          </dl>
        </article>

        <article className="configuration-detail-card">
          <span>{t("collisionSafe")}</span>
          <h2>{t("numberingTitle")}</h2>
          <p>{t("numberingBody")}</p>
          <div className="number-preview">
            <small>{t("preview")}</small>
            <code>{numberPreview}</code>
          </div>
        </article>

        <article className="configuration-detail-card">
          <span>{t("immutableHistory")}</span>
          <h2>{t("workflowTitle")}</h2>
          <p>{t("workflowBody")}</p>
          <ol className="workflow-preview">
            <li>{t("workflowDraft")}</li>
            <li>{t("workflowReview")}</li>
            <li>{t("workflowPublish")}</li>
          </ol>
        </article>
      </section>
    </>
  );
}
