import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { queueGuardianWhatsapp } from "@/lib/notifications/whatsapp";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request){
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
 const capabilityDenied=disabledCapabilityResponse(workspace,"whatsapp_automation");if(capabilityDenied)return capabilityDenied;
 if(Number(request.headers.get("content-length")??0)>16384)return NextResponse.json({error:"Request is too large."},{status:413});
 try{
  const body=await request.json() as Record<string,unknown>;const studentPersonId=Number(body.studentPersonId);const templateId=Number(body.templateId);
  if(!Number.isInteger(studentPersonId)||studentPersonId<=0||!Number.isInteger(templateId)||templateId<=0)return NextResponse.json({error:"WhatsApp dispatch target is invalid."},{status:400});
  const variables=body.variables&&typeof body.variables==="object"&&!Array.isArray(body.variables)?body.variables as Record<string,string|number|boolean|null>:{};
  const requestKey=typeof body.requestKey==="string"&&body.requestKey.trim().length>=16?body.requestKey.trim().slice(0,128):`whatsapp:${randomUUID()}`;
  const result=await queueGuardianWhatsapp({studentPersonId,templateId,variables,requestKey});
  return NextResponse.json(result,{status:201,headers:{"cache-control":"no-store"}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to queue WhatsApp message."},{status:400});}
}
