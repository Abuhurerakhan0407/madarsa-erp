import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 4096) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  const parsedBody = await readBoundedJson(request, 4_096);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  const body = parsedBody.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const correctionId = Number(input.correctionId);
  const decision = input.decision === "approved" || input.decision === "rejected" ? input.decision : undefined;
  const reviewReason = typeof input.reviewReason === "string" ? input.reviewReason.trim() : "";
  if (!Number.isInteger(correctionId) || correctionId <= 0) return NextResponse.json({ error: "Attendance correction is invalid." }, { status: 400 });
  if (!decision) return NextResponse.json({ error: "Correction decision is invalid." }, { status: 400 });
  if (reviewReason.length < 8 || reviewReason.length > 500) return NextResponse.json({ error: "Review reason must be between 8 and 500 characters." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("review_student_attendance_correction", { p_identity_id: identity.id, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_correction_id: correctionId, p_decision: decision, p_review_reason: reviewReason });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Attendance approval permission required." }, { status: 403 });
    if (message.includes("not available")) return NextResponse.json({ error: "Attendance correction is not available in this branch." }, { status: 404 });
    if (message.includes("no longer pending")) return NextResponse.json({ error: "This correction has already been reviewed." }, { status: 409 });
    if (message.includes("decision") || message.includes("reason")) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Unable to review attendance correction." }, { status: 500 });
  }
  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}
