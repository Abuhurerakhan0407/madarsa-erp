import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import { demoUiCopy, localize, type DemoModule } from "@/lib/demo/modules";
import { getDemoPresentation } from "@/lib/demo/presentation";

type DemoModulePageProps = {
  module: DemoModule;
  locale: Locale;
};

const copy: Record<Locale, {
  overview: string;
  process: string;
  capabilities: string;
  recentActivity: string;
  allModules: string;
  openWorkspace: string;
}> = {
  en: {
    overview: "Module overview",
    process: "Process",
    capabilities: "Capabilities",
    recentActivity: "Recent activity",
    allModules: "All modules",
    openWorkspace: "Open workspace"
  },
  ur: {
    overview: "ماڈیول جائزہ",
    process: "عمل",
    capabilities: "صلاحیتیں",
    recentActivity: "حالیہ سرگرمی"},
    allModules: "تمام ماڈیوز",
    openWorkspace: "ورک اسپیس کاوین مصروف"
  },
  ar : {
    overview: "نظرة عامة على الوحدة",
    process: "سير العمل",
    capabilities: "القدرات",
    recentActivity: "النشاط الأخير",
    allModules: "جميع الوحدات",
    openWorkspace: "فتح مساحة العمل"
  }
};

export function DemoModulePage({ module, locale }: DemoModulePageProps) {
  const labels = copy[locale];
  const presentation = getDemoPresentation(module);

  return (
    <>
      <section className="demo-module-heading professional-module-heading" data-page-section>
        <div>
          <div className="demo-eyebrow-row">
            <span className="demo-module-code">{module.code}</span>
            <span className="demo-scenario-chip">{labels.overview}</span>
            <span className="demo-scenario-chip">{localize(demoUiCopy.demoData, locale)}</span>
          </div>
          <h1>{localize(presentation.title, locale)}</h1>
          <p>{localize(presentation.description, locale)}</p>
        </div>
        <Link className="action-button" href={`/${locale}/demo`} prefetch>
          {labels.allModules}
        </Link>
      </section>

      <section className="demo-metric-grid" aria-label={localize(presentation.title, locale)} data-page-section>
        {presentation.metrics.map((item) => (
          <article className="demo-metric-card" key={localize(item.label, locale)}>
            <span>{localize(item.label, locale)}</span>
            <strong>{item.value}</strong>
            {item.note ? <small>{localize(item.note, locale)}</small> : null}
          </article>
        ))}
      </section>

      <section className="demo-two-column" data-page-section>
        <article className="panel demo-workflow-panel">
          <header className="panel-header">
            <div>
              <p className="sample-label">{labels.process}</p>
              <h2>{localize(module.title, locale)}</h2>
            </div>
          </header>
          <ol className="demo-workflow">
            {module.workflow.map((step, index) => (
              <li key={localize(step, locale)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{localize(step, locale)}</strong>
              </li>
            ))}
          </ol>
          {module.liveHref ? (
            <Link className="action-button action-button-primary demo-live-link" href={module.liveHref(locale)} prefetch>
              {labels.openWorkspace}
            </Link>
          ) : null}
        </article>

        <article className="panel demo-capability-panel">
          <header className="panel-header">
            <h2>{labels.capabilities}</h2>
          </header>
          <ul className="demo-capability-list">
            {module.features.map((feature) => (
              <li key={localize(feature, locale)}>
                <span aria-hidden="true">✓</span>
                <span>{localize(feature, locale)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel demo-table-panel" data-page-section>
        <header className="panel-header">
          <div>
            <p className="sample-label">{labels.recentActivity}</p>
            <h2>{localize(module.title, locale)}</h2>
          </div>
        </header>
        <div className="responsive-table" role="region" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {module.table.columns.map((column) => (
                  <th scope="col" key={localize(column, locale)}>
                    {localize(column, locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {module.table.rows.map((row, rowIndex) => (
                <tr key={`${module.id}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${module.id}-${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
