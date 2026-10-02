import { createHash } from "node:crypto";
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

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function finalizeError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission denied")) {
    return { status: 403, error: "Admission completion permission required." };
  }
  if (normalized.includes("not found")) {
    return { status: 404, error: "Admission draft not found." };
  }
  if (
    normalized.includes("state changed") ||
    normalized.includes("workflow") ||
    normalized.includes("numbering") ||
    normalized.includes("already has enrollment") ||
    normalized.includes("matches multiple records") ||
    normalized.includes("unavailable")
  ) {
    return { status: 409, error: message };
  }
  if (
    normalized.includes("invalid") ||
    normalized.includes("required") ||
    normalized.includes("photo") ||
    normalized.includes("guardian") ||
    normalized.includes("student name") ||
    normalized.includes("joining date") ||
    normalized.includes("gender") ||
    normalized.includes("class or group")
  ) {
    return { status: 422, error: message };
  }
  return { status: 500, error: "Unable to create this admission." };
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

  const validation = validateStaffAdmissionInput(parsed.value, { final: true });
  if (!validation.value || !validation.value.draftId) {
    return NextResponse.json(
      {
        error:
          validation.errors[0] ??
          "Save the admission as a draft before final submission.",
        details: validation.errors
      },
      { status: 400 }
    );
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

  const value = validation.value;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("finalize_staff_admission_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_application_id: value.draftId,
    p_session_id: value.sessionId,
    p_program_id: value.programId,
    p_group_id: value.groupId,
    p_preferred_locale: value.preferredLocale,
    p_applicant_data: staffAdmissionApplicantData(value),
    p_photo_token_digest: value.photoToken ? sha256(value.photoToken) : null,
    p_confirm_new_person: value.confirmNewPerson === true
  });

  if (error) {
    const mapped = finalizeError(error.message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const result = (data ?? {}) as {
    duplicate_review_required?: boolean;
    candidate_count?: number;
    person_id?: number;
    student_number?: string;
    enrollment_id?: number;
    guardian_person_id?: number;
    guardian_email?: string;
    idempotent?: boolean;
  };

  if (result.duplicate_review_required) {
    return NextResponse.json(
      {
        error:
          "A possible matching student already exists. Confirm only after reviewing the details.",
        duplicateReviewRequired: true,
        candidateCount: result.candidate_count ?? 0,
        result: {
          draftId: value.draftId
        }
      },
      { status: 409, headers: { "cache-control": "no-store" } }
    );
  }

  if (!result.person_id || !result.student_number || !result.enrollment_id) {
    return NextResponse.json(
      { error: "Admission completed without a valid student linkage." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      result: {
        created: result.idempotent !== true,
        idempotent: result.idempotent === true,
        draftId: value.draftId,
        personId: result.person_id,
        studentNumber: result.student_number,
        enrollmentId: result.enrollment_id,
        guardianPersonId: result.guardian_person_id,
        guardianEmail: result.guardian_email
      }
    },
    { status: result.idempotent === true ? 200 : 201, headers: { "cache-control": "no-store" } }
  );
}
