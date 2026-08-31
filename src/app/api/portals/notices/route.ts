import { NextResponse } from "next/server";
import { publishPortalNotice } from "@/lib/portal/runtime";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function crossOrigin(request:Request){const origin=request.headers.get("origin");return Boolean(origin&&origin!==new URL(request.url).origin);}
export async function POST(request:Request){
 if(crossOrigin(request))return NextResponse.json({error:"Cross-origin request denied."},{status:403});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
 if(Number(request.headers.get("content-length")??0)>16384)return NextResponse.json({error:"Request is too large."},{status:413});
 if(!(request.headers.get("content-type")??"").toLowerCase().includes("application/json"))return NextResponse.json({error:"JSON request required."},{status:415});
 try{const body=await request.json() as Record<string,unknown>;const audienceType=body.audienceType;const title=typeof body.title==="string"?body.title.trim():"";const noticeBody=typeof body.body==="string"?body.body.trim():"";const expiresAt=typeof body.expiresAt==="string"&&body.expiresAt?body.expiresAt:null;if((audienceType!=="tenant"&&audienceType!=="parents"&&audienceType!=="employees")||title.length<2||title.length>160||noticeBody.length<2||noticeBody.length>4000)return NextResponse.json({error:"Portal notice is invalid."},{status:400});const result=await publishPortalNotice({audienceType,title,body:noticeBody,expiresAt});return NextResponse.json(result,{status:201,headers:{"cache-control":"no-store"}});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to publish portal notice."},{status:400});}
}
