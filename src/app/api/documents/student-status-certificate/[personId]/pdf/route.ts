import { NextResponse } from "next/server";
import { createStudentStatusCertificatePdf } from "@/lib/documents/student-status-pdf";
import { getStudentStatusCertificate } from "@/lib/documents/student-status";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function GET(_request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }
  const personId = Number((await params).personId);
  if (!Number.isInteger(personId) || personId <= 0) return NextResponse.json({ error: "Student is invalid." }, { status: 400 });

  try {
    const certificate = await getStudentStatusCertificate(personId);
    if (!certificate) return NextResponse.json({ error: "Student status certificate has not been issued." }, { status: 404 });
    const pdf = await createStudentStatusCertificatePdf(certificate);
    const buffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="student-status-${certificate.snapshot.studentNumber.replace(/[^A-Za-z0-9._-]/g, "-")}-r${certificate.revision}.pdf"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to generate student status certificate PDF." }, { status: 500 });
  }
}
