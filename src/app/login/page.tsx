import { cookies } from "next/headers";
import { LoginForm } from "@/components/login-form";
import type { SupportedLocale } from "@/lib/i18n/config";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const locale: SupportedLocale =
    cookieStore.get("NEXT_LOCALE")?.value === "ur" ? "ur" : "en";

  return <LoginForm initialLocale={locale} />;
}
