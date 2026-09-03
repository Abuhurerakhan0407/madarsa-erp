import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPublicAdmissionsContext } from "@/lib/admissions/public-intake-context";
import { isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ tenantSlug: string }>;
};

type AdmissionPhotoType = "image/jpeg" | "image/png" | "image/webp";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TTL_MS = 30 * 60 * 1000;
const allowedTypes = new Map<AdmissionPhotoType, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function has(bytes: Uint8Array, offset: number, values: readonly number[]): boolean {
  return values.every((value, index) => bytes[offset + index] === value);
}

function detectPhotoType(bytes: Uint8Array): AdmissionPhotoType | null {
  if (bytes.length >= 3 && has(bytes, 0, [255, 216, 255])) return "image/jpeg";
  if (bytes.length >= 8 && has(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (
    bytes.length >= 12
    && has(bytes, 0, [82, 73, 70, 70])
    && has(bytes, 8, [87, 69, 66, 80])
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin upload blocked." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Multipart photo upload required." }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_PHOTO_BYTES + 512 * 1024) {
    return NextResponse.json({ error: "Student photo must be 5 MB or smaller." }, { status: 413 });
  }

  const { tenantSlug } = await params;
  let intake;
  try {
    intake = await getPublicAdmissionsContext(tenantSlug);
  } catch {
    return NextResponse.json({ error: "Admissions are temporarily unavailable." }, { status: 503 });
  }
  if (!intake) {
    return NextResponse.json({ error: "Admissions are not available for this institution." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Unable to read student photo." }, { status: 400 });
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "Student photo is required." }, { status: 400 });
  }
  if (photo.size < 1 || photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Student photo must be 5 MB or smaller." }, { status: 413 });
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const detectedType = detectPhotoType(bytes);
  if (!detectedType || photo.type !== detectedType) {
    return NextResponse.json({ error: "Use a genuine JPEG, PNG, or WebP student photo." }, { status: 415 });
  }
  const extension = allowedTypes.get(detectedType);
  if (!extension) {
    return NextResponse.json({ error: "Unsupported student photo type." }, { status: 415 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenDigest = sha256(token);
  const storagePath = `${intake.tenant.id}/admissions/intake/${randomBytes(18).toString("hex")}.${extension}`;
  const admin = createAdminClient();
  const bucket = admin.storage.from("tenant-documents");
  const upload = await bucket.upload(storagePath, bytes, {
    contentType: detectedType,
    cacheControl: "0",
    upsert: false
  });

  if (upload.error) {
    return NextResponse.json({ error: "Unable to store student photo." }, { status: 503 });
  }

  const expiresAt = new Date(Date.now() + PHOTO_TTL_MS).toISOString();
  const { error: recordError } = await admin.from("public_admission_photo_uploads").insert({
    tenant_id: intake.tenant.id,
    token_digest: tokenDigest,
    storage_path: storagePath,
    content_type: detectedType,
    size_bytes: photo.size,
    expires_at: expiresAt
  });

  if (recordError) {
    await bucket.remove([storagePath]);
    return NextResponse.json({ error: "Unable to prepare student photo." }, { status: 503 });
  }

  return NextResponse.json(
    { photoToken: token, expiresAt },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}
