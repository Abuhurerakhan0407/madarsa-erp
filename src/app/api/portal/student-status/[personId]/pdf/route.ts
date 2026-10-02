import { NextResponse } from "next/server";
import { createUnicodeStudentStatusCertificatePdf } from "@/lib/documents/student-status-pdf";
import { getPortalGuardianDocuments } from "@/lib/portal/documents";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

function positive(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const query = new URL(request.url).searchParams;
  const tenantId = positive(query.get("tenant"));
  const personId = positive((await params).personId);
  if (!tenantId || !personId) return NextResponse.json({ error: "Student or institution is invalid." }, { status: 400 });

  try {
    const children = await getPortalGuardianDocuments(tenantId);
    const child = children.find((item) => item.personId === personId);
    if (!child) return NextResponse.json({ error: "Student is not linked to this guardian account." }, { status: 404 });
    if (!child.statusCertificate) return NextResponse.json({ error: "Student status certificate has not been issued." }, { status: 404 });

    const pdf = await createUnicodeStudentStatusCertificatePdf(child.statusCertificate);
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    const filename = `student-status-${child.studentNumber.replace(/[^A-Za-z0-9._-]/g, "-")}-r${child.statusCertificate.revision}.pdf`;
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
    return NextResponse.json({ error: "Unable to generate student status certificate PDF." }, { status: 500 });
  }
}
