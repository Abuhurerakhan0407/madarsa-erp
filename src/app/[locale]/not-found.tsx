import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { WorkspaceState } from "@/components/workspace-ui";

export default async function NotFound() {
  const t = await getTranslations("State");
  return <WorkspaceState code="404" eyebrow={t("notFoundKicker")} title={t("notFoundTitle")} body={t("notFoundBody")} action={<Link className="action-button action-button-primary" href="/">{t("returnDashboard")}</Link>} />;
}
