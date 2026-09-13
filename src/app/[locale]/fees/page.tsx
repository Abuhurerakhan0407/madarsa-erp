import {notFound} from "next/navigation";
import {StudentFeesWorkspace} from "@/components/student-fees-workspace";
import {routing} from "@/i18n/routing";
import type {Locale} from "@/lib/i18n/config";
import {getStudentFeeWorkspace} from "@/lib/finance/workspace";

export default async function FeesPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{student?:string|string[]}>}){
 const{locale}=await params;if(!routing.locales.includes(locale as Locale))notFound();
 const query=await searchParams;const raw=Array.isArray(query.student)?query.student[0]:query.student;const parsed=Number(raw);const studentPersonId=Number.isSafeInteger(parsed)&&parsed>0?parsed:null;
 const workspace=await getStudentFeeWorkspace(studentPersonId);
 return <StudentFeesWorkspace locale={locale} workspace={workspace}/>;
}
