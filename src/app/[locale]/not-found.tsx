import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("State");

  return (
    <section className="state-panel">
      <p className="state-kicker">{t("notFoundKicker")}</p>
      <h1>{t("notFoundTitle")}</h1>
      <p>{t("notFoundBody")}</p>
      <Link className="action-button action-button-primary" href="/">
        {t("returnDashboard")}
      </Link>
    </section>
  );
}
