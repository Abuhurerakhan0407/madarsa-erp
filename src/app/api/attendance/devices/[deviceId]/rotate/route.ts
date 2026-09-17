import { NextResponse } from "next/server";
import { rotateAttendanceDeviceToken } from "@/lib/attendance/device-bridge";
import { isJsonRequest, isSameOriginRequest } from "@/lib/security/request";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });
  const deviceId = Number((await params).deviceId);
  if (!Number.isInteger(deviceId) || deviceId <= 0) return NextResponse.json({ error: "Attendance device is invalid." }, { status: 400 });

  try {
    const result = await rotateAttendanceDeviceToken(deviceId);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to rotate attendance device token.";
    if (message.toLowerCase().includes("permission denied")) return NextResponse.json({ error: "Attendance device management permission required." }, { status: 403 });
    if (message.toLowerCase().includes("not found")) return NextResponse.json({ error: "Attendance device was not found in this branch." }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
