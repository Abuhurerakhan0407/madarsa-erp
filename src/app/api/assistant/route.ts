import { NextResponse } from "next/server";
import { answerOperationalQuestion } from "@/lib/assistant/operational";
import { disabledCapabilityResponse } from "@/lib/capabilities/server";
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
  const parsed = await readBoundedJson(request, 8192);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const body = parsed.value as Record<string, unknown>;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const locale = body.locale === "ur" ? "ur" : "en";
  if (question.length < 2 || question.length > 500) {
    return NextResponse.json(
      { error: "Question must be between 2 and 500 characters." },
      { status: 400 }
    );
  }

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) {
    return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  }
  const capabilityDenied = disabledCapabilityResponse(workspace, "ai_assistant");
  if (capabilityDenied) return capabilityDenied;

  const admin = createAdminClient();
  const { data: allowed, error } = await admin.rpc("operator_has_permission_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_permission_code: "ai.assistant.use"
  });
  if (error || allowed !== true) {
    return NextResponse.json({ error: "Assistant permission required." }, { status: 403 });
  }

  const result = await answerOperationalQuestion(question, locale);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
