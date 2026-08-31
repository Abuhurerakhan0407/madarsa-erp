import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw=Record<string,unknown>;
const obj=(v:unknown):Raw=>v&&typeof v==="object"&&!Array.isArray(v)?v as Raw:{};
const rows=(v:unknown):Raw[]=>Array.isArray(v)?v.filter((x)=>x&&typeof x==="object"&&!Array.isArray(x)) as Raw[]:[];
const text=(v:unknown):string|null=>typeof v==="string"&&v.trim()?v:null;
const num=(v:unknown):number|null=>Number.isFinite(Number(v))?Number(v):null;
const bool=(v:unknown)=>v===true;

export type AccessCenter={
 branches:Array<{id:number;code:string;name:string;status:string}>;
 permissions:Array<{code:string;description:string}>;
 roles:Array<{id:number;key:string;name:string;status:string;isSystem:boolean;permissions:string[];memberCount:number}>;
 memberships:Array<{id:number;identityId:string;status:string;allBranches:boolean;roles:Array<{id:number;key:string;name:string;isSystem:boolean}>;branchScopes:Array<{id:number;code:string;name:string}>;isCurrentAdmin:boolean}>;
 adminMembershipId:number;
};
async function ws(){const w=await getTenantContext();if(!w)throw new Error("Active institution is required.");return w;}
export async function getAccessAdministrationCenter():Promise<AccessCenter>{const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("get_access_administration_center_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId});if(error)throw new Error(`Unable to load access administration: ${error.message}`);const raw=obj(data);return{
 branches:rows(raw.branches).flatMap(r=>{const id=num(r.id),code=text(r.code),name=text(r.name);return id&&code&&name?[{id,code,name,status:text(r.status)??"active"}]:[]}),
 permissions:rows(raw.permissions).flatMap(r=>{const code=text(r.code),description=text(r.description);return code&&description?[{code,description}]:[]}),
 roles:rows(raw.roles).flatMap(r=>{const id=num(r.id),key=text(r.key),name=text(r.name);return id&&key&&name?[{id,key,name,status:text(r.status)??"active",isSystem:bool(r.is_system),permissions:Array.isArray(r.permissions)?r.permissions.filter((x):x is string=>typeof x==="string"):[],memberCount:num(r.member_count)??0}]:[]}),
 memberships:rows(raw.memberships).flatMap(r=>{const id=num(r.id),identityId=text(r.identity_id);if(!id||!identityId)return[];return[{id,identityId,status:text(r.status)??"active",allBranches:bool(r.all_branches),roles:rows(r.roles).flatMap(x=>{const rid=num(x.id),key=text(x.key),name=text(x.name);return rid&&key&&name?[{id:rid,key,name,isSystem:bool(x.is_system)}]:[]}),branchScopes:rows(r.branch_scopes).flatMap(x=>{const bid=num(x.id),code=text(x.code),name=text(x.name);return bid&&code&&name?[{id:bid,code,name}]:[]}),isCurrentAdmin:bool(r.is_current_admin)}]}),
 adminMembershipId:num(raw.admin_membership_id)??0
};}
export async function createCustomRole(input:{key:string;name:string}){const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("create_custom_role_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_key:input.key,p_name:input.name});if(error)throw new Error(error.message);return obj(data);}
export async function setCustomRolePermissions(input:{roleId:number;permissionCodes:string[]}){const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("set_custom_role_permissions_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_role_id:input.roleId,p_permission_codes:input.permissionCodes});if(error)throw new Error(error.message);return obj(data);}
export async function setMembershipCustomRole(input:{membershipId:number;roleId:number;assigned:boolean}){const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("set_membership_custom_role_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_membership_id:input.membershipId,p_role_id:input.roleId,p_assigned:input.assigned});if(error)throw new Error(error.message);return obj(data);}
export async function setMembershipBranchScope(input:{membershipId:number;allBranches:boolean;branchIds:number[]}){const w=await ws();const admin=createAdminClient();const{data,error}=await admin.rpc("set_membership_branch_scope_v1",{p_identity_id:w.identityId,p_tenant_id:w.tenantId,p_membership_id:input.membershipId,p_all_branches:input.allBranches,p_branch_ids:input.branchIds});if(error)throw new Error(error.message);return obj(data);}
