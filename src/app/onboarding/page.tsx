import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getDirection, type SupportedLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { isTransientWorkspaceError } from "@/lib/tenancy/context";

const copy = {
  en: {
    brand: "Secure institution setup",
    kicker: "Workspace setup",
    title: "Create your institution foundation",
    body: "This creates your isolated institution workspace, first branch, owner access, and governed role permissions."
  },
  ur: {
    brand: "محفوظ ادارہ سیٹ اپ",
    kicker: "ورک اسپیس سیٹ اپ",
    title: "اپنے ادارے کی بنیاد بنائیں",
    body: "یہ آپ کا الگ ادارہ ورک اسپیس، پہلی برانچ، مالک کی رسائی اور محفوظ رول اجازتیں بناتا ہے۔"
  }
} as const;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readActiveMembership(identityId: string) {
  const supabase = await createClient();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("identity_id", identityId)
      .eq("status", "active")
      .limit(1);

    if (!error) return data ?? [];

    const failure = new Error(`Unable to read account membership: ${error.message}`);
    if (!isTransientWorkspaceError(failure) || attempt === 2) throw failure;
    await wait(140 * (attempt + 1));
  }

  return [];
}

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ locale?: string | string[] }>;
}) {
  const query = await searchParams;
  const locale: SupportedLocale = query.locale === "ur" ? "ur" : "en";
  const text = copy[locale];
  const identity = await getVerifiedIdentity();
  const destination = `/onboarding?locale=${locale}`;

  if (!identity) {
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

  const memberships = await readActiveMembership(identity.id);

  if (memberships.length) {
    redirect(`/${locale}`);
  }

  return (
    <main className="onboarding-screen" lang={locale} dir={getDirection(locale)}>
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <header className="onboarding-header">
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true">I</span>
            <div>
              <strong>Ilmgaah</strong>
              <span>{text.brand}</span>
            </div>
          </div>
          <div>
            <p className="state-kicker">{text.kicker}</p>
            <h1 id="onboarding-title">{text.title}</h1>
            <p>{text.body}</p>
          </div>
        </header>

        <OnboardingForm email={identity.email} locale={locale} />
      </section>
    </main>
  );
}
