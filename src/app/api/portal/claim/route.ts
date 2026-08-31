import { NextResponse } from "next/server";
import { claimPortalAccess } from "@/lib/portal/runtime";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

function crossOrigin(request:Request){const origin=request.headers.get("origin");return Boolean(origin&&origin!==new URL(request.url).origin);}
export async function POST(request:Request){
 if(crossOrigin(request))return NextResponse.json({error:"Cross-origin request denied."},{status:403});
 if(!await getVerifiedIdentity())return NextResponse.json({error:"Authentication required."},{status:401});
 if(Number(request.headers.get("content-length")??0)>4096)return NextResponse.json({error:"Request is too large."},{status:413});
 if(!(request.headers.get("content-type")??"").toLowerCase().includes("application/json"))return NextResponse.json({error:"JSON request required."},{status:415});
 try{const body=await request.json() as Record<string,unknown>;const code=typeof body.code==="string"?body.code.trim():"";if(!/^MDR-[A-F0-9]{18}$/.test(code))return NextResponse.json({error:"Portal access code is invalid."},{status:400});const result=await claimPortalAccess(code);return NextResponse.json(result,{headers:{"cache-control":"no-store"}});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to claim portal access."},{status:400});}
}
