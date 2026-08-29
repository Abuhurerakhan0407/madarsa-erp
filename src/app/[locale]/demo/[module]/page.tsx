import { notFound } from "next/navigation";
import { DemoModulePage } from "@/components/demo-module-page";
import type { Locale } from "@/lib/i18n/config";
import { getDemoModule } from "@/lib/demo/modules";

type DemoModuleRouteProps = {
  params: Promise<{ locale: string; module: string }>;
};

export default async function DemoModuleRoute({ params }: DemoModuleRouteProps) {
  const { locale, module } = await params;
  const typedLocale = (locale === "ur" || locale === "ar" ? locale : "en") as Locale;
  const definition = getDemoModule(module);

  if (!definition) {
    notFound();
  }

  return <DemoModulePage module={definition} locale={typedLocale} />;
}
