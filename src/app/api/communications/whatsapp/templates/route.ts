import { NextResponse } from "next/server";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { publishGuardianWhatsappTemplate } from "@/lib/notifications/whatsapp";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request){
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
 const capabilityDenied=disabledCapabilityResponse(workspace,"whatsapp_automation");if(capabilityDenied)return capabilityDenied;
 if(Number(request.headers.get("content-length")??0)>16384)return NextResponse.json({error:"Request is too large."},{status:413});
 try{
  const body=await request.json() as Record<string,unknown>;const locale=body.locale;const template=typeof body.bodyTemplate==="string"?body.bodyTemplate.trim():"";
  if(locale!=="en"&&locale!=="ur"&&locale!=="ar")return NextResponse.json({error:"Template locale is invalid."},{status:400});
  if(template.length<2||template.length>4096)return NextResponse.json({error:"Template body is invalid."},{status:400});
  const requiredVariables=Array.isArray(body.requiredVariables)?body.requiredVariables.filter((v):v is string=>typeof v==="string").map(v=>v.trim()).filter(Boolean).slice(0,30):[];
  const result=await publishGuardianWhatsappTemplate({locale,bodyTemplate:template,providerTemplateReference:typeof body.providerTemplateReference==="string"?body.providerTemplateReference.trim().slice(0,160)||null:null,requiredVariables});
  return NextResponse.json(result,{headers:{"cache-control":"no-store"}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to publish WhatsApp template."},{status:400});}
}
