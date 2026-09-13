import { NextResponse } from "next/server";
import { createReportCardPdf } from "@/lib/exams/report-card-pdf";
import { getExamReportCard } from "@/lib/exams/workspace";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function safeFilename(value: string): string {return value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "student";}

export async function GET(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const identity=await getVerifiedIdentity();if(!identity)return NextResponse.json({error:"Authentication required."},{status:401});
  const workspace=await getTenantContext();if(!workspace||workspace.identityId!==identity.id||!workspace.branchId)return NextResponse.json({error:"Active institution membership required."},{status:403});
  const personId=Number((await params).personId);if(!Number.isInteger(personId)||personId<=0)return NextResponse.json({error:"Student is invalid."},{status:400});
  const examValue=Number(new URL(request.url).searchParams.get("exam"));const examId=Number.isInteger(examValue)&&examValue>0?examValue:null;
  try{
    const card=await getExamReportCard(personId,examId);if(!card||!card.issue?.verificationCode)return NextResponse.json({error:"Published report card is not available."},{status:404});
    const pdf=await createReportCardPdf(card,{institutionName:workspace.tenantName,branchName:workspace.branchName||"Main Branch"});const body=pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength) as ArrayBuffer;const filename=`report-card-${safeFilename(card.student.studentNumber)}-${card.exam.id}.pdf`;
    return new Response(body,{status:200,headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="${filename}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
  }catch{return NextResponse.json({error:"Unable to generate report card PDF."},{status:500});}
}
