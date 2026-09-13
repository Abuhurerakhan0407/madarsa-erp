import {NextResponse} from "next/server";
import {isJsonRequest,isSameOriginRequest,readBoundedJson} from "@/lib/security/request";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {createClient} from "@/lib/supabase/server";
import {WORKSPACE_COOKIE} from "@/lib/tenancy/context";

export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
 if(!isJsonRequest(request))return NextResponse.json({error:"JSON request required."},{status:415});
 const parsed=await readBoundedJson(request,2048);if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const body=parsed.value&&typeof parsed.value==="object"&&!Array.isArray(parsed.value)?parsed.value as Record<string,unknown>:{};const membershipId=Number(body.membershipId),branchId=Number(body.branchId);
 if(!Number.isSafeInteger(membershipId)||membershipId<=0||!Number.isSafeInteger(branchId)||branchId<=0)return NextResponse.json({error:"Valid workspace membership and branch are required."},{status:400});
 const supabase=await createClient();const now=new Date().toISOString();
 const{data:membership,error}=await supabase.from("memberships").select("id,tenant_id,all_branches").eq("id",membershipId).eq("identity_id",identity.id).eq("status","active").or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`).maybeSingle();
 if(error)return NextResponse.json({error:"Unable to validate workspace membership."},{status:500});if(!membership)return NextResponse.json({error:"Workspace membership is not active."},{status:403});
 const{data:branch, error:branchError}=await supabase.from("branches").select("id").eq("tenant_id",membership.tenant_id).eq("id",branchId).eq("status","active").maybeSingle();if(branchError)return NextResponse.json({error:"Unable to validate workspace branch."},{status:500});if(!branch)return NextResponse.json({error:"Workspace branch is not active."},{status:403});
 if(!membership.all_branches){const{data:scope,error:scopeError}=await supabase.from("membership_branch_scopes").select("branch_id").eq("tenant_id",membership.tenant_id).eq("membership_id",membership.id).eq("branch_id",branchId).maybeSingle();if(scopeError)return NextResponse.json({error:"Unable to validate workspace scope."},{status:500});if(!scope)return NextResponse.json({error:"You do not have access to this branch."},{status:403});}
 const response=NextResponse.json({ok:true,membershipId,branchId},{status:200,headers:{"cache-control":"no-store"}});
 response.cookies.set(WORKSPACE_COOKIE,`${membershipId}:${branchId}`,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30});
 return response;
}
