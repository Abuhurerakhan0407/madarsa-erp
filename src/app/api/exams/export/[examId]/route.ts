import {NextResponse} from "next/server";
import {getExamWorkspace} from "@/lib/exams/workspace";
import {getVerifiedIdentity} from "@/lib/supabase/identity";
import {getTenantContext} from "@/lib/tenancy/context";

function csv(value:unknown){const text=value===null||value===undefined?"":String(value);return `"${text.replaceAll('"','""')}"`;}
function filename(value:string){return value.replace(/[^A-Za-z0-9._-]/g,"-").replace(/-+/g,"-").slice(0,80)||"exam-results";}

export async function GET(_request:Request,{params}:{params:Promise<{examId:string}>}){
 const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});const tenant=await getTenantContext();if(!tenant||tenant.identityId!==identity.id||!tenant.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
 const examId=Number((await params).examId);if(!Number.isInteger(examId)||examId<=0)return NextResponse.json({error:"Exam is invalid."},{status:400});
 try{const data=await getExamWorkspace({examSeriesId:examId});if(!data.exam||!data.analysis?.available)return NextResponse.json({error:"Calculated results are not available for this exam."},{status:404});const headers=["Student number","Student name","Percentage","Result","Grade",...(data.exam.rankingEnabled?["Rank"]:[])];const lines=[headers.map(csv).join(","),...data.analysis.students.map(student=>[student.studentNumber,student.studentName,student.percentage??"",student.aggregateStatus,student.gradeKey??"",...(data.exam?.rankingEnabled?[student.rankValue??""]:[])].map(csv).join(","))];const body=`\uFEFF${lines.join("\r\n")}`;return new Response(body,{status:200,headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="${filename(data.exam.key)}-results.csv"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});}catch{return NextResponse.json({error:"Unable to export exam results."},{status:500});}
}
