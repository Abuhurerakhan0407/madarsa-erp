import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";
import { validateStudentUpdateInput } from "@/lib/students/update-model";

export async function PATCH(request:Request,{params}:{params:Promise<{personId:string}>}){
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin mutation blocked."},{status:403});
  if(!isJsonRequest(request))return NextResponse.json({error:"JSON request required."},{status:415});
  const length=Number(request.headers.get("content-length")??0);if(Number.isFinite(length)&&length>12288)return NextResponse.json({error:"Request body is too large."},{status:413});
  const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
  const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active branch membership required."},{status:403});
  const personId=Number((await params).personId);if(!Number.isInteger(personId)||personId<=0)return NextResponse.json({error:"Invalid student."},{status:400});
  const parsedBody = await readBoundedJson(request, 12_288);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  const body = parsedBody.value;
  const validation=validateStudentUpdateInput(body);if(!validation.value)return NextResponse.json({error:validation.errors[0]||"Invalid student details.",details:validation.errors},{status:400});
  const value=validation.value;const admin=createAdminClient();const {data,error}=await admin.rpc("update_student_core",{p_identity_id:identity.id,p_tenant_id:workspace.tenantId,p_branch_id:workspace.branchId,p_person_id:personId,p_display_name:value.displayName,p_name_native:value.nameNative??null,p_date_of_birth:value.dateOfBirth??null,p_gender:value.gender??null,p_preferred_locale:value.preferredLocale,p_medical_summary:value.medicalSummary??null,p_accessibility_needs:value.accessibilityNeeds??null,p_pickup_restrictions:value.pickupRestrictions??null});
  if(error){const m=error.message.toLowerCase();if(m.includes("permission denied"))return NextResponse.json({error:"Student update permission required."},{status:403});if(m.includes("not available"))return NextResponse.json({error:"Student is not available in this branch."},{status:404});if(m.includes("student name")||m.includes("date of birth")||m.includes("gender")||m.includes("language"))return NextResponse.json({error:error.message},{status:422});return NextResponse.json({error:"Unable to update the student record."},{status:500});}
  return NextResponse.json({result:data},{status:200,headers:{"cache-control":"no-store"}});
}
