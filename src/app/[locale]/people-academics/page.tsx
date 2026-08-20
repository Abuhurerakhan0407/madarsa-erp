import { getTranslations } from "next-intl/server";

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

const programRows = [
  { key: "general", groups: 8, students: 286 },
  { key: "hifz", groups: 4, students: 72 },
  { key: "nazra", groups: 3, students: 61 },
  { key: "dars", groups: 2, students: 38 }
] as const;

export default async function PeopleAcademicsPage() {
  const t = await getTranslations("PeopleAcademics");

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="sample-label">{t("phase")}</p>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <span className="status-pill status-complete">{t("foundationReady")}</span>
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
              <span className="status-pill status-complete">{t("ready")}</span>
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
            <span>{t("sample")}</span>
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
                {programRows.map((row) => (
                  <tr key={row.key}>
                    <td>{t(`programs.${row.key}`)}</td>
                    <td>{row.groups}</td>
                    <td>{row.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
