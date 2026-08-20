import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("State");

  return (
    <div aria-busy="true" aria-label={t("loading")} className="loading-layout">
      <div className="skeleton skeleton-heading" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-metric" />
        <div className="skeleton skeleton-metric" />
        <div className="skeleton skeleton-metric" />
      </div>
      <div className="skeleton skeleton-panel" />
    </div>
  );
}
