import type { Metadata } from "next";
import { PortalAdminCenter } from "@/components/portal-admin-center";
import { getPortalOperatorCenter } from "@/lib/portal/runtime";

export const metadata:Metadata={title:"Parent & Staff Portals"};
export default async function PortalsPage(){const center=await getPortalOperatorCenter();return <div className="flow-stack"><header className="page-header professional-page-header"><div><p className="state-kicker">Campus operations</p><h1>Parent & Staff Portals</h1><p>Issue verified portal access, review activation status, and publish portal notices. Access codes never create staff permissions.</p></div></header><PortalAdminCenter center={center}/></div>;}
