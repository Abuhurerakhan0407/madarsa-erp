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
  guardian_person_id?: number;
  guardian_email?: string;
  guardian_linked?: boolean;
  group_id?: number;
  photo_attached?: boolean;
};

type ApplicationRecord = {
  id: number;
  branch_id: number;
  state: string;
  applicant_data: Record<string, unknown> | null;
};

type PortalAccessState = "existing_account" | "manage_separately";

function guardianEmail(application: ApplicationRecord): string {
  const value = application.applicant_data?.guardian_email;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

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
  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id, branch_id, state, applicant_data")
    .eq("tenant_id", workspace.tenantId)
    .eq("id", validation.value.applicationId)
    .maybeSingle();

  if (applicationError) {
    return NextResponse.json({ error: "Unable to load admission application." }, { status: 500 });
  }
  if (!application) {
    return NextResponse.json({ error: "Admission application not found." }, { status: 404 });
  }

  const app = application as ApplicationRecord;
  const email = guardianEmail(app);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid guardian email is required before enrollment." }, { status: 422 });
  }

  // A lost/retried success response must never change portal access.
  if (app.state === "enrolled") {
    const { data, error } = await admin.rpc("convert_admission_to_student", {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_application_id: validation.value.applicationId,
      p_confirm_new_person: validation.value.confirmNewPerson
    });
    if (error) {
      return NextResponse.json({ error: "Unable to confirm existing enrollment." }, { status: 409 });
    }
    const result = (data ?? {}) as ConversionResult;
    return NextResponse.json(
      {
        result: {
          converted: false,
          idempotent: true,
          applicationId: result.application_id,
          personId: result.person_id,
          studentNumber: result.student_number,
          enrollmentId: result.enrollment_id,
          state: result.state,
          revision: result.revision,
          guardianEmail: email,
          portalAccessState: "manage_separately" satisfies PortalAccessState,
          portalAccessWarning: "Enrollment already exists. Manage guardian login from Parent & Teacher Access; no password was changed."
        }
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }

  const { data, error } = await admin.rpc("convert_admission_to_student_v3", {
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
      message.includes("conversion linkage") ||
      message.includes("class or group") ||
      message.includes("student photo") ||
      message.includes("guardian email matches multiple records")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (
      message.includes("applicant name") ||
      message.includes("date of birth") ||
      message.includes("linked applicant person") ||
      message.includes("guardian name") ||
      message.includes("guardian email") ||
      message.includes("guardian relationship") ||
      message.includes("student gender") ||
      message.includes("native student name") ||
      message.includes("joining date")
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

  let portalAccessState: PortalAccessState = "manage_separately";
  let portalAccessWarning = "Student enrollment succeeded. Create or manage guardian login from Parent & Teacher Access.";
  const guardianPersonId = Number(result.guardian_person_id ?? 0);

  if (guardianPersonId > 0) {
    const { data: links, error: linkError } = await admin
      .from("identity_person_links")
      .select("identity_id,status,updated_at")
      .eq("tenant_id", workspace.tenantId)
      .eq("person_id", guardianPersonId)
      .eq("link_type", "guardian")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!linkError && links?.[0]?.identity_id && links[0].status === "verified") {
      portalAccessState = "existing_account";
      portalAccessWarning = "Student enrollment succeeded. This guardian already has verified portal access.";
    } else if (!linkError && links?.[0]?.identity_id) {
      portalAccessWarning = "Student enrollment succeeded. Existing guardian access is disabled or pending; manage it from Parent & Teacher Access.";
    } else if (linkError) {
      portalAccessWarning = "Student enrollment succeeded, but guardian access could not be checked. Manage it from Parent & Teacher Access.";
    }
  } else {
    portalAccessWarning = "Student enrollment succeeded, but no linked guardian is available for portal setup. Manage guardian details before creating portal access.";
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
        revision: result.revision,
        guardianPersonId: result.guardian_person_id,
        guardianEmail: result.guardian_email ?? email,
        guardianLinked: result.guardian_linked === true,
        groupId: result.group_id,
        photoAttached: result.photo_attached === true,
        portalAccessState,
        portalAccessWarning
      }
    },
    {
      status: result.converted === true ? 201 : 200,
      headers: { "cache-control": "no-store" }
    }
  );
}
