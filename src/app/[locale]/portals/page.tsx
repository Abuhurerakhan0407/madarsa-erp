import type {Metadata} from "next";
import {PortalAdminCenter} from "@/components/portal-admin-center";
import {getPortalOperatorCenter} from "@/lib/portal/runtime";

export const metadata:Metadata={title:"Parent & Teacher Access | Ilmgaah"};
export default async function PortalsPage({searchParams}:{searchParams:Promise<{tab?:string}>}){const query=await searchParams;const initialTab=query.tab==="teachers"?"teachers":"parents";const center=await getPortalOperatorCenter();return <div className="flow-stack"><header className="page-header professional-page-header"><div><p className="state-kicker">People & access</p><h1>Parent & Teacher Access</h1><p>Manage portal logins without exposing role administration or private HR data. Access changes apply only to this institution.</p></div></header><PortalAdminCenter center={center} initialTab={initialTab}/></div>;}
