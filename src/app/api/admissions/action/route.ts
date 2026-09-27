import { NextResponse } from "next/server";
import { validateAdmissionStaffAction } from "@/lib/admissions/staff-action-model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  }

  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  }

  const identity = await getVerifiedIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id) {
    return NextResponse.json({ error: "Active tenant membership required." }, { status: 403 });
  }

  const parsedBody = await readBoundedJson(request, 8_192);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }

  const validation = validateAdmissionStaffAction(parsedBody.value);
  if (!validation.value) {
    return NextResponse.json(
      { error: validation.errors[0] ?? "Invalid admission action." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("progress_admission_staff", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_application_id: validation.value.applicationId,
    p_action: validation.value.action,
    p_reason: validation.value.reason ?? null
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) {
      return NextResponse.json({ error: "Admission action permission required." }, { status: 403 });
    }
    if (message.includes("transition conflict") || message.includes("workflow instance conflict")) {
      return NextResponse.json({ error: "Application state changed. Reload and try again." }, { status: 409 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({ error: "Admission application not found." }, { status: 404 });
    }
    if (message.includes("invalid") || message.includes("reason") || message.includes("unavailable")) {
      return NextResponse.json({ error: "Admission action is invalid for this application." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update admission application." }, { status: 500 });
  }

  return NextResponse.json(
    { result: data },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
