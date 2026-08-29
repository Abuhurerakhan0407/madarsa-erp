import type { Locale } from "@/lib/i18n/config";
import {
  demoUiCopy,
  localize,
  type DemoModule
} from "@/lib/demo/modules";

type DemoModulePageProps = {
  module: DemoModule;
  locale: Locale;
};

export function DemoModulePage({ module, locale }: DemoModulePageProps) {
  return (
    <>
      <section className="demo-module-heading">
        <div>
          <div className="demo-eyebrow-row">
            <span className="demo-module-code">{module.code}</span>
            <span className="demo-data-chip">{localize(demoUiCopy.demoData, locale)}</span>
          </div>
          <p className="state-kicker">{localize(demoUiCopy.scenario, locale)}</p>
          <h1>{localize(module.title, locale)}</h1>
          <p>{localize(module.description, locale)}</p>
        </div>
        <a className="action-button" href={`/${locale}/demo`}>
          {localize(demoUiCopy.backToModules, locale)}
        </a>
      </section>

      <section className="demo-metric-grid" aria-label={localize(module.title, locale)}>
        {module.metrics.map((item) => (
          <article className="demo-metric-card" key={localize(item.label, locale)}>
            <span>{localize(item.label, locale)}</span>
            <strong>{item.value}</strong>
            {item.note ? <small>{localize(item.note, locale)}</small> : null}
          </article>
        ))}
      </section>

      <section className="demo-two-column">
        <article className="panel demo-workflow-panel">
          <header className="panel-header">
            <div>
              <p className="sample-label">{localize(demoUiCopy.workflow, locale)}</p>
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
          {module.liveHref && module.liveLabel ? (
            <a className="action-button action-button-primary demo-live-link" href={module.liveHref(locale)}>
              {localize(module.liveLabel, locale)}
            </a>
          ) : null}
        </article>

        <article className="panel demo-capability-panel">
          <header className="panel-header">
            <h2>{localize(demoUiCopy.capabilities, locale)}</h2>
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

      <section className="panel demo-table-panel">
        <header className="panel-header">
          <div>
            <p className="sample-label">{localize(demoUiCopy.demoData, locale)}</p>
            <h2>{localize(demoUiCopy.activity, locale)}</h2>
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
