import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { WorkspaceState } from "@/components/workspace-ui";
import type { Locale } from "@/lib/i18n/config";

type ForbiddenPageProps = { params: Promise<{ locale: string }> };

const backLabel: Record<Locale, string> = {
  en: "Back to overview",
  ur: "جائزہ پر واپس جائیں",
  ar: "العودة إلى النظرة العامة"
};

export default async function ForbiddenPage({ params }: ForbiddenPageProps) {
  const [{ locale: rawLocale }, t] = await Promise.all([params, getTranslations("Dashboard")]);
  const locale = (rawLocale === "ur" || rawLocale === "ar" ? rawLocale : "en") as Locale;

  return (
    <WorkspaceState
      code="403"
      title={t("forbiddenTitle")}
      body={t("forbiddenBody")}
      action={<Link className="action-button action-button-primary" href={`/${locale}`}>{backLabel[locale]}</Link>}
    />
  );
}
