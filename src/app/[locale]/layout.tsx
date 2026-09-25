import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { routing } from "@/i18n/routing";
import { getDirection, type SupportedLocale } from "@/lib/i18n/config";
import { getAppFontVariables } from "@/lib/i18n/fonts";
import { getTenantContext } from "@/lib/tenancy/context";
import "../globals.css";
import "../professional.css";
import "../professional-flows.css";
import "../hr.css";
import "../reports.css";
import "../documents.css";
import "../dashboard.css";
import "../client-v2.css";
import "../client-v2-polish.css";
import "../quran-v2.css";
import "../academics-v2.css";

export const metadata: Metadata = {
  title: {
    default: "Ilmgaah",
    template: "%s | Ilmgaah"
  },
  description: "Ilmgaah institution operating system for madrasas and Islamic education.",
  other: {
    google: "notranslate"
  }
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [workspace, messages] = await Promise.all([
    getTenantContext(),
    getMessages()
  ]);

  if (!workspace) {
    redirect("/onboarding");
  }

  const typedLocale = locale as SupportedLocale;

  return (
    <html lang={typedLocale} dir={getDirection(typedLocale)} translate="no" suppressHydrationWarning>
      <body className={getAppFontVariables(typedLocale)}>
        <NextIntlClientProvider messages={messages}>
          <AppShell locale={typedLocale} workspace={workspace}>
            {children}
          </AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
