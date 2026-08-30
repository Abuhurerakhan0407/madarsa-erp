import { getTranslations } from "next-intl/server";
import { getAcademicFoundationSummary } from "@/lib/academics/live-summary";

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
      <section className="page-heading" data-page-section>
        <div>
          <p className="state-kicker">{t("phase")}</p>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
      </section>

      <section className="metric-grid student-metric-grid" aria-label={t("programsTitle")} data-page-section>
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

      <section className="panel academic-structure-panel" data-page-section>
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
      </section>
    </>
  );
}
