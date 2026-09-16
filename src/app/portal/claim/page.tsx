import type { Metadata } from "next";
import Link from "next/link";
import { PortalClaimForm } from "@/components/portal-claim-form";
import { getDirection } from "@/lib/i18n/config";
import { portalHref, resolvePortalLocale } from "@/lib/portal/locale";

export const metadata: Metadata = { title: "Activate portal access | Ilmgaah" };

const copy = {
  en: {
    kicker: "Parent & Teacher Portal",
    title: "Activate your access",
    body: "Use the one-time code given to you by the institution. Activating it links this signed-in account only to the verified guardian or teacher record prepared by the institution.",
    back: "Back to portal"
  },
  ur: {
    kicker: "والدین اور اساتذہ پورٹل",
    title: "اپنی رسائی فعال کریں",
    body: "ادارے کی طرف سے دیا گیا ایک بار استعمال ہونے والا کوڈ درج کریں۔ اسے فعال کرنے پر یہ سائن اِن اکاؤنٹ صرف ادارے کے تصدیق شدہ سرپرست یا استاد کے ریکارڈ سے منسلک ہوگا۔",
    back: "پورٹل پر واپس جائیں"
  }
} as const;

export default async function PortalClaimPage({ searchParams }: { searchParams: Promise<{ code?: string | string[]; locale?: string | string[] }> }) {
  const query = await searchParams;
  const locale = resolvePortalLocale(typeof query.locale === "string" ? query.locale : null);
  const code = typeof query.code === "string" ? query.code.toUpperCase() : "";
  const t = copy[locale];

  return (
    <section className="professional-card" lang={locale} dir={getDirection(locale)} style={{ maxWidth: 620, margin: "10vh auto 0" }}>
      <p className="state-kicker">{t.kicker}</p>
      <h1>{t.title}</h1>
      <p>{t.body}</p>
      <PortalClaimForm initialCode={code} locale={locale} />
      <p style={{ marginTop: 20 }}><Link href={portalHref("/portal", locale)}>{t.back}</Link></p>
    </section>
  );
}
