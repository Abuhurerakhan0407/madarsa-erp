import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { routing } from "@/i18n/routing";
import { getDirection, type Locale } from "@/lib/i18n/config";
import { getTenantContext } from "@/lib/tenancy/context";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap"
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap"
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-naskh-arabic",
  subsets: ["arabic"],
  display: "swap"
});

const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq-urdu",
  subsets: ["arabic"],
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Madarsa ERP",
    template: "%s | Madarsa ERP"
  },
  description: "Multi-tenant operating system for Madrasas and Islamic institutions."
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
    <html lang={typedLocale} dir={getDirection(typedLocale)} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoNaskhArabic.variable} ${notoNastaliqUrdu.variable}`}
      >
        <NextIntlClientProvider messages={messages}>
          <AppShell locale={typedLocale} workspace={workspace}>
            {children}
          </AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
