import { cache } from "react";
import { cookies } from "next/headers";
import { coerceClientProfileKey, type ClientProfileKey } from "@/lib/capabilities/client-profile";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { selectWorkspaceBranchId } from "./workspace";

export const WORKSPACE_COOKIE="ilmgaah_workspace";
export type WorkspaceSelection={membershipId:number;branchId:number};
export type WorkspaceChoice={membershipId:number;tenantId:number;tenantName:string;tenantSlug:string;branchId:number;branchName:string;branchCode:string};
export type TenantContext = {
  identityId: string;
  email?: string;
  displayName: string;
  membershipId: number;
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  tenantState: string;
  clientProfile: ClientProfileKey;
  branchId: number | null;
  branchName: string | null;
  branchCode: string | null;
};

type MembershipRow={id:number;tenant_id:number;all_branches:boolean};
export function parseWorkspaceSelection(value:string|undefined|null):WorkspaceSelection|null{
 if(!value)return null;const match=/^(\d+):(\d+)$/.exec(value);if(!match)return null;const membershipId=Number(match[1]),branchId=Number(match[2]);return Number.isSafeInteger(membershipId)&&membershipId>0&&Number.isSafeInteger(branchId)&&branchId>0?{membershipId,branchId}:null;
}

async function activeMemberships(){
 const identity=await getVerifiedIdentity();if(!identity)return{identity:null,memberships:[] as MembershipRow[]};
 const supabase=await createClient();const now=new Date().toISOString();
 const{data,error}=await supabase.from("memberships").select("id,tenant_id,all_branches").eq("identity_id",identity.id).eq("status","active").or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`).order("created_at",{ascending:true});
 if(error)throw new Error(`Unable to resolve memberships: ${error.message}`);
 return{identity,memberships:(data??[]) as MembershipRow[]};
}

async function resolveTenantContext(): Promise<TenantContext | null> {
 const{identity,memberships}=await activeMemberships();if(!identity||memberships.length===0)return null;
 const preferred=parseWorkspaceSelection((await cookies()).get(WORKSPACE_COOKIE)?.value);
 const membership=memberships.find(row=>row.id===preferred?.membershipId)??memberships[0];
 const supabase=await createClient();
 const[{data:tenant,error:tenantError},{data:profile,error:profileError}]=await Promise.all([
  supabase.from("tenants").select("id,name,slug,state,primary_branch_id,client_profile").eq("id",membership.tenant_id).single(),
  supabase.from("profiles").select("display_name").eq("identity_id",identity.id).maybeSingle()
 ]);
 if(tenantError)throw new Error(`Unable to resolve tenant: ${tenantError.message}`);if(profileError)throw new Error(`Unable to resolve profile: ${profileError.message}`);
 let scopedBranchIds:number[]=[];
 if(!membership.all_branches){
  const{data,error}=await supabase.from("membership_branch_scopes").select("branch_id").eq("tenant_id",tenant.id).eq("membership_id",membership.id).order("created_at",{ascending:true});
  if(error)throw new Error(`Unable to resolve membership branches: ${error.message}`);scopedBranchIds=(data??[]).map(row=>Number(row.branch_id)).filter(id=>Number.isSafeInteger(id)&&id>0);if(scopedBranchIds.length===0)return null;
 }
 let workspaceBranchId=selectWorkspaceBranchId(tenant.primary_branch_id,membership.all_branches,scopedBranchIds,membership.id===preferred?.membershipId?preferred?.branchId:null);
 let branch:{id:number;name:string;code:string}|null=null;
 if(workspaceBranchId){
  const{data,error}=await supabase.from("branches").select("id,name,code,status").eq("tenant_id",tenant.id).eq("id",workspaceBranchId).eq("status","active").maybeSingle();
  if(error)throw new Error(`Unable to resolve active branch: ${error.message}`);branch=data?{id:Number(data.id),name:String(data.name),code:String(data.code)}:null;
  if(!branch&&membership.all_branches&&tenant.primary_branch_id!==workspaceBranchId){
   workspaceBranchId=tenant.primary_branch_id;
   if(workspaceBranchId){const fallback=await supabase.from("branches").select("id,name,code").eq("tenant_id",tenant.id).eq("id",workspaceBranchId).eq("status","active").maybeSingle();if(fallback.error)throw new Error(`Unable to resolve primary branch: ${fallback.error.message}`);branch=fallback.data?{id:Number(fallback.data.id),name:String(fallback.data.name),code:String(fallback.data.code)}:null;}
  }
 }
 if(!branch)return null;
 return{identityId:identity.id,email:identity.email,displayName:profile?.display_name||identity.email||"Account",membershipId:membership.id,tenantId:tenant.id,tenantName:tenant.name,tenantSlug:tenant.slug,tenantState:tenant.state,clientProfile:coerceClientProfileKey(tenant.client_profile),branchId:branch.id,branchName:branch.name,branchCode:branch.code};
}

async function resolveWorkspaceChoices():Promise<WorkspaceChoice[]>{
 const{identity,memberships}=await activeMemberships();if(!identity||memberships.length===0)return[];const supabase=await createClient();const tenantIds=[...new Set(memberships.map(row=>row.tenant_id))];
 const{data:tenants,error:tenantError}=await supabase.from("tenants").select("id,name,slug").in("id",tenantIds);if(tenantError)throw new Error(`Unable to load workspace institutions: ${tenantError.message}`);
 const tenantMap=new Map((tenants??[]).map(row=>[Number(row.id),{name:String(row.name),slug:String(row.slug)}]));const choices:WorkspaceChoice[]=[];
 for(const membership of memberships){
  let allowedBranchIds:number[]=[];
  if(membership.all_branches){const{data,error}=await supabase.from("branches").select("id").eq("tenant_id",membership.tenant_id).eq("status","active").order("created_at",{ascending:true});if(error)throw new Error(`Unable to load workspace branches: ${error.message}`);allowedBranchIds=(data??[]).map(row=>Number(row.id));}
  else{const{data,error}=await supabase.from("membership_branch_scopes").select("branch_id").eq("tenant_id",membership.tenant_id).eq("membership_id",membership.id).order("created_at",{ascending:true});if(error)throw new Error(`Unable to load workspace scopes: ${error.message}`);allowedBranchIds=(data??[]).map(row=>Number(row.branch_id));}
  if(!allowedBranchIds.length)continue;const{data:branches,error}=await supabase.from("branches").select("id,name,code").eq("tenant_id",membership.tenant_id).eq("status","active").in("id",allowedBranchIds);if(error)throw new Error(`Unable to load authorized workspace branches: ${error.message}`);const tenant=tenantMap.get(membership.tenant_id);if(!tenant)continue;
  for(const branch of branches??[])choices.push({membershipId:membership.id,tenantId:membership.tenant_id,tenantName:tenant.name,tenantSlug:tenant.slug,branchId:Number(branch.id),branchName:String(branch.name),branchCode:String(branch.code)});
 }
 return choices.sort((a,b)=>a.tenantName.localeCompare(b.tenantName)||a.branchName.localeCompare(b.branchName));
}

export const getTenantContext=cache(resolveTenantContext);
export const getWorkspaceChoices=cache(resolveWorkspaceChoices);
