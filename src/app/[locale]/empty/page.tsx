import { getTranslations } from "next-intl/server";
import { WorkspaceState } from "@/components/workspace-ui";

export default async function EmptyPage() {
  const t = await getTranslations("Dashboard");

  return <WorkspaceState code="0" title={t("emptyTitle")} body={t("emptyBody")} />;
}
