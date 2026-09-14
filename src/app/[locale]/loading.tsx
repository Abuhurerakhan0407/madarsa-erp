import { getTranslations } from "next-intl/server";

export default async function WorkspaceLoading() {
  const t = await getTranslations("State");

  return (
    <div className="client-v2-loading route-loading-state" role="status" aria-busy="true" aria-live="polite" aria-label={t("loading")}>
      <div className="route-loading" aria-hidden="true">
        <div className="route-loading-track"><span /></div>
        <div className="route-loading-pill">
          <span className="inline-spinner" />
          <span className="route-loading-label" />
        </div>
      </div>
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
