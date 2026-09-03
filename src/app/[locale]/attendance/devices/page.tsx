import {redirect} from "next/navigation";
import type {Locale} from "@/lib/i18n/config";

export default async function LegacyAttendanceDevicesPage({params}:{params:Promise<{locale:string}>}){const{locale:raw}=await params;const locale=(raw==="ur"||raw==="ar"?raw:"en") as Locale;redirect(`/${locale}/settings/configuration/attendance-devices`);}
