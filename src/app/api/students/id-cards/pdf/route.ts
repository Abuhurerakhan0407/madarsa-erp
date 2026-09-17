import { NextResponse } from "next/server";
import sharp from "sharp";
import type { PdfJpegImage } from "@/lib/documents/layout-pdf";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { createUnicodeStudentIdCardSheetPdf } from "@/lib/students/id-card-pdf";
import { getStudentIdCardBatch, normalizeIdCardStudentIds, type IdCardBatchStudent } from "@/lib/students/id-card-batch";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

const PHOTO_WORKERS = 4;

function positive(value: string | null): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
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

async function hydrateStudentPhotos(students: IdCardBatchStudent[], tenantId: number) {
  const admin = createAdminClient();
  const bucket = admin.storage.from("tenant-documents");
  const output = new Array<IdCardBatchStudent & { photo: PdfJpegImage | null }>(students.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= students.length) return;
      const student = students[index];
      if (!student.photoStoragePath) {
        output[index] = { ...student, photo: null };
        continue;
      }
      if (!student.photoStoragePath.startsWith(`${tenantId}/`)) throw new Error("Student photo path is outside the active institution.");
      const { data, error } = await bucket.download(student.photoStoragePath);
      if (error || !data) throw new Error("Unable to load a stored student photo.");
      output[index] = { ...student, photo: await normalizeStudentPhoto(await data.arrayBuffer()) };
    }
  }

  await Promise.all(Array.from({ length: Math.min(PHOTO_WORKERS, Math.max(1, students.length)) }, () => worker()));
  return output;
}

export async function GET(request: Request) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });
  }
  if (!(await operatorHasPermissions(workspace, ["document.job.manage", "students.profile.read"]))) {
    return NextResponse.json({ error: "Student ID-card generation permission required." }, { status: 403 });
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
  if (!sessionId || !groupId || studentIds.length === 0) {
    return NextResponse.json({ error: "Academic session, class, and at least one student are required." }, { status: 400 });
  }

  try {
    const result = await getStudentIdCardBatch({ locale: "en", sessionId, groupId, personIds: studentIds });
    if (result.students.length !== studentIds.length) {
      return NextResponse.json({ error: "One or more selected students are no longer eligible for this ID-card batch." }, { status: 409 });
    }
    const academicYear = result.sessions.find((session) => session.id === sessionId)?.label;
    if (!academicYear) {
      return NextResponse.json({ error: "The selected academic session is no longer available." }, { status: 409 });
    }
    const students = await hydrateStudentPhotos(result.students, workspace.tenantId);
    const pdf = await createUnicodeStudentIdCardSheetPdf(students, {
      institutionName: workspace.tenantName,
      branchName: workspace.branchName || workspace.branchCode || "—",
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
