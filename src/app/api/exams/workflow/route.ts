import {NextResponse} from "next/server";
import {validateExamWorkflowInput} from "@/lib/exams/model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import {createAdminClient} from "@/lib/supabase/admin";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {getTenantContext} from "@/lib/tenancy/context";

export async function POST(request:Request){
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
  if(!isJsonRequest(request))return NextResponse.json({error:"JSON request required."},{status:415});
  const length=Number(request.headers.get("content-length")??0);if(Number.isFinite(length)&&length>8192)return NextResponse.json({error:"Request body is too large."},{status:413});
  const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
  const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});
  const parsedBody = await readBoundedJson(request, 8_192);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  const body = parsedBody.value;
  const validation=validateExamWorkflowInput(body);if(!validation.value)return NextResponse.json({error:validation.errors[0]||"Invalid exam workflow action.",details:validation.errors},{status:400});
  const value=validation.value;const admin=createAdminClient();let response:{data:unknown;error:{message:string}|null};
  if(value.action==="calculate")response=await admin.rpc("calculate_exam_results_v1",{p_identity_id:identity.id,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_exam_series_id:value.examSeriesId});
  else if(value.action==="approve")response=await admin.rpc("approve_exam_results_v1",{p_identity_id:identity.id,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_exam_series_id:value.examSeriesId});
  else response=await admin.rpc("publish_exam_results_v1",{p_identity_id:identity.id,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_exam_series_id:value.examSeriesId});
  if(response.error){const message=response.error.message.toLowerCase();if(message.includes("permission denied"))return NextResponse.json({error:"Result workflow permission required."},{status:403});if(message.includes("required")||message.includes("ready")||message.includes("awaiting")||message.includes("before publication")||message.includes("must be entered"))return NextResponse.json({error:response.error.message},{status:409});return NextResponse.json({error:"Unable to update exam workflow."},{status:500});}
  return NextResponse.json({result:response.data},{status:200,headers:{"cache-control":"no-store"}});
}
