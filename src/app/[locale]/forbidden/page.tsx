import { getTranslations } from "next-intl/server";

export default async function ForbiddenPage() {
  const t = await getTranslations("Dashboard");

  return (
    <section className="state-panel">
      <p className="state-kicker">403</p>
      <h1>{t("forbiddenTitle")}</h1>
      <p>{t("forbiddenBody")}</p>
      <button className="action-button action-button-primary" type="button">
        {t("requestAccess")}
      </button>
    </section>
  );
}
