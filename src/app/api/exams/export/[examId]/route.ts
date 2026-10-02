import {NextResponse} from "next/server";
import {examCsvCell,examExportFilename} from "@/lib/exams/export";
import {getExamWorkspace} from "@/lib/exams/workspace";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {getTenantContext} from "@/lib/tenancy/context";

export async function GET(_request:Request,{params}:{params:Promise<{examId:string}>}){
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
 const tenant=await getTenantContext();if(!tenant||tenant.identityId!==identity.id||!tenant.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
 const examId=Number((await params).examId);if(!Number.isInteger(examId)||examId<=0)return NextResponse.json({error:"Exam is invalid."},{status:400});
 try{
  const data=await getExamWorkspace({examSeriesId:examId});if(!data.exam)return NextResponse.json({error:"Exam is not available in the active branch."},{status:404});if(!data.analysis?.available)return NextResponse.json({error:"Results are not available for export in the current exam state.",state:data.exam.state},{status:409});
  const headers=["Student number","Student name","Percentage","Result","Grade",...(data.exam.rankingEnabled?["Rank"]:[])];const lines=[headers.map(examCsvCell).join(","),...data.analysis.students.map(student=>[student.studentNumber,student.studentName,student.percentage??"",student.aggregateStatus,student.gradeKey??"",...(data.exam?.rankingEnabled?[student.rankValue??""]:[])].map(examCsvCell).join(","))];const body=`\uFEFF${lines.join("\r\n")}`;
  return new Response(body,{status:200,headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="${examExportFilename(data.exam.key)}-results.csv"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }catch{return NextResponse.json({error:"Unable to export exam results."},{status:500});}
}
