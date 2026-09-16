import type { Metadata } from "next";
import { PortalAdminCenter } from "@/components/portal-admin-center";
import { getDirection, type SupportedLocale } from "@/lib/i18n/config";
import { getPortalOperatorCenter } from "@/lib/portal/runtime";

export const metadata: Metadata = { title: "Parent & Teacher Access | Ilmgaah" };

const copy = {
  en: {
    kicker: "People & access",
    title: "Parent & Teacher Access",
    body: "Manage portal logins without exposing role administration or private HR data. Access changes apply only to this institution."
  },
  ur: {
    kicker: "افراد اور رسائی",
    title: "والدین اور اساتذہ کی رسائی",
    body: "رول ایڈمنسٹریشن یا نجی HR معلومات ظاہر کیے بغیر پورٹل لاگ اِن منظم کریں۔ رسائی کی تبدیلیاں صرف اسی ادارے پر لاگو ہوتی ہیں۔"
  }
} as const;

export default async function PortalsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ locale: rawLocale }, query] = await Promise.all([params, searchParams]);
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  const initialTab = query.tab === "teachers" ? "teachers" : "parents";
  const center = await getPortalOperatorCenter();
  const t = copy[locale];

  return (
    <div className="flow-stack" lang={locale} dir={getDirection(locale)}>
      <header className="page-header professional-page-header">
        <div>
          <p className="state-kicker">{t.kicker}</p>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
        </div>
      </header>
      <PortalAdminCenter center={center} initialTab={initialTab} locale={locale} />
    </div>
  );
}
