import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { WorkspaceState } from "@/components/workspace-ui";

type ForbiddenPageProps = { params: Promise<{ locale: string }> };

export default async function ForbiddenPage({ params }: ForbiddenPageProps) {
  const [{ locale }, t] = await Promise.all([params, getTranslations("Dashboard")]);

  return (
    <WorkspaceState
      code="403"
      title={t("forbiddenTitle")}
      body={t("forbiddenBody")}
      action={<Link className="action-button action-button-primary" href={`/${locale}`}>{t("requestAccess")}</Link>}
    />
  );
}
