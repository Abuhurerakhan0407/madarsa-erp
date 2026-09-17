import type { Metadata } from "next";
import { PortalAdminCenter } from "@/components/portal-admin-center";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getPortalOperatorCenter } from "@/lib/portal/runtime";

export const metadata: Metadata = { title: "Parent & Teacher Access | Ilmgaah" };

const copy = {
  en: {
    kicker: "People & access",
    title: "Parent & Teacher Access",
    body: "Create and manage secure parent and teacher portal access without exposing private HR or unrelated institution data."
  },
  ur: {
    kicker: "افراد اور رسائی",
    title: "والدین اور اساتذہ رسائی",
    body: "نجی HR یا غیر متعلقہ ادارہ ڈیٹا ظاہر کیے بغیر والدین اور اساتذہ کی محفوظ پورٹل رسائی بنائیں اور منظم کریں۔"
  }
} as const;

export default async function PortalsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ locale: rawLocale }, query] = await Promise.all([params, searchParams]);
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  const initialTab = query.tab === "teachers" ? "teachers" : "parents";
  const center = await getPortalOperatorCenter();
  const t = copy[locale];

  return (
    <div className="flow-stack">
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
