import { NextResponse } from "next/server";
import sharp from "sharp";
import type { PdfJpegImage } from "@/lib/documents/layout-pdf";
import { getPortalGuardianDocuments } from "@/lib/portal/documents";
import { createUnicodeStudentIdCardSheetPdf } from "@/lib/students/id-card-pdf";
import type { IdCardBatchStudent } from "@/lib/students/id-card-batch";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

function positive(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function normalizeStudentPhoto(input: ArrayBuffer): Promise<PdfJpegImage> {
  const { data, info } = await sharp(Buffer.from(input))
    .rotate()
    .resize(320, 400, { fit: "cover", position: "centre" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 84, chromaSubsampling: "4:4:4" })
    .toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) throw new Error("Student photo dimensions are unavailable.");
  return { data: new Uint8Array(data), pixelWidth: info.width, pixelHeight: info.height };
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

    const admin = createAdminClient();
    const { data: tenant, error: tenantError } = await admin.from("tenants").select("name").eq("id", tenantId).single();
    if (tenantError || !tenant?.name) throw new Error("Unable to load institution name.");

    let photo: PdfJpegImage | null = null;
    if (child.photoStoragePath) {
      if (!child.photoStoragePath.startsWith(`${tenantId}/`)) throw new Error("Student photo is outside the selected institution.");
      const { data, error } = await admin.storage.from("tenant-documents").download(child.photoStoragePath);
      if (error || !data) throw new Error("Unable to load student photo.");
      photo = await normalizeStudentPhoto(await data.arrayBuffer());
    }

    const student: IdCardBatchStudent & { photo: PdfJpegImage | null } = {
      personId: child.personId,
      studentNumber: child.studentNumber,
      name: child.displayName,
      nativeName: child.nativeName,
      dateOfBirth: child.dateOfBirth,
      status: child.status,
      program: child.programLabel,
      group: child.groupLabel,
      guardianName: child.guardianName,
      photoStoragePath: child.photoStoragePath,
      photo
    };
    const pdf = await createUnicodeStudentIdCardSheetPdf([student], {
      institutionName: tenant.name,
      branchName: child.branchName,
      academicYear: child.sessionLabel
    });
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    const filename = `student-id-${child.studentNumber.replace(/[^A-Za-z0-9._-]/g, "-")}.pdf`;
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
    return NextResponse.json({ error: "Unable to generate student ID PDF." }, { status: 500 });
  }
}
