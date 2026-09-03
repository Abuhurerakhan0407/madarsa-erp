import { randomBytes } from "node:crypto";
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

function temporaryPassword(): string {
  return `${randomBytes(18).toString("base64url")}!aA7`;
}

function guardianEmail(application: ApplicationRecord): string {
  const value = application.applicant_data?.guardian_email;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function removeUnlinkedIdentity(admin: ReturnType<typeof createAdminClient>, identityId: string) {
  try {
    await admin.auth.admin.deleteUser(identityId);
  } catch {
    // Best-effort compensation only. Never expose credentials or auth internals in the response.
  }
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

  const { data: canCreateCredentials, error: permissionError } = await admin.rpc(
    "operator_has_permission_v1",
    {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: app.branch_id,
      p_permission_code: "portal.credentials.create"
    }
  );

  if (permissionError) {
    return NextResponse.json({ error: "Unable to verify portal credential permission." }, { status: 500 });
  }
  if (canCreateCredentials !== true) {
    return NextResponse.json({ error: "Guardian credential permission required." }, { status: 403 });
  }

  // A lost/retried success response must not rotate a password or require the staged photo again.
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
          credentialState: "existing_account"
        }
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }

  const { data: existingIdentity, error: identityLookupError } = await admin.rpc(
    "find_auth_identity_by_email_v1",
    { p_email: email }
  );
  if (identityLookupError) {
    return NextResponse.json({ error: "Unable to resolve guardian login identity." }, { status: 500 });
  }

  let guardianIdentityId = typeof existingIdentity === "string" ? existingIdentity : "";
  let generatedPassword: string | null = null;
  let createdIdentity = false;

  if (!guardianIdentityId) {
    generatedPassword = temporaryPassword();
    const created = await admin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
        portal_account: true,
        provisioned_from: "admission_conversion"
      }
    });

    if (created.error || !created.data.user?.id) {
      // Handle an email-create race without ever resetting an existing account's password.
      const retry = await admin.rpc("find_auth_identity_by_email_v1", { p_email: email });
      if (retry.error || typeof retry.data !== "string") {
        return NextResponse.json({ error: "Unable to create guardian portal account." }, { status: 503 });
      }
      guardianIdentityId = retry.data;
      generatedPassword = null;
    } else {
      guardianIdentityId = created.data.user.id;
      createdIdentity = true;
    }
  }

  const { data, error } = await admin.rpc("convert_admission_to_student_v2", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_application_id: validation.value.applicationId,
    p_guardian_identity_id: guardianIdentityId,
    p_confirm_new_person: validation.value.confirmNewPerson
  });

  if (error) {
    if (createdIdentity) await removeUnlinkedIdentity(admin, guardianIdentityId);
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
      message.includes("guardian identity")
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
    if (createdIdentity) await removeUnlinkedIdentity(admin, guardianIdentityId);
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
        revision: result.revision,
        guardianPersonId: result.guardian_person_id,
        guardianEmail: result.guardian_email ?? email,
        guardianLinked: result.guardian_linked === true,
        groupId: result.group_id,
        photoAttached: result.photo_attached === true,
        credentialState: createdIdentity ? "temporary_password_created" : "existing_account",
        temporaryPassword: createdIdentity ? generatedPassword : undefined
      }
    },
    {
      status: result.converted === true ? 201 : 200,
      headers: { "cache-control": "no-store" }
    }
  );
}
