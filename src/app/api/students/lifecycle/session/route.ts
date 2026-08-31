import { NextResponse } from "next/server";
import { prepareNextAcademicSession } from "@/lib/students/lifecycle";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function rejectCrossOrigin(request:Request){const origin=request.headers.get("origin");return origin&&origin!==new URL(request.url).origin;}

export async function POST(request:Request){
 if(rejectCrossOrigin(request))return NextResponse.json({error:"Cross-origin request denied."},{status:403});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
 if(Number(request.headers.get("content-length")??0)>16384)return NextResponse.json({error:"Request is too large."},{status:413});
 if(!(request.headers.get("content-type")??"").toLowerCase().includes("application/json"))return NextResponse.json({error:"JSON request required."},{status:415});
 try{
  const body=await request.json() as Record<string,unknown>;const sourceSessionId=Number(body.sourceSessionId);const key=typeof body.key==="string"?body.key.trim().toLowerCase():"";const label=typeof body.label==="string"?body.label.trim():"";const ur=typeof body.labelUr==="string"?body.labelUr.trim():"";const ar=typeof body.labelAr==="string"?body.labelAr.trim():"";const startsOn=typeof body.startsOn==="string"?body.startsOn:"";const endsOn=typeof body.endsOn==="string"?body.endsOn:"";
  if(!Number.isInteger(sourceSessionId)||sourceSessionId<=0||!label||!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)||!/^\d{4}-\d{2}-\d{2}$/.test(endsOn))return NextResponse.json({error:"Academic session details are invalid."},{status:400});
  const result=await prepareNextAcademicSession({sourceSessionId,key,labels:{en:label,...(ur?{ur}:{}),...(ar?{ar}:{})},startsOn,endsOn});return NextResponse.json(result,{status:201,headers:{"cache-control":"no-store"}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to prepare the next academic session."},{status:400});}
}
