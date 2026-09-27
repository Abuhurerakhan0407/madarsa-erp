import { NextResponse } from "next/server";
import { validateAttendanceMarkInput } from "@/lib/attendance/model";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 8192) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });
  const parsedBody = await readBoundedJson(request, 8_192);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  const body = parsedBody.value;
  const validation = validateAttendanceMarkInput(body);
  if (!validation.value) return NextResponse.json({ error: validation.errors[0] || "Invalid attendance mark.", details: validation.errors }, { status: 400 });
  const value = validation.value;
  if (value.source !== "manual" || value.sourceRef) return NextResponse.json({ error: "Device attendance must use the dedicated device ingestion channel." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("mark_student_attendance_emergency_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_attendance_session_id: value.attendanceSessionId,
    p_person_id: value.personId,
    p_status_key: value.statusKey,
    p_note: value.note ?? null
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("not authorized")) return NextResponse.json({ error: "Emergency Manual Attendance is not active for this student or has expired." }, { status: 403 });
    if (message.includes("permission denied")) return NextResponse.json({ error: "Attendance marking permission required." }, { status: 403 });
    if (message.includes("not available") || message.includes("not part of")) return NextResponse.json({ error: "Student or attendance session is not available in this branch." }, { status: 404 });
    if (message.includes("already marked")) return NextResponse.json({ error: "Attendance is already marked. Submit a correction instead.", correctionRequired: true }, { status: 409 });
    if (message.includes("status") || message.includes("source") || message.includes("note")) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Unable to mark attendance." }, { status: 500 });
  }
  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}
