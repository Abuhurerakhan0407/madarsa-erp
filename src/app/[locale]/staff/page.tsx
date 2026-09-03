import type {Metadata} from "next";
import type {Locale} from "@/lib/i18n/config";
import {getTeachersWorkspace} from "@/lib/teachers/workspace";
import {TeachersWorkspaceView} from "@/components/teachers-workspace";

export const metadata:Metadata={title:"Teachers | Madarsa ERP"};
export default async function StaffPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{q?:string;state?:string}>}){
 const {locale:raw}=await params;const query=await searchParams;const locale=(raw==="ur"||raw==="ar"?raw:"en") as Locale;const search=(query.q??"").trim().slice(0,160);const state=["active","on_leave","suspended"].includes(query.state??"")?query.state??"":"";const data=await getTeachersWorkspace({search,state});return <TeachersWorkspaceView locale={locale} data={data} search={search} state={state}/>;
}
