import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { importStudentsBatch } from "@/lib/students/lifecycle";
import type { StudentImportRow } from "@/lib/students/csv-import";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function rejectCrossOrigin(request:Request){const origin=request.headers.get("origin");return origin&&origin!==new URL(request.url).origin;}

export async function POST(request:Request){
 if(rejectCrossOrigin(request))return NextResponse.json({error:"Cross-origin request denied."},{status:403});
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
 const capabilityDenied=disabledCapabilityResponse(workspace,"student_lifecycle_import_promotion_renewal");if(capabilityDenied)return capabilityDenied;
 if(Number(request.headers.get("content-length")??0)>262144)return NextResponse.json({error:"Request is too large."},{status:413});
 if(!(request.headers.get("content-type")??"").toLowerCase().includes("application/json"))return NextResponse.json({error:"JSON request required."},{status:415});
 try{
  const body=await request.json() as Record<string,unknown>;const sessionId=Number(body.sessionId),programId=Number(body.programId),groupId=Number(body.groupId);const joinedOn=typeof body.joinedOn==="string"?body.joinedOn:"";const rawRows=Array.isArray(body.rows)?body.rows:[];
  if(!Number.isInteger(sessionId)||sessionId<=0||!Number.isInteger(programId)||programId<=0||!Number.isInteger(groupId)||groupId<=0||!/^\d{4}-\d{2}-\d{2}$/.test(joinedOn))return NextResponse.json({error:"Import placement is invalid."},{status:400});
  if(rawRows.length<1||rawRows.length>100)return NextResponse.json({error:"Import supports 1 to 100 students per batch."},{status:400});
  const rows:StudentImportRow[]=rawRows.map((row,index)=>{if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Import row ${index+1} is invalid.`);const value=row as Record<string,unknown>;const displayName=typeof value.display_name==="string"?value.display_name.trim():"";if(displayName.length<2||displayName.length>160)throw new Error(`Import row ${index+1} has an invalid student name.`);return value as StudentImportRow;});
  const requestKey=typeof body.requestKey==="string"&&body.requestKey.trim().length>=16?body.requestKey.trim().slice(0,128):`student-import:${randomUUID()}`;
  const result=await importStudentsBatch({sessionId,programId,groupId,joinedOn,rows,requestKey});return NextResponse.json(result,{status:201,headers:{"cache-control":"no-store"}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to import students."},{status:400});}
}
