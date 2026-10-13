import type { Metadata } from "next";
import { cookies } from "next/headers";
import { appFontVariables } from "@/lib/i18n/fonts";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getDirection } from "@/lib/i18n/config";
import "../globals.css";
import "../auth-flow.css";
import "../auth-professional.css";

export const metadata: Metadata = {
  title: "Reset password — Jamia Islamia",
  description: "Request a password recovery link for Jamia Islamia Uloomul Quraan workspace."
};

export default async function ForgotPasswordLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale: SupportedLocale =
    cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "ur";

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body className={appFontVariables}>{children}</body>
    </html>
  );
}
