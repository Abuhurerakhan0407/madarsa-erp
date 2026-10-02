import { NextResponse } from "next/server";
import { validateStudentNumberingInput } from "@/lib/configuration/student-numbering";
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

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 8192) {
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

  if (!workspace.branchId) {
    return NextResponse.json({ error: "Active primary branch required." }, { status: 409 });
  }

  const parsedBody = await readBoundedJson(request, 8_192);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  const body = parsedBody.value;

  const validation = validateStudentNumberingInput(body);
  if (!validation.value) {
    return NextResponse.json(
      { error: validation.errors[0] ?? "Student numbering is invalid.", details: validation.errors },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("setup_student_number_sequence", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_pattern: validation.value.pattern,
    p_start_value: validation.value.startValue,
    p_padding: validation.value.padding,
    p_reset_period: validation.value.resetPeriod
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) {
      return NextResponse.json({ error: "Configuration publish permission required." }, { status: 403 });
    }
    if (message.includes("invalid") || message.includes("requires") || message.includes("must contain")) {
      return NextResponse.json({ error: "Student numbering values are invalid." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to publish student numbering." }, { status: 500 });
  }

  return NextResponse.json(
    { result: data },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}
