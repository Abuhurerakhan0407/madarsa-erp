import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  staffAdmissionApplicantData,
  validateStaffAdmissionInput
} from "@/lib/admissions/staff-admission-model";
import {
  isJsonRequest,
  isSameOriginRequest,
  readBoundedJson
} from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function mutationError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission denied")) {
    return { status: 403, error: "Admission draft permission required." };
  }
  if (normalized.includes("not found")) {
    return { status: 404, error: "Admission draft not found." };
  }
  if (
    normalized.includes("state changed") ||
    normalized.includes("only draft") ||
    normalized.includes("unavailable")
  ) {
    return { status: 409, error: message };
  }
  if (
    normalized.includes("invalid") ||
    normalized.includes("required") ||
    normalized.includes("language")
  ) {
    return { status: 422, error: message };
  }
  return { status: 500, error: "Unable to save this admission draft." };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const parsed = await readBoundedJson(request, 32_768);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json(
      { error: "Active branch membership required." },
      { status: 403 }
    );
  }

  const body =
    parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)
      ? (parsed.value as Record<string, unknown>)
      : {};
  const action = body.action === "discard" ? "discard" : "save";
  const admin = createAdminClient();

  if (action === "discard") {
    const draftId = positiveInteger(body.draftId);
    if (!draftId) {
      return NextResponse.json({ error: "Draft id is invalid." }, { status: 400 });
    }

    const { data, error } = await admin.rpc("discard_staff_admission_draft_v1", {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: workspace.branchId,
      p_application_id: draftId
    });

    if (error) {
      const mapped = mutationError(error.message);
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    return NextResponse.json(
      { result: data },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }

  const validation = validateStaffAdmissionInput(body);
  if (!validation.value) {
    return NextResponse.json(
      {
        error: validation.errors[0] ?? "Admission draft is invalid.",
        details: validation.errors
      },
      { status: 400 }
    );
  }

  const value = validation.value;
  const { data, error } = await admin.rpc("save_staff_admission_draft_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_application_id: value.draftId ?? null,
    p_session_id: value.sessionId,
    p_program_id: value.programId,
    p_group_id: value.groupId ?? null,
    p_preferred_locale: value.preferredLocale,
    p_applicant_data: staffAdmissionApplicantData(value),
    p_tracking_secret_hash: value.draftId ? null : randomBytes(32).toString("hex"),
    p_photo_token_digest: value.photoToken ? sha256(value.photoToken) : null
  });

  if (error) {
    const mapped = mutationError(error.message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  return NextResponse.json(
    { result: data },
    { status: value.draftId ? 200 : 201, headers: { "cache-control": "no-store" } }
  );
}
