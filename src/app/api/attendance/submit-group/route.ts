import { NextResponse } from "next/server";
import { validateAttendanceGroupSubmission } from "@/lib/attendance/model";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 32768) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });

  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active branch membership required." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const validation = validateAttendanceGroupSubmission(body);
  if (!validation.value) return NextResponse.json({ error: validation.errors[0] || "Invalid attendance register.", details: validation.errors }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("submit_student_attendance_group_v1", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_attendance_session_id: validation.value.attendanceSessionId,
    p_group_id: validation.value.groupId,
    p_exceptions: validation.value.exceptions.map((item) => ({ person_id: item.personId, status_key: item.statusKey }))
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Attendance marking permission required." }, { status: 403 });
    if (message.includes("not available") || message.includes("not part of") || message.includes("selected group")) return NextResponse.json({ error: error.message }, { status: 404 });
    if (message.includes("not open")) return NextResponse.json({ error: error.message }, { status: 409 });
    if (message.includes("invalid") || message.includes("configured") || message.includes("duplicate") || message.includes("too many")) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Unable to save attendance." }, { status: 500 });
  }

  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}
