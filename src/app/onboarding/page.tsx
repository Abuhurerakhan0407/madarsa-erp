import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getDirection, type SupportedLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

const copy = {
  en: {
    brand: "Ilmgaah",
    secure: "Secure institution setup",
    kicker: "Workspace setup",
    title: "Create your institution foundation",
    body: "This creates your isolated institution, first branch, owner access and governed role permissions.",
    language: "Language"
  },
  ur: {
    brand: "Ilmgaah",
    secure: "محفوظ ادارہ سیٹ اپ",
    kicker: "ورک اسپیس سیٹ اپ",
    title: "اپنے ادارے کی بنیاد بنائیں",
    body: "یہ آپ کا الگ ادارہ، پہلی برانچ، مالک کی رسائی اور منظم رول اجازتیں ایک ساتھ بناتا ہے۔",
    language: "زبان"
  }
} as const;

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ locale?: string | string[] }>;
}) {
  const params = await searchParams;
  const locale: SupportedLocale = params.locale === "ur" ? "ur" : "en";
  const identity = await getVerifiedIdentity();

  if (!identity) {
    redirect("/login?next=" + encodeURIComponent(`/onboarding?locale=${locale}`));
  }

  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("identity_id", identity.id)
    .eq("status", "active")
    .limit(1);

  if (error) throw new Error(`Unable to read account membership: ${error.message}`);
  if (memberships?.length) redirect(`/${locale}`);

  const t = copy[locale];
  return (
    <main className="onboarding-screen" lang={locale} dir={getDirection(locale)}>
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <header className="onboarding-header">
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true">I</span>
            <div>
              <strong>{t.brand}</strong>
              <span>{t.secure}</span>
            </div>
          </div>
          <nav className="locale-switcher" aria-label={t.language}>
            <Link className="locale-link" aria-current={locale === "en" ? "page" : undefined} href="/onboarding?locale=en">English</Link>
            <Link className="locale-link" aria-current={locale === "ur" ? "page" : undefined} href="/onboarding?locale=ur">اردو</Link>
          </nav>
          <div>
            <p className="state-kicker">{t.kicker}</p>
            <h1 id="onboarding-title">{t.title}</h1>
            <p>{t.body}</p>
          </div>
        </header>
        <OnboardingForm email={identity.email} locale={locale} />
      </section>
    </main>
  );
}
