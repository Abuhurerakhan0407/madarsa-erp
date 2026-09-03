import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAttendanceV2Section } from "@/components/portal-attendance-v2-section";
import { PortalNotificationCenter } from "@/components/portal-notification-center";
import { PortalParentPriorityOverview } from "@/components/portal-parent-priority-overview";
import { SignOutButton } from "@/components/sign-out-button";
import { getPortalNotificationCenter } from "@/lib/notifications/portal";
import { getPortalHome } from "@/lib/portal/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

export const metadata:Metadata={title:"Parent & Teacher Portal | Madarsa ERP"};
type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};
const rows=(value:unknown):Raw[]=>Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)) as Raw[]:[];
const text=(value:unknown)=>typeof value==="string"?value:"";
const num=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;

export default async function PortalPage({searchParams}:{searchParams:Promise<{tenant?:string}>}){
 const identity=await getVerifiedIdentity();if(!identity)redirect("/login?next=%2Fportal");
 const admin=createAdminClient();const current=await admin.auth.admin.getUserById(identity.id);if(current.error||!current.data.user)throw new Error("Unable to load portal account.");if(current.data.user.user_metadata?.must_change_password===true)redirect("/portal/change-password");
 const{data:linkRows,error:linkError}=await admin.from("identity_person_links").select("tenant_id,person_id,link_type").eq("identity_id",identity.id).eq("status","verified");if(linkError)throw new Error(`Unable to load portal accounts: ${linkError.message}`);
 const links=linkRows??[];const tenantIds=[...new Set(links.map((row)=>Number(row.tenant_id)).filter((id)=>Number.isInteger(id)&&id>0))];
 if(tenantIds.length===0)return <section className="professional-card" style={{maxWidth:720,margin:"8vh auto 0"}}><p className="state-kicker">Parent & Teacher Portal</p><h1>No portal access linked yet</h1><p>Sign in is working, but this account has not been linked to a verified guardian or teacher record.</p><Link className="action-button action-button-primary" href="/portal/claim">Activate an access code</Link></section>;
 const params=await searchParams;const requested=Number(params.tenant);if(!Number.isInteger(requested)||!tenantIds.includes(requested)){if(tenantIds.length===1)redirect(`/portal?tenant=${tenantIds[0]}`);}
 const tenantId=Number.isInteger(requested)&&tenantIds.includes(requested)?requested:tenantIds[0];
 const[{data:tenants,error:tenantError},home,notifications]=await Promise.all([admin.from("tenants").select("id,name").in("id",tenantIds),getPortalHome(tenantId),getPortalNotificationCenter(tenantId)]);if(tenantError)throw new Error(`Unable to load institution: ${tenantError.message}`);
 const currentTenant=tenants?.find((item)=>Number(item.id)===tenantId);const children=rows(home.children);const employee=object(home.employee);const notices=rows(home.notices);const portalLinks=rows(home.links);const overview=object(home.overview);const guardianView=portalLinks.some(link=>text(link.link_type)==="guardian");
 return <div className="flow-stack">
  <header className="professional-card"><div className="section-heading"><div><p className="state-kicker">Secure self-service portal</p><h1>{currentTenant?.name??"Madarsa ERP"}</h1><p>{portalLinks.map((link)=>`${text(link.display_name)} · ${text(link.link_type)}`).join(" · ")}</p></div><SignOutButton label="Sign out" initials="ME" title={identity.email??"Portal account"}/></div>{tenantIds.length>1?<nav aria-label="Portal institutions" style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:16}}>{tenants?.map((tenant)=><Link className="action-button" key={tenant.id} href={`/portal?tenant=${tenant.id}`}>{tenant.name}</Link>)}</nav>:null}</header>
  {guardianView?<PortalParentPriorityOverview tenantId={tenantId} overview={overview} children={children} attendance={<PortalAttendanceV2Section tenantId={tenantId}/>}/>:null}
  <PortalNotificationCenter tenantId={tenantId} initial={notifications}/>
  {Object.keys(employee).length>0?<section className="professional-card"><p className="state-kicker">Teacher view</p><h2>{text(employee.display_name)}</h2><p>{text(employee.employee_number)} · {text(employee.designation)||"Teacher"}</p><div className="demo-card-grid"><article className="demo-card"><h3>Recent attendance</h3>{rows(employee.recent_attendance).map((item)=><p key={text(item.attendance_date)}>{text(item.attendance_date)} · {text(item.status)}</p>)}</article><article className="demo-card"><h3>Leave history</h3>{rows(employee.recent_leave).map((item,index)=><p key={`${text(item.starts_on)}:${index}`}>{text(item.starts_on)} → {text(item.ends_on)} · {text(item.state)}</p>)}</article></div></section>:null}
  <section className="professional-card"><div className="section-heading"><div><p className="state-kicker">Institution notices</p><h2>Notice archive</h2></div><Link className="action-button" href="/portal/claim">Activate another code</Link></div>{notices.length===0?<p>No published portal notices.</p>:<div className="flow-stack">{notices.map((notice)=><article className="demo-card" key={num(notice.id)}><p className="state-kicker">{text(notice.audience_type)}</p><h3>{text(object(notice.labels).en)}</h3><p>{text(object(notice.body).en)}</p><small>{text(notice.published_at)?new Date(text(notice.published_at)).toLocaleString():""}</small></article>)}</div>}</section>
 </div>;
}
