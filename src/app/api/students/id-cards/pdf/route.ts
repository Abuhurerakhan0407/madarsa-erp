import { NextResponse } from "next/server";
import { createStudentIdCardSheetPdf } from "@/lib/students/id-card-pdf";
import { getStudentIdCardBatch, normalizeIdCardStudentIds } from "@/lib/students/id-card-batch";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function positive(value: string | null): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function GET(request: Request) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });
  }

  const query = new URL(request.url).searchParams;
  const sessionId = positive(query.get("session"));
  const groupId = positive(query.get("group"));
  let studentIds: number[];
  try {
    studentIds = normalizeIdCardStudentIds(query.getAll("student"));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid student selection." }, { status: 400 });
  }
  if (!groupId || studentIds.length === 0) {
    return NextResponse.json({ error: "Class and at least one student are required." }, { status: 400 });
  }

  try {
    const result = await getStudentIdCardBatch({ locale: "en", sessionId, groupId, personIds: studentIds });
    if (result.students.length !== studentIds.length) {
      return NextResponse.json({ error: "One or more selected students are no longer eligible for this ID-card batch." }, { status: 409 });
    }
    const academicYear = result.sessions.find((session) => session.id === sessionId)?.label || "Current academic year";
    const pdf = await createStudentIdCardSheetPdf(result.students, {
      institutionName: workspace.tenantName,
      branchName: workspace.branchName || "Main Branch",
      academicYear
    });
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    const date = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="student-id-cards-${date}.pdf"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to generate ID-card PDF." }, { status: 500 });
  }
}
