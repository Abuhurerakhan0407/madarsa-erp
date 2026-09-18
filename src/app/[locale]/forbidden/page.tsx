import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { WorkspaceState } from "@/components/workspace-ui";
import type { SupportedLocale } from "@/lib/i18n/config";

type ForbiddenPageProps = { params: Promise<{ locale: string }> };

const backLabel: Record<SupportedLocale, string> = {
  en: "Back to overview",
  ur: "جائزہ پر واپس جائیں"
};

export default async function ForbiddenPage({ params }: ForbiddenPageProps) {
  const [{ locale: rawLocale }, t] = await Promise.all([params, getTranslations("Dashboard")]);
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";

  return (
    <WorkspaceState
      code="403"
      title={t("forbiddenTitle")}
      body={t("forbiddenBody")}
      action={<Link className="action-button action-button-primary" href={`/${locale}`}>{backLabel[locale]}</Link>}
    />
  );
}
