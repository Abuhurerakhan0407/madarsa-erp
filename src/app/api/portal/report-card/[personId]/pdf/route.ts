import { NextResponse } from "next/server";
import { createUnicodeReportCardPdf } from "@/lib/exams/report-card-pdf";
import { getPortalReportCard } from "@/lib/portal/report-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

function positive(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function safeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "student";
}

export async function GET(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const query = new URL(request.url).searchParams;
  const tenantId = positive(query.get("tenant"));
  const examId = positive(query.get("exam"));
  const personId = positive((await params).personId);
  if (!tenantId || !examId || !personId) {
    return NextResponse.json({ error: "Report card scope is invalid." }, { status: 400 });
  }

  try {
    const card = await getPortalReportCard(tenantId, personId, examId);
    if (!card?.issue?.verificationCode) {
      return NextResponse.json({ error: "Published report card is not available." }, { status: 404 });
    }
    const admin = createAdminClient();
    const [{ data: tenant, error: tenantError }, { data: exam, error: examError }] = await Promise.all([
      admin.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
      admin.from("exam_series").select("branch_id").eq("tenant_id", tenantId).eq("id", examId).maybeSingle()
    ]);
    if (tenantError || examError || !tenant || !exam) {
      return NextResponse.json({ error: "Unable to resolve report card context." }, { status: 500 });
    }

    const branchId = positive(String(exam.branch_id));
    const branchResult = branchId
      ? await admin.from("branches").select("name").eq("tenant_id", tenantId).eq("id", branchId).maybeSingle()
      : { data: null, error: null };
    if (branchResult.error) {
      return NextResponse.json({ error: "Unable to resolve report card branch." }, { status: 500 });
    }

    const pdf = await createUnicodeReportCardPdf(card, {
      institutionName: tenant.name,
      branchName: branchResult.data?.name ?? "Main Branch"
    });
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    const filename = `report-card-${safeFilename(card.student.studentNumber)}-${card.exam.id}.pdf`;
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to generate report card PDF." }, { status: 500 });
  }
}
