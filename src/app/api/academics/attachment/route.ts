import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  academicAttachmentExtensions,
  detectAcademicAttachmentType,
  isAcademicAttachmentKind,
  MAX_ACADEMIC_ATTACHMENT_BYTES
} from "@/lib/academics/attachment-model";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
import { isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

const TTL_MS = 60 * 60 * 1000;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin upload blocked." }, { status: 403 });
  }
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Multipart attachment upload required." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_ACADEMIC_ATTACHMENT_BYTES + 768 * 1024
  ) {
    return NextResponse.json({ error: "Attachment must be 8 MB or smaller." }, { status: 413 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }
  const capabilityDenied = disabledCapabilityResponse(workspace, "academics_timetable_homework");
  if (capabilityDenied) return capabilityDenied;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Unable to read attachment." }, { status: 400 });
  }
  const kind = formData.get("kind");
  const attachment = formData.get("attachment");
  if (!isAcademicAttachmentKind(kind)) {
    return NextResponse.json(
      { error: "Attachment kind must be homework or calendar." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const permissionCode =
    kind === "homework" ? "academics.homework.manage" : "academics.structure.manage";
  const { data: allowed, error: permissionError } = await admin.rpc(
    "operator_has_permission_v1",
    {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_permission_code: permissionCode
    }
  );
  if (permissionError) {
    return NextResponse.json(
      { error: "Unable to verify attachment permission." },
      { status: 500 }
    );
  }
  if (allowed !== true) {
    return NextResponse.json(
      { error: "Academic management permission required." },
      { status: 403 }
    );
  }

  if (!(attachment instanceof File)) {
    return NextResponse.json({ error: "Attachment file is required." }, { status: 400 });
  }
  if (attachment.size < 1 || attachment.size > MAX_ACADEMIC_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Attachment must be 8 MB or smaller." }, { status: 413 });
  }

  const bytes = new Uint8Array(await attachment.arrayBuffer());
  const detected = detectAcademicAttachmentType(bytes);
  if (!detected || attachment.type !== detected) {
    return NextResponse.json(
      { error: "Use a genuine PDF, JPEG, PNG, or WebP attachment." },
      { status: 415 }
    );
  }
  const extension = academicAttachmentExtensions.get(detected);
  if (!extension) {
    return NextResponse.json({ error: "Unsupported attachment type." }, { status: 415 });
  }

  const token = randomBytes(32).toString("base64url");
  const digest = sha256(token);
  const opaque = randomBytes(18).toString("hex");
  const storagePath = `${workspace.tenantId}/academics/${kind}/${opaque}.${extension}`;
  const bucket = admin.storage.from("tenant-documents");
  const upload = await bucket.upload(storagePath, bytes, {
    contentType: detected,
    cacheControl: "0",
    upsert: false
  });
  if (upload.error) {
    return NextResponse.json({ error: "Unable to store academic attachment." }, { status: 503 });
  }

  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const { error: recordError } = await admin.from("academic_attachment_uploads").insert({
    tenant_id: workspace.tenantId,
    token_digest: digest,
    kind,
    storage_path: storagePath,
    content_type: detected,
    size_bytes: attachment.size,
    expires_at: expiresAt
  });
  if (recordError) {
    await bucket.remove([storagePath]);
    return NextResponse.json(
      { error: "Unable to prepare academic attachment." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { attachmentToken: token, expiresAt },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}
