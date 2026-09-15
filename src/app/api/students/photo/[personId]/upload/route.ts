import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { operatorHasPermissions } from "@/lib/access/operator-permission";
import { isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type StudentPhotoType = "image/jpeg" | "image/png" | "image/webp";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_PHOTO_BYTES + 512 * 1024;
const extensions = new Map<StudentPhotoType, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function has(bytes: Uint8Array, offset: number, values: readonly number[]) {
  return values.every((value, index) => bytes[offset + index] === value);
}

function detectPhotoType(bytes: Uint8Array): StudentPhotoType | null {
  if (bytes.length >= 3 && has(bytes, 0, [255, 216, 255])) return "image/jpeg";
  if (bytes.length >= 8 && has(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (bytes.length >= 12 && has(bytes, 0, [82, 73, 70, 70]) && has(bytes, 8, [87, 69, 66, 80])) return "image/webp";
  return null;
}

async function readBoundedMultipart(
  request: Request,
  contentType: string
): Promise<{ ok: true; value: FormData } | { ok: false; status: 400 | 413; error: string }> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    return { ok: false, status: 413, error: "Student photo must be 5 MB or smaller." };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400, error: "Unable to read student photo." };
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_MULTIPART_BYTES) {
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: "Student photo must be 5 MB or smaller." };
      }
      chunks.push(chunk.value);
    }
  } catch {
    return { ok: false, status: 400, error: "Unable to read student photo." };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const value = await new Response(buffer, { headers: { "content-type": contentType } }).formData();
    return { ok: true, value };
  } catch {
    return { ok: false, status: 400, error: "Unable to read student photo." };
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin upload blocked." }, { status: 403 });
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Multipart photo upload required." }, { status: 415 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }
  if (!(await operatorHasPermissions(workspace, ["people.person.manage", "students.profile.update"]))) {
    return NextResponse.json({ error: "Student update permission required." }, { status: 403 });
  }

  const personId = Number((await params).personId);
  if (!Number.isSafeInteger(personId) || personId <= 0) {
    return NextResponse.json({ error: "Invalid student." }, { status: 400 });
  }

  const multipart = await readBoundedMultipart(request, contentType);
  if (!multipart.ok) return NextResponse.json({ error: multipart.error }, { status: multipart.status });
  const photo = multipart.value.get("photo");
  if (!(photo instanceof File)) return NextResponse.json({ error: "Student photo is required." }, { status: 400 });
  if (photo.size < 1 || photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Student photo must be 5 MB or smaller." }, { status: 413 });
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const detectedType = detectPhotoType(bytes);
  if (!detectedType || photo.type !== detectedType) {
    return NextResponse.json({ error: "Use a genuine JPEG, PNG, or WebP student photo." }, { status: 415 });
  }
  const extension = extensions.get(detectedType);
  if (!extension) return NextResponse.json({ error: "Unsupported student photo type." }, { status: 415 });

  const admin = createAdminClient();
  const storagePath = `${workspace.tenantId}/students/photos/${personId}/${randomBytes(18).toString("hex")}.${extension}`;
  const bucket = admin.storage.from("tenant-documents");
  const upload = await bucket.upload(storagePath, bytes, { contentType: detectedType, cacheControl: "0", upsert: false });
  if (upload.error) return NextResponse.json({ error: "Unable to store student photo." }, { status: 503 });

  const { error } = await admin.rpc("update_student_photo_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_person_id: personId,
    p_storage_path: storagePath
  });

  if (error) {
    await bucket.remove([storagePath]);
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) {
      return NextResponse.json({ error: "Student update permission required." }, { status: 403 });
    }
    if (message.includes("not available")) {
      return NextResponse.json({ error: "Student is not available in this branch." }, { status: 404 });
    }
    if (message.includes("storage path")) {
      return NextResponse.json({ error: "Student photo path was rejected." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to attach the student photo." }, { status: 500 });
  }

  return NextResponse.json(
    { result: { personId, photoAttached: true } },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}
