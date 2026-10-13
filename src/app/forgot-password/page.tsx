import { cookies } from "next/headers";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import type { SupportedLocale } from "@/lib/i18n/config";

export default async function ForgotPasswordPage() {
  const cookieStore = await cookies();
  const locale: SupportedLocale =
    cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "ur";

  return <ForgotPasswordForm initialLocale={locale} />;
}
