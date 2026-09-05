import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type AdmissionPhotoType = "image/jpeg" | "image/png" | "image/webp";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TTL_MS = 2 * 60 * 60 * 1000;
const allowedTypes = new Map<AdmissionPhotoType, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function has(bytes: Uint8Array, offset: number, values: readonly number[]) {
  return values.every((value, index) => bytes[offset + index] === value);
}

function detectPhotoType(bytes: Uint8Array): AdmissionPhotoType | null {
  if (bytes.length >= 3 && has(bytes, 0, [255, 216, 255])) return "image/jpeg";
  if (bytes.length >= 8 && has(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (bytes.length >= 12 && has(bytes, 0, [82, 73, 70, 70]) && has(bytes, 8, [87, 69, 66, 80])) return "image/webp";
  return null;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin upload blocked." }, { status: 403 });
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Multipart photo upload required." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_PHOTO_BYTES + 512 * 1024) {
    return NextResponse.json({ error: "Student photo must be 5 MB or smaller." }, { status: 413 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id) {
    return NextResponse.json({ error: "Active tenant membership required." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Unable to read student photo." }, { status: 400 });
  }

  const applicationId = Number(formData.get("applicationId"));
  const photo = formData.get("photo");
  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
    return NextResponse.json({ error: "Admission application is invalid." }, { status: 400 });
  }
  if (!(photo instanceof File)) return NextResponse.json({ error: "Student photo is required." }, { status: 400 });
  if (photo.size < 1 || photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Student photo must be 5 MB or smaller." }, { status: 413 });
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const detectedType = detectPhotoType(bytes);
  if (!detectedType || photo.type !== detectedType) {
    return NextResponse.json({ error: "Use a genuine JPEG, PNG, or WebP student photo." }, { status: 415 });
  }
  const extension = allowedTypes.get(detectedType);
  if (!extension) return NextResponse.json({ error: "Unsupported student photo type." }, { status: 415 });

  const admin = createAdminClient();
  const storagePath = `${workspace.tenantId}/admissions/intake/${randomBytes(18).toString("hex")}.${extension}`;
  const bucket = admin.storage.from("tenant-documents");
  const upload = await bucket.upload(storagePath, bytes, { contentType: detectedType, cacheControl: "0", upsert: false });
  if (upload.error) return NextResponse.json({ error: "Unable to store student photo." }, { status: 503 });

  const tokenDigest = sha256(randomBytes(32).toString("base64url"));
  const expiresAt = new Date(Date.now() + PHOTO_TTL_MS).toISOString();
  const { data, error } = await admin.rpc("register_admission_photo_v3", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_application_id: applicationId,
    p_token_digest: tokenDigest,
    p_storage_path: storagePath,
    p_content_type: detectedType,
    p_size_bytes: photo.size,
    p_expires_at: expiresAt
  });

  if (error) {
    await bucket.remove([storagePath]);
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Admission review permission required." }, { status: 403 });
    if (message.includes("not found")) return NextResponse.json({ error: "Admission application not found." }, { status: 404 });
    if (message.includes("can no longer")) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to attach the student photo." }, { status: 500 });
  }

  return NextResponse.json({ result: data, expiresAt }, { status: 201, headers: { "cache-control": "no-store" } });
}
