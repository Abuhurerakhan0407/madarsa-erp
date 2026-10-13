import { cookies } from "next/headers";
import { ResetPasswordForm } from "@/components/reset-password-form";
import type { SupportedLocale } from "@/lib/i18n/config";

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  const locale: SupportedLocale =
    cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "ur";

  return <ResetPasswordForm initialLocale={locale} />;
}
