import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { routing } from "@/i18n/routing";
import { getDirection, type Locale } from "@/lib/i18n/config";
import { getAppFontVariables } from "@/lib/i18n/fonts";
import { getTenantContext } from "@/lib/tenancy/context";
import "../globals.css";
import "../demo.css";
import "../professional.css";
import "../professional-flows.css";

export const metadata: Metadata = {
  title: {
    default: "Madarsa ERP",
    template: "%s | Madarsa ERP"
  },
  description: "Multi-tenant operating system for Madrasas and Islamic institutions.",
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

  const workspace = await getTenantContext();

  if (!workspace) {
    redirect("/onboarding");
  }

  const typedLocale = locale as Locale;
  const messages = await getMessages();

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
