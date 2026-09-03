import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("State");

  return (
    <div aria-busy="true" aria-live="polite" aria-label={t("loading")} className="client-v2-loading">
      <div className="skeleton skeleton-heading" />
      <div className="workspace-filter-bar" aria-hidden="true">
        <div className="skeleton" style={{ height: "2.875rem", flex: "1 1 10rem" }} />
        <div className="skeleton" style={{ height: "2.875rem", flex: "1 1 10rem" }} />
        <div className="skeleton" style={{ height: "2.875rem", flex: "1 1 10rem" }} />
      </div>
      <div className="skeleton skeleton-panel" />
    </div>
  );
}
