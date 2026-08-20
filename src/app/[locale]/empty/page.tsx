import { getTranslations } from "next-intl/server";

export default async function EmptyPage() {
  const t = await getTranslations("Dashboard");

  return (
    <section className="state-panel">
      <p className="state-kicker">0</p>
      <h1>{t("emptyTitle")}</h1>
      <p>{t("emptyBody")}</p>
    </section>
  );
}
