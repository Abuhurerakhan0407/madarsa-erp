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
    body: "The temporary password has done its job. Replace it before opening the portal."
  },
  ur: {
    kicker: "سیکیورٹی ضروری ہے",
    title: "اپنا پاس ورڈ مقرر کریں",
    body: "عارضی پاس ورڈ کا کام مکمل ہو چکا ہے۔ پورٹل کھولنے سے پہلے اسے اپنے پاس ورڈ سے تبدیل کریں۔"
  }
} as const;

export default async function PortalChangePasswordPage({ searchParams }: { searchParams: Promise<{ locale?: string | string[]; tenant?: string | string[] }> }) {
  const query = await searchParams;
  const locale = resolvePortalLocale(typeof query.locale === "string" ? query.locale : null);
  const tenant = typeof query.tenant === "string" ? query.tenant : undefined;
  const destination = portalHref("/portal/change-password", locale, { tenant });
  const identity = await getVerifiedIdentity();
  if (!identity) redirect(`/login?next=${encodeURIComponent(destination)}`);

  const admin = createAdminClient();
  const current = await admin.auth.admin.getUserById(identity.id);
  if (current.error || !current.data.user) throw new Error("Unable to load portal account.");
  if (current.data.user.app_metadata?.must_change_password !== true) redirect(portalHref("/portal", locale, { tenant }));
  const t = copy[locale];

  return (
    <section className="professional-card" lang={locale} dir={getDirection(locale)} style={{ maxWidth: 640, margin: "8vh auto 0" }}>
      <p className="state-kicker">{t.kicker}</p>
      <h1>{t.title}</h1>
      <p>{t.body}</p>
      <PortalPasswordChangeForm locale={locale} tenant={tenant} />
    </section>
  );
}
