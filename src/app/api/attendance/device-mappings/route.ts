import { NextResponse } from "next/server";
import { mapAttendanceDeviceSubject } from "@/lib/attendance/device-bridge";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });

  const parsed = await readBoundedJson(request, 8192);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)
    ? parsed.value as Record<string, unknown>
    : {};
  const deviceId = Number(body.deviceId), subjectId = Number(body.subjectId);
  const externalSubjectKey = typeof body.externalSubjectKey === "string" ? body.externalSubjectKey.trim() : "";
  const subjectType = body.subjectType;
  if (!Number.isInteger(deviceId) || deviceId <= 0 || !Number.isInteger(subjectId) || subjectId <= 0 || !externalSubjectKey || (subjectType !== "student" && subjectType !== "staff")) {
    return NextResponse.json({ error: "Device mapping is invalid." }, { status: 400 });
  }
  try {
    const result = await mapAttendanceDeviceSubject({ deviceId, externalSubjectKey, subjectType, subjectId });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to map attendance device subject.";
    if (message.toLowerCase().includes("permission denied")) return NextResponse.json({ error: "Attendance device mapping permission required." }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
