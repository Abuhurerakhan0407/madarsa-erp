import { NextResponse } from "next/server";
import { validateAttendanceCorrectionInput } from "@/lib/attendance/model";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
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
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const validation = validateAttendanceCorrectionInput(body);
  if (!validation.value) return NextResponse.json({ error: validation.errors[0] || "Invalid attendance correction.", details: validation.errors }, { status: 400 });
  const value = validation.value;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("correct_student_attendance", {
    p_identity_id: identity.id,
    p_tenant_id: workspace.tenantId,
    p_branch_id: workspace.branchId,
    p_attendance_record_id: value.attendanceRecordId,
    p_status_key: value.statusKey,
    p_reason: value.reason
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Attendance correction permission required." }, { status: 403 });
    if (message.includes("not available")) return NextResponse.json({ error: "Attendance record is not available in this branch." }, { status: 404 });
    if (message.includes("pending")) return NextResponse.json({ error: "A correction is already awaiting review." }, { status: 409 });
    if (message.includes("status") || message.includes("reason")) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Unable to correct attendance." }, { status: 500 });
  }
  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}
