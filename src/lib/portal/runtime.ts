import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};
const rows=(value:unknown):Raw[]=>Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)) as Raw[]:[];
const text=(value:unknown):string|null=>typeof value==="string"&&value.trim()?value:null;
const number=(value:unknown):number|null=>Number.isFinite(Number(value))?Number(value):null;

export type PortalNoticePriority="normal"|"important"|"urgent";
export type PortalCandidate={personId:number;name:string;kind:"guardian"|"employee";linked:boolean;status:string;reference:string|null;lastCodeAt:string|null};
export type PortalAccessHistory={id:number;personId:number;name:string;linkType:"guardian"|"employee";state:string;expiresAt:string;claimedAt:string|null;createdAt:string};
export type PortalNotice={id:number;audienceType:string;title:string;body:string;priority:PortalNoticePriority;state:string;publishedAt:string|null;expiresAt:string|null;isRead?:boolean;readAt?:string|null};
export type PortalOperatorCenter={candidates:PortalCandidate[];accessCodes:PortalAccessHistory[];notices:PortalNotice[]};

function label(value:unknown){const row=object(value);return text(row.en)??text(row.ur)??text(row.ar)??"";}
function digest(code:string){return createHash("sha256").update(code.trim()).digest("hex");}
function priority(value:unknown):PortalNoticePriority{return value==="important"||value==="urgent"?value:"normal";}
async function operatorWorkspace(){const w=await getTenantContext();if(!w||!w.branchId)throw new Error("Active institution branch required.");return w;}

export async function getPortalOperatorCenter():Promise<PortalOperatorCenter>{
 const w=await operatorWorkspace();const admin=createAdminClient();const{data,error}=await admin.rpc("get_portal_operator_center_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId});if(error)throw new Error(error.message);const raw=object(data);
 const guardians=rows(raw.guardians).flatMap((r)=>{const id=number(r.person_id),name=text(r.display_name);return id&&name?[{personId:id,name,kind:"guardian" as const,linked:Boolean(r.linked),status:text(r.portal_invitation_status)??"not_invited",reference:null,lastCodeAt:text(r.last_code_at)}]:[];});
 const employees=rows(raw.employees).flatMap((r)=>{const id=number(r.person_id),name=text(r.display_name);return id&&name?[{personId:id,name,kind:"employee" as const,linked:Boolean(r.linked),status:text(r.state)??"active",reference:text(r.employee_number),lastCodeAt:text(r.last_code_at)}]:[];});
 const accessCodes:PortalAccessHistory[]=rows(raw.access_codes).flatMap((r)=>{const id=number(r.id),personId=number(r.person_id),name=text(r.display_name),linkType=text(r.link_type),expiresAt=text(r.expires_at),createdAt=text(r.created_at);return id&&personId&&name&&expiresAt&&createdAt&&(linkType==="guardian"||linkType==="employee")?[{id,personId,name,linkType:linkType as "guardian"|"employee",state:text(r.state)??"issued",expiresAt,claimedAt:text(r.claimed_at),createdAt}]:[];});
 const notices=rows(raw.notices).flatMap((r)=>{const id=number(r.id);return id?[{id,audienceType:text(r.audience_type)??"tenant",title:label(r.labels),body:label(r.body),priority:priority(r.priority),state:text(r.state)??"draft",publishedAt:text(r.published_at),expiresAt:text(r.expires_at)}]:[];});
 return{candidates:[...guardians,...employees],accessCodes,notices};
}

export async function issuePortalAccess(input:{personId:number;linkType:"guardian"|"employee";expiresInDays?:number}){
 const w=await operatorWorkspace();const days=Math.min(30,Math.max(1,input.expiresInDays??7));const rawCode=`MDR-${randomBytes(9).toString("hex").toUpperCase()}`;const admin=createAdminClient();const expiresAt=new Date(Date.now()+days*86400000).toISOString();const{data,error}=await admin.rpc("issue_portal_access_code_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_person_id:input.personId,p_link_type:input.linkType,p_token_digest:digest(rawCode),p_expires_at:expiresAt});if(error)throw new Error(error.message);return{...object(data),code:rawCode,claimPath:`/portal/claim?code=${encodeURIComponent(rawCode)}`};
}

export async function publishPortalNotice(input:{audienceType:"tenant"|"parents"|"employees";title:string;body:string;priority?:PortalNoticePriority;expiresAt?:string|null}){
 const w=await operatorWorkspace();const admin=createAdminClient();const{data,error}=await admin.rpc("publish_portal_notice_v2",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_audience_type:input.audienceType,p_labels:{en:input.title.trim()},p_body:{en:input.body.trim()},p_priority:input.priority??"normal",p_expires_at:input.expiresAt||null});if(error)throw new Error(error.message);return object(data);
}

export async function claimPortalAccess(code:string){const identity=await getVerifiedIdentity();if(!identity)throw new Error("Authentication required.");const admin=createAdminClient();const{data,error}=await admin.rpc("claim_portal_access_code_v1",{p_identity_id:identity.id,p_token_digest:digest(code)});if(error)throw new Error(error.message);return object(data);}

export async function getPortalHome(tenantId:number){const identity=await getVerifiedIdentity();if(!identity)throw new Error("Authentication required.");const admin=createAdminClient();const{data,error}=await admin.rpc("get_portal_home_v1",{p_identity_id:identity.id,p_tenant_id:tenantId});if(error)throw new Error(error.message);return object(data);}

export async function markPortalNoticeRead(tenantId:number,noticeId:number){const identity=await getVerifiedIdentity();if(!identity)throw new Error("Authentication required.");const admin=createAdminClient();const{data,error}=await admin.rpc("mark_portal_notice_read_v1",{p_identity_id:identity.id,p_tenant_id:tenantId,p_notice_id:noticeId});if(error)throw new Error(error.message);return object(data);}
