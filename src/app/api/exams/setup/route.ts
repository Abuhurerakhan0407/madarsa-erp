import {NextResponse} from "next/server";
import {validateExamSetupInput} from "@/lib/exams/model";
import {isJsonRequest,isSameOriginRequest} from "@/lib/security/request";
import {createAdminClient} from "@/lib/supabase/admin";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {getTenantContext} from "@/lib/tenancy/context";

export async function POST(request:Request){
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
  if(!isJsonRequest(request))return NextResponse.json({error:"JSON request required."},{status:415});
  const length=Number(request.headers.get("content-length")??0);if(Number.isFinite(length)&&length>16384)return NextResponse.json({error:"Request body is too large."},{status:413});
  const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
  const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});
  let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid JSON body."},{status:400});}
  const validation=validateExamSetupInput(body);if(!validation.value)return NextResponse.json({error:validation.errors[0]||"Invalid exam setup.",details:validation.errors},{status:400});
  const value=validation.value;const admin=createAdminClient();const {data,error}=await admin.rpc("create_exam_series_v1",{
    p_identity_id:identity.id,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_group_id:value.groupId,p_key:value.key,
    p_labels:{en:value.title},p_starts_on:value.startsOn,p_ends_on:value.endsOn,p_evaluator_person_id:value.evaluatorPersonId,p_subject_ids:value.subjectIds
  });
  if(error){const message=error.message.toLowerCase();if(message.includes("permission denied"))return NextResponse.json({error:"Exam setup permission required."},{status:403});if(message.includes("already exists")||message.includes("required"))return NextResponse.json({error:error.message},{status:409});if(message.includes("must")||message.includes("invalid")||message.includes("select between"))return NextResponse.json({error:error.message},{status:422});return NextResponse.json({error:"Unable to create exam."},{status:500});}
  return NextResponse.json({result:data},{status:201,headers:{"cache-control":"no-store"}});
}
