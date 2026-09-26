import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:{};
const rows=(value:unknown):Raw[]=>Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)) as Raw[]:[];
const text=(value:unknown):string|null=>typeof value==="string"&&value.trim()?value:null;
const number=(value:unknown):number|null=>Number.isFinite(Number(value))?Number(value):null;

export type PortalNoticePriority="normal"|"important"|"urgent";
export type PortalAccessCandidate={personId:number;name:string;kind:"guardian"|"employee";email:string|null;reference:string|null;accountStatus:"active"|"disabled"|"not_created"|"email_required";lastLogin:string|null;erpManaged:boolean;linkedScope:Raw[];lastCodeAt:string|null};
export type PortalAccessHistory={id:number;personId:number;name:string;linkType:"guardian"|"employee";state:string;expiresAt:string;claimedAt:string|null;createdAt:string};
export type PortalNotice={id:number;audienceType:string;title:string;body:string;priority:PortalNoticePriority;state:string;publishedAt:string|null;expiresAt:string|null;isRead?:boolean;readAt?:string|null};
export type PortalOperatorCenter={parents:PortalAccessCandidate[];teachers:PortalAccessCandidate[];accessCodes:PortalAccessHistory[];notices:PortalNotice[]};

function label(value:unknown){const row=object(value);return text(row.en)??text(row.ur)??text(row.ar)??"";}
function priority(value:unknown):PortalNoticePriority{return value==="important"||value==="urgent"?value:"normal";}
async function operatorWorkspace(){const w=await getTenantContext();if(!w||!w.branchId)throw new Error("Active institution branch required.");return w;}
function mapCandidate(r:Raw,kind:"guardian"|"employee"):PortalAccessCandidate|null{const personId=number(r.person_id),name=text(r.name),status=text(r.account_status);if(!personId||!name)return null;return{personId,name,kind,email:text(r.email),reference:text(r.reference),accountStatus:(status==="active"||status==="disabled"||status==="not_created"||status==="email_required"?status:"not_created") as PortalAccessCandidate["accountStatus"],lastLogin:text(r.last_login),erpManaged:r.erp_managed===true,linkedScope:rows(r.linked_scope),lastCodeAt:text(r.last_code_at)};}

export async function getPortalOperatorCenter():Promise<PortalOperatorCenter>{
 const w=await operatorWorkspace();const admin=createAdminClient();const{data,error}=await admin.rpc("get_portal_access_center_v2",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId});if(error)throw new Error(error.message);const raw=object(data);
 const parents=rows(raw.parents).flatMap(r=>{const x=mapCandidate(r,"guardian");return x?[x]:[];});const teachers=rows(raw.teachers).flatMap(r=>{const x=mapCandidate(r,"employee");return x?[x]:[];});
 const accessCodes:PortalAccessHistory[]=rows(raw.access_codes).flatMap((r)=>{const id=number(r.id),personId=number(r.person_id),name=text(r.name),linkType=text(r.link_type),expiresAt=text(r.expires_at),createdAt=text(r.created_at);return id&&personId&&name&&expiresAt&&createdAt&&(linkType==="guardian"||linkType==="employee")?[{id,personId,name,linkType:linkType as "guardian"|"employee",state:text(r.state)??"issued",expiresAt,claimedAt:text(r.claimed_at),createdAt}]:[];});
 const notices=rows(raw.notices).flatMap((r)=>{const id=number(r.id);return id?[{id,audienceType:text(r.audience_type)??"tenant",title:label(r.labels),body:label(r.body),priority:priority(r.priority),state:text(r.state)??"draft",publishedAt:text(r.published_at),expiresAt:text(r.expires_at)}]:[];});
 return{parents,teachers,accessCodes,notices};
}


export async function setPortalIdentityAccess(input:{personId:number;linkType:"guardian"|"employee";enabled:boolean}){const w=await operatorWorkspace();const admin=createAdminClient();const{data,error}=await admin.rpc("set_portal_identity_access_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_person_id:input.personId,p_link_type:input.linkType,p_enabled:input.enabled});if(error)throw new Error(error.message);return object(data);}

export async function publishPortalNotice(input:{audienceType:"tenant"|"parents"|"employees";title:string;body:string;priority?:PortalNoticePriority;expiresAt?:string|null}){
 const w=await operatorWorkspace();const admin=createAdminClient();const{data,error}=await admin.rpc("publish_portal_notice_v2",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_branch_id:w.branchId,p_audience_type:input.audienceType,p_labels:{en:input.title.trim()},p_body:{en:input.body.trim()},p_priority:input.priority??"normal",p_expires_at:input.expiresAt||null});if(error)throw new Error(error.message);return object(data);
}

export async function getPortalHome(tenantId:number){const identity=await getVerifiedIdentity();if(!identity)throw new Error("Authentication required.");const admin=createAdminClient();const{data,error}=await admin.rpc("get_portal_home_v3",{p_identity_id:identity.id,p_tenant_id:tenantId});if(error)throw new Error(error.message);return object(data);}

export async function markPortalNoticeRead(tenantId:number,noticeId:number){const identity=await getVerifiedIdentity();if(!identity)throw new Error("Authentication required.");const admin=createAdminClient();const{data,error}=await admin.rpc("mark_portal_notice_read_v1",{p_identity_id:identity.id,p_tenant_id:tenantId,p_notice_id:noticeId});if(error)throw new Error(error.message);return object(data);}
