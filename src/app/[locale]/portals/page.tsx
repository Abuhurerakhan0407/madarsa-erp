import type { Metadata } from "next";
import { PortalAdminCenter } from "@/components/portal-admin-center";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getPortalOperatorCenter } from "@/lib/portal/runtime";
import { requireOfficeAudience } from "@/lib/navigation/office-gate";

const copy: Record<SupportedLocale, {
  title: string;
  kicker: string;
  heading: string;
  body: string;
}> = {
  en: {
    title: "Parent & Teacher Access | Ilmgaah",
    kicker: "People & access",
    heading: "Parent & Teacher Access",
    body: "Manage parent and teacher portal access, credentials and institution notices without exposing unrelated HR or role-administration data."
  },
  ur: {
    title: "والدین و اساتذہ رسائی | علمگاہ",
    kicker: "افراد اور رسائی",
    heading: "والدین و اساتذہ رسائی",
    body: "غیر متعلقہ HR یا رول ایڈمن ڈیٹا ظاہر کیے بغیر والدین اور اساتذہ کی پورٹل رسائی، لاگ اِن اور ادارہ اطلاعات منظم کریں۔"
  }
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: SupportedLocale = rawLocale === "ur" ? "ur" : "en";
  return { title: copy[locale].title };
}

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
  await requireOfficeAudience(locale);
  const center = await getPortalOperatorCenter();
  const t = copy[locale];

  return (
    <div className="flow-stack">
      <header className="page-header professional-page-header">
        <div>
          <p className="state-kicker">{t.kicker}</p>
          <h1>{t.heading}</h1>
          <p>{t.body}</p>
        </div>
      </header>
      <PortalAdminCenter center={center} initialTab={initialTab} locale={locale} />
    </div>
  );
}
