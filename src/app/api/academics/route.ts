import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { validateAcademicMutation } from "@/lib/academics/operations-model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function mapRuntimeError(message:string):{status:number;error:string}{
  const normalized=message.toLowerCase();
  if(normalized.includes("permission denied")||normalized.includes("membership denied"))return{status:403,error:"Academic management permission required."};
  if(normalized.includes("conflict")||normalized.includes("already exists"))return{status:409,error:message};
  if(normalized.includes("not found")||normalized.includes("was not found"))return{status:404,error:message};
  if(normalized.includes("invalid")||normalized.includes("expired")||normalized.includes("required")||normalized.includes("must")||normalized.includes("cannot")||normalized.includes("choose exactly")||normalized.includes("outside")||normalized.includes("too long")||normalized.includes("future"))return{status:422,error:message};
  return{status:500,error:"Unable to update Academics & Timetable."};
}

export async function POST(request:Request){
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
  if(!isJsonRequest(request))return NextResponse.json({error:"JSON request required."},{status:415});
  const parsed=await readBoundedJson(request,32_768);
  if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
  const validation=validateAcademicMutation(parsed.value);
  if(!validation.value)return NextResponse.json({error:validation.errors[0]??"Academic operation is invalid.",details:validation.errors},{status:400});

  const identity=await getVerifiedIdentity();
  if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
  const workspace=await getTenantContext();
  if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});

  const payload:Record<string,unknown>={...validation.value};
  const attachmentToken=typeof payload.attachmentToken==="string"?payload.attachmentToken:null;
  delete payload.attachmentToken;
  const attachmentDigest=attachmentToken?createHash("sha256").update(attachmentToken).digest("hex"):null;

  const admin=createAdminClient();
  const {data,error}=await admin.rpc("mutate_academics_timetable_v2",{
    p_identity_id:identity.id,
    p_tenant_id:workspace.tenantId,
    p_branch_id:workspace.branchId,
    p_action:validation.value.action,
    p_payload:payload,
    p_attachment_token_digest:attachmentDigest
  });
  if(error){const mapped=mapRuntimeError(error.message);return NextResponse.json({error:mapped.error},{status:mapped.status});}
  return NextResponse.json({result:data},{status:200,headers:{"cache-control":"no-store"}});
}
