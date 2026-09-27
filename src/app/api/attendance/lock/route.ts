import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 2048) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  const parsedBody = await readBoundedJson(request, 2_048);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  const body = parsedBody.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  const sessionId = Number((body as Record<string, unknown>).attendanceSessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) return NextResponse.json({ error: "Attendance session is invalid." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("lock_student_daily_attendance", { p_identity_id: identity.id, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_attendance_session_id: sessionId });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Attendance approval permission required." }, { status: 403 });
    if (message.includes("not available")) return NextResponse.json({ error: "Attendance session is not available in this branch." }, { status: 404 });
    if (message.includes("unmarked") || message.includes("pending") || message.includes("cannot be locked") || message.includes("roster")) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to lock attendance." }, { status: 500 });
  }
  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}
