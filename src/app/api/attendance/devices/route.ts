import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAttendanceDevice } from "@/lib/attendance/device-bridge";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const parsed = await readBoundedJson(request, 8192);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id || !workspace.branchId) return NextResponse.json({ error: "Active institution membership required." }, { status: 403 });
  try {
    const body = parsed.value as Record<string, unknown>;
    const externalDeviceKey = typeof body.externalDeviceKey === "string" ? body.externalDeviceKey.trim() : "";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const modality = body.modality;
    if (externalDeviceKey.length < 3 || label.length < 2 || modality !== "biometric") return NextResponse.json({ error: "Device configuration is invalid." }, { status: 400 });
    const result = await createAttendanceDevice({ externalDeviceKey, label, modality, vendor: typeof body.vendor === "string" ? body.vendor.trim().slice(0, 120) : null, model: typeof body.model === "string" ? body.model.trim().slice(0, 120) : null });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create attendance device." }, { status: 400 });
  }
}
