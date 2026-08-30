import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";
import { validateStudentGuardianInput } from "@/lib/students/guardian-model";

export async function PUT(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 8192) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });

  const personId = Number((await params).personId);
  if (!Number.isInteger(personId) || personId <= 0) return NextResponse.json({ error: "Invalid student." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const validation = validateStudentGuardianInput(body);
  if (!validation.value) return NextResponse.json({ error: validation.errors[0] || "Invalid guardian details.", details: validation.errors }, { status: 400 });

  const value = validation.value;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("upsert_student_primary_guardian", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_student_person_id: personId,
    p_name: value.name,
    p_relationship: value.relationship,
    p_phone: value.phone ?? null,
    p_occupation: value.occupation ?? null,
    p_education: value.education ?? null,
    p_can_collect: value.canCollect
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Guardian management permission required." }, { status: 403 });
    if (message.includes("not available")) return NextResponse.json({ error: "Student is not available in this branch." }, { status: 404 });
    if (message.includes("guardian name") || message.includes("relationship") || message.includes("phone") || message.includes("occupation") || message.includes("education")) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Unable to update guardian details." }, { status: 500 });
  }

  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}
