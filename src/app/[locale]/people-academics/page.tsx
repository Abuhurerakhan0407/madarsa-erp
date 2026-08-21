import { getTranslations } from "next-intl/server";
import { getAcademicFoundationSummary } from "@/lib/academics/live-summary";

const foundationModules = [
  "people",
  "relationships",
  "sessions",
  "programs",
  "enrollment",
  "timetable",
  "documents",
  "portals"
] as const;

type PeopleAcademicsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PeopleAcademicsPage({ params }: PeopleAcademicsPageProps) {
  const { locale } = await params;
  const [t, dashboard, summary] = await Promise.all([
    getTranslations("PeopleAcademics"),
    getTranslations("Dashboard"),
    getAcademicFoundationSummary(locale)
  ]);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="state-kicker">{t("phase")}</p>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
      </section>

      <section className="metric-grid" aria-label={t("programsTitle")}>
        <article className="metric metric-primary">
          <span>{t("session")}</span>
          <strong>{summary.sessions}</strong>
        </article>
        <article className="metric">
          <span>{t("program")}</span>
          <strong>{summary.programs}</strong>
        </article>
        <article className="metric">
          <span>{t("level")}</span>
          <strong>{summary.levels}</strong>
        </article>
        <article className="metric">
          <span>{t("group")}</span>
          <strong>{summary.groups}</strong>
        </article>
        <article className="metric">
          <span>{t("enrollment")}</span>
          <strong>{summary.activeEnrollments}</strong>
          <small>{summary.uniqueStudents} {t("students")}</small>
        </article>
      </section>

      <section className="foundation-module-grid" aria-labelledby="foundation-title">
        <header className="section-heading foundation-heading">
          <div>
            <p>{t("governedFoundation")}</p>
            <h2 id="foundation-title">{t("modulesTitle")}</h2>
          </div>
          <span>{t("modulesCount", { count: foundationModules.length })}</span>
        </header>
        <div className="configuration-module-grid">
          {foundationModules.map((module) => (
            <article className="configuration-module-card" key={module}>
              <h3>{t(`modules.${module}.title`)}</h3>
              <p>{t(`modules.${module}.body`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="people-academics-grid">
        <article className="panel academic-structure-panel">
          <header className="panel-header">
            <div>
              <p>{t("structureKicker")}</p>
              <h2>{t("structureTitle")}</h2>
            </div>
          </header>
          <div className="structure-flow" aria-label={t("structureTitle")}>
            <span>{t("session")}</span>
            <span aria-hidden="true">→</span>
            <span>{t("program")}</span>
            <span aria-hidden="true">→</span>
            <span>{t("level")}</span>
            <span aria-hidden="true">→</span>
            <span>{t("group")}</span>
            <span aria-hidden="true">→</span>
            <span>{t("enrollment")}</span>
          </div>

          {summary.programRows.length > 0 ? (
            <div className="responsive-table" role="region" aria-label={t("programsTitle")} tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t("program")}</th>
                    <th scope="col">{t("groups")}</th>
                    <th scope="col">{t("students")}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.programRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      <td>{row.groups}</td>
                      <td>{row.students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="privacy-callout">
              <strong>{dashboard("emptyTitle")}</strong>
              <p>{dashboard("emptyBody")}</p>
            </div>
          )}
        </article>

        <article className="panel relationship-panel">
          <header className="panel-header">
            <div>
              <p>{t("privacyKicker")}</p>
              <h2>{t("relationshipsTitle")}</h2>
            </div>
          </header>
          <ol className="workflow-preview relationship-steps">
            <li>{t("relationshipSteps.record")}</li>
            <li>{t("relationshipSteps.verify")}</li>
            <li>{t("relationshipSteps.restrict")}</li>
            <li>{t("relationshipSteps.link")}</li>
          </ol>
          <div className="privacy-callout">
            <strong>{t("privacyTitle")}</strong>
            <p>{t("privacyBody")}</p>
          </div>
        </article>
      </section>
    </>
  );
}
