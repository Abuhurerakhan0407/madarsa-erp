import { getTranslations } from "next-intl/server";
import { AdmissionsFoundationSetup } from "@/components/admissions-foundation-setup";
import { ConfigurationPresetSelector } from "@/components/configuration-preset-selector";
import { StudentNumberingSetup } from "@/components/student-numbering-setup";
import { presetActionLabels } from "@/lib/configuration/preset-action-labels";
import { configurationPresets } from "@/lib/configuration/presets";
import {
  configurationModuleKeys,
  getConfigurationReadiness
} from "@/lib/configuration/readiness";
import type { ConfigurationLocale } from "@/lib/configuration/model";

type ConfigurationPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ConfigurationPage({ params }: ConfigurationPageProps) {
  const [{ locale }, t, dashboard, readiness] = await Promise.all([
    params,
    getTranslations("Configuration"),
    getTranslations("Dashboard"),
    getConfigurationReadiness()
  ]);
  const selectedLocale = locale as ConfigurationLocale;

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
      <section className="page-heading configuration-heading" data-page-section>
        <div>
          <p className="state-kicker">{t("phase")}</p>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <div className="readiness-score" aria-label={t("readiness")}>
          <strong>{readiness.percent}%</strong>
          <span>{t("readiness")}</span>
        </div>
      </section>

      <section className="configuration-banner" aria-labelledby="next-step-title" data-page-section>
        <div>
          <span>{t("recommended")}</span>
          <h2 id="next-step-title">{t("nextStep")}</h2>
          <p>{t("nextStepBody")}</p>
        </div>
        <a className="action-button action-button-primary" href="#presets">{t("reviewPresets")}</a>
      </section>

      <section aria-labelledby="modules-title" className="configuration-section" data-page-section>
        <header className="section-heading">
          <div>
            <p>{t("governedSetup")}</p>
            <h2 id="modules-title">{t("modulesTitle")}</h2>
          </div>
          <span>
            {t("modulesProgress", {
              complete: readiness.completeCount,
              total: configurationModuleKeys.length
            })}
          </span>
        </header>

        <div className="configuration-module-grid">
          {configurationModuleKeys.map((key) => {
            const state = readiness.states[key];
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

      <section aria-labelledby="presets-title" className="configuration-section" id="presets" data-page-section>
        <header className="section-heading">
          <div>
            <p>{t("editableStartingPoint")}</p>
            <h2 id="presets-title">{t("presetsTitle")}</h2>
          </div>
          <span>{t("presetsCount", { count: presets.length })}</span>
        </header>

        <ConfigurationPresetSelector
          actionLabels={presetActionLabels[selectedLocale]}
          domainsLabel={t("enabledDomains")}
          draftLabel={t("draftPreview")}
          presets={presets}
          selectedLabel={t("selectedPreset")}
          terminologyLabel={t("terminologyPreview")}
        />
      </section>

      <div data-page-section>
        <AdmissionsFoundationSetup locale={selectedLocale} />
      </div>
      <div data-page-section>
        <StudentNumberingSetup locale={selectedLocale} currentPattern={readiness.numberPattern} />
      </div>

      <section className="configuration-detail-grid" data-page-section>
        <article className="configuration-detail-card">
          <span>{t("versioned")}</span>
          <h2>{t("terminologyTitle")}</h2>
          <p>{t("terminologyBody")}</p>
          <div className="number-preview">
            <small>{t(`states.${readiness.states.terminology}`)}</small>
          </div>
        </article>

        <article className="configuration-detail-card">
          <span>{t("collisionSafe")}</span>
          <h2>{t("numberingTitle")}</h2>
          <p>{t("numberingBody")}</p>
          <div className="number-preview">
            <small>{t(`states.${readiness.states.numbering}`)}</small>
            {readiness.numberPattern ? (
              <code>{readiness.numberPattern}</code>
            ) : (
              <code>{dashboard("emptyTitle")}</code>
            )}
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
