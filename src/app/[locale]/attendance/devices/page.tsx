import {redirect} from "next/navigation";
import type {SupportedLocale} from "@/lib/i18n/config";

export default async function LegacyAttendanceDevicesPage({params}:{params:Promise<{locale:string}>}){const{locale:raw}=await params;const locale:SupportedLocale=raw==="ur"?"ur":"en";redirect(`/${locale}/settings/configuration/attendance-devices`);}
