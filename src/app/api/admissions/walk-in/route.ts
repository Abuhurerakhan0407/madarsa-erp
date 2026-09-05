import { NextResponse } from "next/server";
import { validateWalkInAdmissionInput } from "@/lib/admissions/walk-in-model";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type WalkInResult = {
  created?: boolean;
  duplicate_review_required?: boolean;
  candidate_count?: number;
  person_id?: number;
  student_number?: string;
  enrollment_id?: number;
  guardian_person_id?: number;
  reported_age_years?: number;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 16384) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateWalkInAdmissionInput(body);
  if (!validation.value) {
    return NextResponse.json(
      { error: validation.errors[0] ?? "Check the admission details and try again.", details: validation.errors },
      { status: 400 }
    );
  }

  const value = validation.value;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_walk_in_admission_v3", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_display_name: value.displayName,
    p_name_native: value.nameNative ?? null,
    p_date_of_birth: value.dateOfBirth ?? null,
    p_age_years: value.ageYears ?? null,
    p_gender: value.gender ?? null,
    p_preferred_locale: value.preferredLocale,
    p_session_id: value.sessionId,
    p_program_id: value.programId,
    p_group_id: value.groupId ?? null,
    p_joined_on: value.joinedOn ?? null,
    p_medical_summary: value.medicalSummary ?? null,
    p_accessibility_needs: value.accessibilityNeeds ?? null,
    p_pickup_restrictions: value.pickupRestrictions ?? null,
    p_guardian: value.guardian ?? null,
    p_confirm_new_person: value.confirmNewPerson === true
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) {
      return NextResponse.json({ error: "You do not have permission to admit students." }, { status: 403 });
    }
    if (
      message.includes("academic session") ||
      message.includes("program") ||
      message.includes("class or group") ||
      message.includes("numbering") ||
      message.includes("joining date")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (
      message.includes("student name") ||
      message.includes("date of birth") ||
      message.includes("age") ||
      message.includes("gender") ||
      message.includes("guardian")
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Unable to admit the student." }, { status: 500 });
  }

  const result = (data ?? {}) as WalkInResult;
  if (result.duplicate_review_required) {
    return NextResponse.json(
      {
        error: value.dateOfBirth
          ? "A student with the same name and date of birth may already exist."
          : "A student with the same name may already exist.",
        duplicateReviewRequired: true,
        duplicateBasis: value.dateOfBirth ? "name_and_birth" : "name_only",
        candidateCount: result.candidate_count ?? 0
      },
      { status: 409, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      result: {
        created: result.created === true,
        personId: result.person_id,
        studentNumber: result.student_number,
        enrollmentId: result.enrollment_id,
        guardianPersonId: result.guardian_person_id,
        reportedAgeYears: result.reported_age_years
      }
    },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}
