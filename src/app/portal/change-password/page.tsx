import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalPasswordChangeForm } from "@/components/portal-password-change-form";
import { getDirection } from "@/lib/i18n/config";
import { portalHref, resolvePortalLocale } from "@/lib/portal/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

export const metadata: Metadata = { title: "Change password | Ilmgaah" };

const copy = {
  en: {
    kicker: "Security required",
    title: "Set your own password",
    body: "Replace your temporary password before opening your parent or teacher portal."
  },
  ur: {
    kicker: "سیکیورٹی ضروری ہے",
    title: "اپنا پاس ورڈ مقرر کریں",
    body: "والدین یا استاد پورٹل کھولنے سے پہلے عارضی پاس ورڈ تبدیل کریں۔"
  }
} as const;

export default async function PortalChangePasswordPage({
  searchParams
}: {
  searchParams: Promise<{ locale?: string | string[]; tenant?: string | string[] }>;
}) {
  const params = await searchParams;
  const locale = resolvePortalLocale(typeof params.locale === "string" ? params.locale : null);
  const tenant = typeof params.tenant === "string" ? params.tenant : undefined;
  const next = portalHref("/portal/change-password", locale, { tenant });
  const identity = await getVerifiedIdentity();
  if (!identity) redirect(`/login?next=${encodeURIComponent(next)}`);

  const admin = createAdminClient();
  const current = await admin.auth.admin.getUserById(identity.id);
  if (current.error || !current.data.user) throw new Error("Unable to load portal account.");
  if (current.data.user.app_metadata?.must_change_password !== true) {
    redirect(portalHref("/portal", locale, { tenant }));
  }

  const t = copy[locale];
  return (
    <section
      className="professional-card portal-password-page"
      lang={locale}
      dir={getDirection(locale)}
    >
      <p className="state-kicker">{t.kicker}</p>
      <h1>{t.title}</h1>
      <p>{t.body}</p>
      <PortalPasswordChangeForm locale={locale} tenant={tenant} />
    </section>
  );
}
