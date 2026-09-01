import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { routing } from "@/lib/i18n/routing";

export default async function LegacyAcademicsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  redirect(`/${locale}/people-academics`);
}
