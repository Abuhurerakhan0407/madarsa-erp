"use client";

import { useTranslations } from "next-intl";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  const t = useTranslations("State");

  return (
    <section className="state-panel" role="alert">
      <p className="state-kicker">{t("errorKicker")}</p>
      <h1>{t("errorTitle")}</h1>
      <p>{t("errorBody")}</p>
      <button className="action-button action-button-primary" onClick={reset} type="button">
        {t("tryAgain")}
      </button>
    </section>
  );
}
