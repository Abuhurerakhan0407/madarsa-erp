import { NextResponse } from "next/server";
import { configureWhatsappChannel } from "@/lib/notifications/whatsapp";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  const identity=await getVerifiedIdentity(); if(!identity) return NextResponse.json({error:"Authentication required."},{status:401});
  const workspace=await getTenantContext(); if(!workspace||workspace.identityId!==identity.id||!workspace.branchId) return NextResponse.json({error:"Active institution membership required."},{status:403});
  if(Number(request.headers.get("content-length")??0)>8192) return NextResponse.json({error:"Request is too large."},{status:413});
  try{
    const body=await request.json() as Record<string,unknown>; const provider=typeof body.provider==="string"?body.provider.trim():""; const state=typeof body.state==="string"?body.state.trim():"";
    if(!["meta_cloud","360dialog","twilio","custom"].includes(provider)||!["active","inactive","suspended"].includes(state)) return NextResponse.json({error:"WhatsApp configuration is invalid."},{status:400});
    const result=await configureWhatsappChannel({provider,senderReference:typeof body.senderReference==="string"?body.senderReference.trim().slice(0,160):null,encryptedConfigReference:typeof body.encryptedConfigReference==="string"?body.encryptedConfigReference.trim().slice(0,256):null,state});
    return NextResponse.json(result,{headers:{"cache-control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to configure WhatsApp."},{status:400});}
}
