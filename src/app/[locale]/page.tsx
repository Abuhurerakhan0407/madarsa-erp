import { getTranslations } from "next-intl/server";
import { getDashboardSummary } from "@/lib/dashboard/summary";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const [app, t, summary] = await Promise.all([
    getTranslations("App"),
    getTranslations("Dashboard"),
    getDashboardSummary(locale)
  ]);

  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: summary.timeZone
  }).format(new Date());

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="state-kicker">{summary.displayName}</p>
          <h1>{summary.tenantName}</h1>
          <p>{app("subtitle")}</p>
        </div>
        <time dateTime={summary.dateKey}>{dateLabel}</time>
      </section>

      <section className="metric-grid" aria-label={t("today")}>
        <article className="metric metric-primary">
          <span>{t("studentCount")}</span>
          <strong>{summary.activeStudents}</strong>
        </article>
        <article className="metric">
          <span>{t("pendingReviews")}</span>
          <strong>{summary.pendingReviews}</strong>
          <small>{t("today")}</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel task-panel">
          <header className="panel-header">
            <h2>{t("recentTasks")}</h2>
          </header>

          {summary.pendingReviews > 0 ? (
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("recentTasks")}</th>
                  <th scope="col">{t("today")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t("pendingReviews")}</td>
                  <td>{summary.pendingReviews}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div>
              <strong>{t("emptyTitle")}</strong>
              <p>{t("emptyBody")}</p>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
