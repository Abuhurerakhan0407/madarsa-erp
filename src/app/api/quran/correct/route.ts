import { NextResponse } from "next/server";
import { validateQuranCorrectionInput } from "@/lib/quran/correction";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request:Request){
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
  if(!isJsonRequest(request))return NextResponse.json({error:"JSON request required."},{status:415});
  const length=Number(request.headers.get("content-length")??0);if(Number.isFinite(length)&&length>24576)return NextResponse.json({error:"Request body is too large."},{status:413});
  const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
  const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});
  const parsedBody = await readBoundedJson(request, 24_576);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  const body = parsedBody.value;
  const validation=validateQuranCorrectionInput(body);if(!validation.value)return NextResponse.json({error:validation.errors[0]||"Invalid correction.",details:validation.errors},{status:400});
  const value=validation.value;const admin=createAdminClient();
  const {data,error}=await admin.rpc("correct_quran_recitation_attempt_scoped_v1",{
    p_identity_id:identity.id,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_request_key:value.requestKey,p_recitation_attempt_id:value.attemptId,p_reason:value.reason,
    p_accuracy_score:value.accuracyScore,p_fluency_score:value.fluencyScore,p_tajweed_score:value.tajweedScore,p_overall_score:value.overallScore,p_prompts:value.prompts,p_outcome:value.outcome,
    p_teacher_remark:value.teacherRemark,p_parent_visible_remark:value.parentVisibleRemark,p_private_note:value.privateNote
  });
  if(error){const message=error.message.toLowerCase();if(message.includes("permission denied"))return NextResponse.json({error:"Qur'an correction permission required."},{status:403});if(message.includes("not found"))return NextResponse.json({error:"Recitation record was not found in this branch."},{status:404});if(message.includes("invalid")||message.includes("required")||message.includes("too long")||message.includes("reason")||message.includes("score")||message.includes("prompts"))return NextResponse.json({error:error.message},{status:422});return NextResponse.json({error:"Unable to correct Qur'an record."},{status:500});}
  return NextResponse.json({result:data},{status:201,headers:{"cache-control":"no-store"}});
}
