import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { WorkspacePageHeader } from "@/components/workspace-ui";
import { getGuidedSetupSnapshot } from "@/lib/configuration/setup-readiness";
import type { ConfigurationLocale } from "@/lib/configuration/model";
import { getNavigationAudience } from "@/lib/navigation/audience";
import { getTenantContext } from "@/lib/tenancy/context";

type SetupPageProps = { params: Promise<{ locale: string }> };

const headerCopy: Record<ConfigurationLocale, { eyebrow: string; title: string; body: string; back: string }> = {
  en: {
    eyebrow: "Institution setup",
    title: "Finish the essentials, then start working",
    body: "This guide uses the same institution, academic and student records as the rest of Ilmgaah—nothing is duplicated.",
    back: "Back to dashboard"
  },
  ur: {
    eyebrow: "ادارہ سیٹ اپ",
    title: "بنیادی چیزیں مکمل کریں، پھر کام شروع کریں",
    body: "یہ گائیڈ Ilmgaah کے انہی ادارہ، تعلیمی اور طلبہ ریکارڈز کو استعمال کرتی ہے—کوئی متوازی نظام نہیں۔",
    back: "ڈیش بورڈ پر واپس"
  },
  ar: {
    eyebrow: "إعداد المؤسسة",
    title: "أكمل الأساسيات ثم ابدأ العمل",
    body: "يستخدم هذا الدليل نفس سجلات المؤسسة والدراسة والطلاب في Ilmgaah دون إنشاء نظام موازٍ.",
    back: "العودة إلى لوحة التحكم"
  }
};

export default async function SetupPage({ params }: SetupPageProps) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale === "ur" || rawLocale === "ar" ? rawLocale : "en") as ConfigurationLocale;
  const workspace = await getTenantContext();
  if (!workspace) redirect("/onboarding");
  const audience = await getNavigationAudience(workspace);
  if (audience !== "office") redirect(`/${locale}/forbidden`);

  const snapshot = await getGuidedSetupSnapshot(locale);
  const text = headerCopy[locale];

  return (
    <>
      <WorkspacePageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.body}
        actions={[{ label: text.back, href: `/${locale}` }]}
      />
      <SetupWizard locale={locale} snapshot={snapshot} />
      <section className="configuration-section" data-page-section>
        <Link className="action-button" href={`/${locale}/settings/configuration`}>
          {locale === "ur" ? "اعلیٰ کنفیگریشن" : locale === "ar" ? "الإعدادات المتقدمة" : "Advanced configuration"}
        </Link>
      </section>
    </>
  );
}
