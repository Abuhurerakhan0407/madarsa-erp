import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

type SimpleAction = "accept" | "request_information" | "reject";
type ApplicationRecord = { id: number; branch_id: number; state: string };
type ProgressAction = "start_review" | "complete_review" | "offer" | "reject";
type ProgressResult = { state?: string };

type AdminClient = ReturnType<typeof createAdminClient>;

function positiveId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function actionValue(value: unknown): SimpleAction | null {
  return value === "accept" || value === "request_information" || value === "reject" ? value : null;
}

function reasonValue(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 2000) : "";
}

async function progressAdmission(
  admin: AdminClient,
  input: {
    identityId: string;
    tenantId: number;
    applicationId: number;
    action: ProgressAction;
    reason?: string;
  }
): Promise<string> {
  const { data, error } = await admin.rpc("progress_admission_staff", {
    p_identity_id: input.identityId,
    p_tenant_id: input.tenantId,
    p_application_id: input.applicationId,
    p_action: input.action,
    p_reason: input.reason ?? null
  });
  if (error) throw error;
  const result = (data ?? {}) as ProgressResult;
  if (!result.state) throw new Error("Admission state did not update.");
  return result.state;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid admission action." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const applicationId = positiveId(input.applicationId);
  const action = actionValue(input.action);
  const reason = reasonValue(input.reason);
  if (!applicationId || !action) {
    return NextResponse.json({ error: "Choose a valid admission action." }, { status: 400 });
  }
  if ((action === "request_information" || action === "reject") && reason.length < 8) {
    return NextResponse.json({ error: "Explain the reason in at least 8 characters." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id,branch_id,state")
    .eq("tenant_id", workspace.tenantId)
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return NextResponse.json({ error: "Unable to load this application." }, { status: 500 });
  }
  if (!application) {
    return NextResponse.json({ error: "Admission application not found." }, { status: 404 });
  }

  const app = application as ApplicationRecord;
  const permissions = action === "request_information"
    ? ["admissions.application.review"]
    : ["admissions.application.review", "admissions.application.decide"];

  for (const permission of permissions) {
    const { data: allowed, error: permissionError } = await admin.rpc("operator_has_permission_v1", {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_branch_id: app.branch_id,
      p_permission_code: permission
    });
    if (permissionError) {
      return NextResponse.json({ error: "Unable to verify admission permission." }, { status: 500 });
    }
    if (allowed !== true) {
      return NextResponse.json({ error: "Admission permission required." }, { status: 403 });
    }
  }

  if (action === "request_information") {
    const { data, error } = await admin.rpc("request_admission_information_v3", {
      p_identity_id: identity.id,
      p_tenant_id: workspace.tenantId,
      p_application_id: applicationId,
      p_reason: reason
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("permission denied")) {
        return NextResponse.json({ error: "Admission review permission required." }, { status: 403 });
      }
      if (message.includes("not found")) {
        return NextResponse.json({ error: "Admission application not found." }, { status: 404 });
      }
      if (message.includes("under review") || message.includes("explain") || message.includes("too long")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: "Unable to request information." }, { status: 500 });
    }
    return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
  }

  let state: string = app.state;
  const progressBase = {
    identityId: identity.id,
    tenantId: workspace.tenantId,
    applicationId
  };

  try {
    if (action === "accept") {
      if (state === "submitted") {
        state = await progressAdmission(admin, { ...progressBase, action: "start_review" });
      }
      if (state === "verification") {
        state = await progressAdmission(admin, { ...progressBase, action: "complete_review" });
      }
      if (state === "decision") {
        state = await progressAdmission(admin, {
          ...progressBase,
          action: "offer",
          reason: reason.length >= 8 ? reason : "Accepted for admission by office."
        });
      }
      if (state !== "offered" && state !== "payment_pending" && state !== "enrolled") {
        return NextResponse.json({ error: "This application cannot be accepted from its current state." }, { status: 409 });
      }
    } else {
      if (state === "rejected") {
        return NextResponse.json({ result: { applicationId, state, idempotent: true } }, { status: 200 });
      }
      if (state === "submitted") {
        state = await progressAdmission(admin, { ...progressBase, action: "start_review" });
      }
      if (state === "verification") {
        state = await progressAdmission(admin, { ...progressBase, action: "complete_review" });
      }
      if (state === "decision") {
        state = await progressAdmission(admin, { ...progressBase, action: "reject", reason });
      }
      if (state !== "rejected") {
        return NextResponse.json({ error: "This application can no longer be rejected from its current state." }, { status: 409 });
      }
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message.toLowerCase() : "";
    if (message.includes("permission denied")) {
      return NextResponse.json({ error: "Admission permission required." }, { status: 403 });
    }
    if (message.includes("conflict")) {
      return NextResponse.json({ error: "Application state changed. Reload and try again." }, { status: 409 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({ error: "Admission application not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to update this application." }, { status: 500 });
  }

  return NextResponse.json(
    { result: { applicationId, state } },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
