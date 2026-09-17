import { NextResponse } from "next/server";
import { createAttendanceDevice } from "@/lib/attendance/device-bridge";
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
  const externalDeviceKey = typeof body.externalDeviceKey === "string" ? body.externalDeviceKey.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (externalDeviceKey.length < 3 || label.length < 2 || body.modality !== "biometric") {
    return NextResponse.json({ error: "Device configuration is invalid." }, { status: 400 });
  }
  try {
    const result = await createAttendanceDevice({
      externalDeviceKey,
      label,
      modality: "biometric",
      vendor: typeof body.vendor === "string" ? body.vendor.trim().slice(0, 120) : null,
      model: typeof body.model === "string" ? body.model.trim().slice(0, 120) : null
    });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create attendance device.";
    if (message.toLowerCase().includes("permission denied")) return NextResponse.json({ error: "Attendance device management permission required." }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
