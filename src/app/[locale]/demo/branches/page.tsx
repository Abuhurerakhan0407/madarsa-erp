import { notFound,redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n/config";

export default async function LegacyBranchesPage({params}:{params:Promise<{locale:string}>}){
 const{locale}=await params;if(!routing.locales.includes(locale as Locale))notFound();redirect(`/${locale}/access`);
}
