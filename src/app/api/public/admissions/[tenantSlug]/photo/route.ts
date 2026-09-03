import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPublicAdmissionsContext } from "@/lib/admissions/public-intake-context";
import { isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ tenantSlug: string }>;
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TTL_MS = 30 * 60 * 1000;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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

  const extension = allowedTypes.get(photo.type);
  if (!extension) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP student photo." }, { status: 415 });
  }
  if (photo.size < 1 || photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Student photo must be 5 MB or smaller." }, { status: 413 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenDigest = sha256(token);
  const storagePath = `${intake.tenant.id}/admissions/intake/${randomBytes(18).toString("hex")}.${extension}`;
  const admin = createAdminClient();
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const bucket = admin.storage.from("tenant-documents");
  const upload = await bucket.upload(storagePath, bytes, {
    contentType: photo.type,
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
    content_type: photo.type,
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
