import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n/config";

type PageProps={params:Promise<{locale:string}>};

export default async function OperationsDemoRedirect({params}:PageProps){
 const{locale:rawLocale}=await params;
 const locale=(routing.locales.includes(rawLocale as Locale)?rawLocale:"en") as Locale;
 redirect(`/${locale}/students/lifecycle`);
}
