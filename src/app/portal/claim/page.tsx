import type { Metadata } from "next";
import Link from "next/link";
import { PortalClaimForm } from "@/components/portal-claim-form";

export const metadata:Metadata={title:"Activate portal access | Madarsa ERP"};
export default async function PortalClaimPage({searchParams}:{searchParams:Promise<{code?:string}>}){const{code}=await searchParams;return <section className="professional-card" style={{maxWidth:620,margin:"10vh auto 0"}}><p className="state-kicker">Parent & Staff Portal</p><h1>Activate your access</h1><p>Use the one-time code given to you by the institution. Activating it links this signed-in account only to the verified guardian or employee record prepared by the institution.</p><PortalClaimForm initialCode={typeof code==="string"?code.toUpperCase():""}/><p style={{marginTop:20}}><Link href="/portal">Back to portal</Link></p></section>;}
