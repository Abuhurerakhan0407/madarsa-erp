import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { runAppOperationalReport, supportsAppOperationalReport } from "@/lib/reports/app-runtime";
import { createUnicodeOperationalReportPdf, supportsOperationalReportPdf } from "@/lib/reports/report-pdf";
import { parseReportResult } from "@/lib/reports/workspace";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type Raw = Record<string, unknown>;
const dateKeys=new Set(["attendance_date","date_from","date_to"]);
const idKeys=new Set(["session_id","program_id","group_id","student_person_id","teacher_person_id"]);
const allowedKeys=new Set([...dateKeys,...idKeys]);

function parametersFor(raw: unknown): Raw | null {
 const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Raw : {};
 const parameters:Raw={};
 for(const [key,value] of Object.entries(input)){
  if(!allowedKeys.has(key)) continue;
  if(value===undefined||value===null||value==="") continue;
  if(dateKeys.has(key)){
   if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
   parameters[key]=value;
   continue;
  }
  const numeric=Number(value);
  if(!Number.isInteger(numeric)||numeric<=0) return null;
  parameters[key]=numeric;
 }
 if(typeof parameters.date_from==="string"&&typeof parameters.date_to==="string"&&parameters.date_from>parameters.date_to)return null;
 return parameters;
}

export async function POST(request: Request) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
 if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
 const body = await readBoundedJson(request, 16384);
 if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });

 const identity = await getVerifiedIdentity();
 if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
 const workspace = await getTenantContext();
 if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
  return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
 }

 const value = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? body.value as Raw : {};
 const reportKey = typeof value.reportKey === "string" ? value.reportKey : "";
 if (!supportsOperationalReportPdf(reportKey)) return NextResponse.json({ error: "PDF output is not supported for this report." }, { status: 400 });
 const parameters = parametersFor(value.parameters);
 if (!parameters) return NextResponse.json({ error: "Valid report parameters are required." }, { status: 400 });

 try {
  let rawResult: unknown;
  if (supportsAppOperationalReport(reportKey)) {
   rawResult = await runAppOperationalReport({
    workspace,
    reportKey,
    parameters,
    outputFormat: "json",
    requestKey: randomUUID()
   });
  } else {
   const admin = createAdminClient();
   const { data, error } = await admin.rpc("run_operational_report_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_report_key: reportKey,
    p_parameters: parameters,
    p_output_format: "json",
    p_request_key: randomUUID()
   });
   if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Report permission required." }, { status: 403 });
    if(message.includes("not found")||message.includes("unsupported")||message.includes("invalid"))return NextResponse.json({error:error.message},{status:422});
    return NextResponse.json({ error: "Unable to generate report PDF." }, { status: 500 });
   }
   rawResult = data;
  }

  const result = parseReportResult(rawResult);
  if (!result.runId || result.reportKey !== reportKey) return NextResponse.json({ error: "Report runtime returned an invalid result." }, { status: 500 });
  const pdf = await createUnicodeOperationalReportPdf(result, {
   institutionName: workspace.tenantName,
   branchName: workspace.branchName || "Main Branch"
  });
  const buffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  const suffixDate = typeof parameters.attendance_date==="string"?parameters.attendance_date:typeof parameters.date_to==="string"?parameters.date_to:new Date().toISOString().slice(0,10);
  return new Response(buffer, {
   status: 200,
   headers: {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${reportKey.replaceAll("_", "-")}-${suffixDate}.pdf"`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff"
   }
  });
 } catch (error) {
  const message = error instanceof Error ? error.message : "Unable to generate report PDF.";
  if(message.toLowerCase().includes("permission denied"))return NextResponse.json({error:"Report permission required."},{status:403});
  return NextResponse.json({ error: message }, { status: 500 });
 }
}
