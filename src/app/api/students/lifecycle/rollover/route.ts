import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { planStudentRollover } from "@/lib/students/lifecycle";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function rejectCrossOrigin(request:Request){const origin=request.headers.get("origin");return origin&&origin!==new URL(request.url).origin;}

export async function POST(request:Request){
 if(rejectCrossOrigin(request))return NextResponse.json({error:"Cross-origin request denied."},{status:403});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
 if(Number(request.headers.get("content-length")??0)>65536)return NextResponse.json({error:"Request is too large."},{status:413});
 if(!(request.headers.get("content-type")??"").toLowerCase().includes("application/json"))return NextResponse.json({error:"JSON request required."},{status:415});
 try{
  const body=await request.json() as Record<string,unknown>;const targetSessionId=Number(body.targetSessionId),targetGroupId=Number(body.targetGroupId);const mode=body.mode;const studentPersonIds=Array.isArray(body.studentPersonIds)?[...new Set(body.studentPersonIds.map(Number).filter((value)=>Number.isInteger(value)&&value>0))]:[];
  if(!Number.isInteger(targetSessionId)||targetSessionId<=0||!Number.isInteger(targetGroupId)||targetGroupId<=0||(mode!=="promotion"&&mode!=="renewal")||studentPersonIds.length<1||studentPersonIds.length>250)return NextResponse.json({error:"Rollover request is invalid."},{status:400});
  const requestKey=typeof body.requestKey==="string"&&body.requestKey.trim().length>=16?body.requestKey.trim().slice(0,128):`student-rollover:${randomUUID()}`;
  const result=await planStudentRollover({studentPersonIds,targetSessionId,targetGroupId,mode,requestKey});return NextResponse.json(result,{status:201,headers:{"cache-control":"no-store"}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to plan student rollover."},{status:400});}
}
