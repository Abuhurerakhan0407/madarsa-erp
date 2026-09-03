import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await readBoundedJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const input = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? body.value as Record<string, unknown> : {};
  const tenantId = Number(input.tenantId);
  const dispatchId = Number(input.dispatchId);
  if (!Number.isInteger(tenantId) || tenantId <= 0 || !Number.isInteger(dispatchId) || dispatchId <= 0) {
    return NextResponse.json({ error: "Valid tenant and notification are required." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("mark_portal_notification_read_v1", {
    p_identity_id: identity.id,
    p_tenant_id: tenantId,
    p_dispatch_id: dispatchId
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
