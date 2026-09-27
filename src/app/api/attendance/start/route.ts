import { NextResponse } from "next/server";
import { validateAttendanceDate } from "@/lib/attendance/model";
import { getDefaultAttendanceDate } from "@/lib/attendance/workspace";
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
  const date = validateAttendanceDate((body as Record<string, unknown>).date);
  if (!date) return NextResponse.json({ error: "Attendance date is invalid." }, { status: 400 });
  const today = await getDefaultAttendanceDate();
  if (date > today) return NextResponse.json({ error: "Attendance cannot be started for a future date." }, { status: 422 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("ensure_student_daily_attendance", { p_identity_id: identity.id, p_tenant_id: workspace.tenantId, p_branch_id: workspace.branchId, p_attendance_date: date });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("permission denied")) return NextResponse.json({ error: "Attendance marking permission required." }, { status: 403 });
    if (message.includes("academic session") || message.includes("status configuration") || message.includes("active branch")) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to start attendance." }, { status: 500 });
  }
  return NextResponse.json({ result: data }, { status: 200, headers: { "cache-control": "no-store" } });
}
