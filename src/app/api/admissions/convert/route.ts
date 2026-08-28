import { NextResponse } from "next/server";
import { validateAdmissionConversionInput } from "@/lib/admissions/conversion-model";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type ConversionResult = {
  converted?: boolean;
  idempotent?: boolean;
  duplicate_review_required?: boolean;
  candidate_count?: number;
  application_id?: number;
  person_id?: number;
  student_number?: string;
  enrollment_id?: number;
  state?: string;
  revision?: number;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }

  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id) {
    return NextResponse.json({ error: "Active tenant membership required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateAdmissionConversionInput(body);
  if (!validation.value) {
    return NextResponse.json(
      { error: validation.errors[0] ?? "Invalid admission conversion request.", details: validation.errors },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("convert_admission_to_student", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_application_id: validation.value.applicationId,
    p_confirm_new_person: validation.value.confirmNewPerson
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) {
      return NextResponse.json({ error: "Admission conversion permission required." }, { status: 403 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({ error: "Admission application not found." }, { status: 404 });
    }
    if (
      message.includes("student numbering") ||
      message.includes("academic session") ||
      message.includes("application program") ||
      message.includes("workflow") ||
      message.includes("must be offered") ||
      message.includes("already has enrollment") ||
      message.includes("conversion linkage")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (
      message.includes("applicant name") ||
      message.includes("date of birth") ||
      message.includes("linked applicant person")
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Unable to enroll this applicant." }, { status: 500 });
  }

  const result = (data ?? {}) as ConversionResult;
  if (result.duplicate_review_required) {
    return NextResponse.json(
      {
        error: "A possible matching person already exists. Confirm before creating a separate student.",
        duplicateReviewRequired: true,
        candidateCount: result.candidate_count ?? 0
      },
      { status: 409, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      result: {
        converted: result.converted === true,
        idempotent: result.idempotent === true,
        applicationId: result.application_id,
        personId: result.person_id,
        studentNumber: result.student_number,
        enrollmentId: result.enrollment_id,
        state: result.state,
        revision: result.revision
      }
    },
    {
      status: result.converted === true ? 201 : 200,
      headers: { "cache-control": "no-store" }
    }
  );
}
