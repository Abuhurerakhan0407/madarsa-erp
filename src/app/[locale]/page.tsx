import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { QuickActionDialog } from "@/components/quick-action-dialog";

const attendance = [
  { key: "hifz", value: 88 },
  { key: "nazra", value: 82 },
  { key: "dars", value: 76 },
  { key: "school", value: 91 }
] as const;

export default async function DashboardPage() {
  const [app, t] = await Promise.all([
    getTranslations("App"),
    getTranslations("Dashboard")
  ]);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="sample-label">{app("sampleData")}</p>
          <h1>{app("welcome")}</h1>
          <p>{app("subtitle")}</p>
        </div>
        <time>{t("today")}</time>
      </section>

      <section aria-labelledby="quick-actions-title" className="quick-actions-section">
        <h2 id="quick-actions-title">{t("quickActions")}</h2>
        <div className="quick-actions">
          <button type="button" className="action-button action-button-primary">
            {t("takeAttendance")}
          </button>
          <QuickActionDialog
            buttonLabel={t("newAdmission")}
            cancelLabel={t("cancel")}
            description={t("documentBody")}
            nameLabel={t("studentName")}
            submitLabel={t("newAdmission")}
            title={t("newAdmission")}
          />
          <button type="button" className="action-button">
            {t("recordFee")}
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label={t("today")}>
        <article className="metric metric-primary">
          <span>{t("present")}</span>
          <strong>426</strong>
          <small>{t("studentCount")}</small>
        </article>
        <article className="metric">
          <span>{t("feesReceived")}</span>
          <strong>₹84,250</strong>
          <small>{t("today")}</small>
        </article>
        <article className="metric">
          <span>{t("pendingReviews")}</span>
          <strong>7</strong>
          <small>{t("dueToday")}</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <header className="panel-header">
            <h2>{t("attendanceByProgram")}</h2>
            <span>{app("sampleData")}</span>
          </header>
          <div className="bar-chart" role="img" aria-label={t("attendanceByProgram")}>
            {attendance.map((item) => (
              <div className="bar-row" key={item.key}>
                <span>{t(item.key)}</span>
                <div className="bar-value" style={{ "--bar-size": `${item.value}%` } as CSSProperties}>
                  <span>{item.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel task-panel">
          <header className="panel-header">
            <h2>{t("recentTasks")}</h2>
          </header>
          <table>
            <thead>
              <tr>
                <th scope="col">{t("recentTasks")}</th>
                <th scope="col">{t("today")}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>{t("taskAdmission")}</td><td>{t("dueToday")}</td></tr>
              <tr><td>{t("taskResults")}</td><td>{t("dueToday")}</td></tr>
              <tr><td>{t("taskReceipts")}</td><td>{t("dueTomorrow")}</td></tr>
            </tbody>
          </table>
        </article>
      </section>

      <section className="document-preview" aria-labelledby="document-title">
        <div>
          <p>{t("documentPreview")}</p>
          <h2 id="document-title">{t("documentTitle")}</h2>
          <p>{t("documentBody")}</p>
        </div>
        <div className="multilingual-type-sample">
          <p lang="en">Knowledge with character</p>
          <p lang="ur">علم کے ساتھ کردار</p>
          <p lang="ar">العلم مع الأخلاق</p>
        </div>
      </section>
    </>
  );
}
