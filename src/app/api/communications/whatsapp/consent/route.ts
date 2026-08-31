import { NextResponse } from "next/server";
import { setGuardianWhatsappConsent } from "@/lib/notifications/whatsapp";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request){
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
 if(Number(request.headers.get("content-length")??0)>8192)return NextResponse.json({error:"Request is too large."},{status:413});
 try{
  const body=await request.json() as Record<string,unknown>;const studentPersonId=Number(body.studentPersonId);const status=body.status;const source=body.source;
  if(!Number.isInteger(studentPersonId)||studentPersonId<=0||(status!=="opted_in"&&status!=="opted_out")||(source!=="written"&&source!=="verbal"&&source!=="digital"&&source!=="provider"))return NextResponse.json({error:"Consent record is invalid."},{status:400});
  const result=await setGuardianWhatsappConsent({studentPersonId,status,source,evidenceReference:typeof body.evidenceReference==="string"?body.evidenceReference.trim().slice(0,240)||null:null});
  return NextResponse.json(result,{headers:{"cache-control":"no-store"}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to record WhatsApp consent."},{status:400});}
}
