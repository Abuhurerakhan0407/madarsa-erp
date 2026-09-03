import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";

function validTenant(value: unknown) {
  const tenantId = Number(value);
  return Number.isInteger(tenantId) && tenantId > 0 ? tenantId : null;
}

async function verifyPortalTenant(identityId: string, tenantId: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("identity_person_links").select("id").eq("tenant_id", tenantId).eq("identity_id", identityId).eq("status", "verified").limit(1);
  return !error && Boolean(data?.length);
}

export async function GET(request: Request) {
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const tenantId = validTenant(new URL(request.url).searchParams.get("tenant"));
  if (!tenantId || !(await verifyPortalTenant(identity.id, tenantId))) return NextResponse.json({ error: "Portal access required." }, { status: 403 });
  const deliveryConfigured = process.env.WEB_PUSH_DELIVERY_ENABLED === "1" && Boolean(process.env.WEB_PUSH_VAPID_PRIVATE_KEY) && Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY);
  return NextResponse.json({
    publicKey: deliveryConfigured ? process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY : null,
    deliveryConfigured
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await readBoundedJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const input = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? body.value as Record<string, unknown> : {};
  const tenantId = validTenant(input.tenantId);
  const subscription = input.subscription && typeof input.subscription === "object" && !Array.isArray(input.subscription) ? input.subscription as Record<string, unknown> : null;
  const deviceLabel = typeof input.deviceLabel === "string" ? input.deviceLabel.slice(0, 120) : null;
  if (!tenantId || !subscription) return NextResponse.json({ error: "Valid tenant and push subscription are required." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("upsert_portal_push_subscription_v1", {
    p_identity_id: identity.id,
    p_tenant_id: tenantId,
    p_subscription: subscription,
    p_device_label: deviceLabel
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await readBoundedJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const input = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? body.value as Record<string, unknown> : {};
  const tenantId = validTenant(input.tenantId);
  const endpoint = typeof input.endpoint === "string" ? input.endpoint : "";
  if (!tenantId || !endpoint || endpoint.length > 2048) return NextResponse.json({ error: "Valid tenant and endpoint are required." }, { status: 400 });
  const endpointHash = createHash("sha256").update(endpoint).digest("hex");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("revoke_portal_push_subscription_v1", {
    p_identity_id: identity.id,
    p_tenant_id: tenantId,
    p_endpoint_hash: endpointHash
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
