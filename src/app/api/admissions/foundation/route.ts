import { NextResponse } from "next/server";
import {
  defaultAdmissionFormSections,
  defaultAdmissionWorkflowNodes,
  defaultAdmissionWorkflowTransitions,
  parseAdmissionsFoundationInput,
  validateDefaultAdmissionWorkflow
} from "@/lib/admissions/foundation";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
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

  if (!workspace.branchId) {
    return NextResponse.json({ error: "Active primary branch required." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseAdmissionsFoundationInput(body);
  if (!parsed.value) {
    return NextResponse.json({ error: parsed.errors[0] ?? "Invalid admissions setup." }, { status: 400 });
  }

  const workflowValidation = validateDefaultAdmissionWorkflow();
  if (!workflowValidation.valid) {
    return NextResponse.json({ error: "Admission workflow contract is invalid." }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("setup_admissions_foundation", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_session_key: parsed.value.sessionKey,
    p_session_labels: parsed.value.sessionLabels,
    p_starts_on: parsed.value.startsOn,
    p_ends_on: parsed.value.endsOn,
    p_program_key: parsed.value.programKey,
    p_program_labels: parsed.value.programLabels,
    p_program_type: parsed.value.programType,
    p_form_sections: defaultAdmissionFormSections,
    p_workflow_nodes: defaultAdmissionWorkflowNodes,
    p_workflow_transitions: defaultAdmissionWorkflowTransitions
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) {
      return NextResponse.json({ error: "Admissions setup permission required." }, { status: 403 });
    }
    if (message.includes("already exists with incompatible")) {
      return NextResponse.json({ error: "A session or program key already exists with different settings." }, { status: 409 });
    }
    if (message.includes("invalid") || message.includes("required")) {
      return NextResponse.json({ error: "Admissions setup values are invalid." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to activate admissions foundation." }, { status: 500 });
  }

  return NextResponse.json(
    { result: data },
    {
      status: 201,
      headers: { "cache-control": "no-store" }
    }
  );
}
