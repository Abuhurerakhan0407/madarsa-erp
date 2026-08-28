import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isJsonRequest, isSameOriginRequest, readBoundedJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedIdentity } from "@/lib/supabase/identity";
import { getTenantContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const identity = await getVerifiedIdentity();
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const workspace = await getTenantContext();
  if (!workspace || workspace.identityId !== identity.id) return NextResponse.json({ error: "Active membership required." }, { status: 403 });
  const body = await readBoundedJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const input = body.value as Record<string, unknown>;
  const enquiryId = Number.isSafeInteger(input?.enquiryId) && Number(input.enquiryId) > 0 ? Number(input.enquiryId) : null;
  const reason = typeof input?.overrideReason === "string" ? input.overrideReason.trim() : null;
  if (!enquiryId || (reason && reason.length > 2000)) return NextResponse.json({ error: "Invalid application request." }, { status: 400 });
  const trackingToken = randomBytes(32).toString("base64url");
  const trackingHash = createHash("sha256").update(trackingToken).digest("hex");
  const { data, error } = await createAdminClient().rpc("start_application_from_enquiry", { p_identity_id: identity.id, p_tenant_id: workspace.tenantId, p_enquiry_id: enquiryId, p_tracking_secret_hash: trackingHash, p_confirm_duplicate: input.confirmDuplicate === true, p_override_reason: reason });
  if (error) {
    if (error.message.includes("permission denied") || error.message.includes("override permission")) return NextResponse.json({ error: "Required admission permission is missing." }, { status: 403 });
    if (error.message.includes("not found")) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    if (error.message.includes("transition") || error.message.includes("missing required")) return NextResponse.json({ error: error.message.includes("missing required") ? "Enquiry lacks fields required by the published form." : "Enquiry changed. Reload and try again." }, { status: 409 });
    return NextResponse.json({ error: "Unable to start application." }, { status: 500 });
  }
  const result = data as { duplicate_review_required?: boolean; application_id?: number; tracking_id?: string } | null;
  if (result?.duplicate_review_required) return NextResponse.json({ result }, { status: 409, headers: { "cache-control": "no-store" } });
  if (!result?.application_id || !result.tracking_id) return NextResponse.json({ error: "Application did not start." }, { status: 500 });
  return NextResponse.json({ result: { ...result, trackingToken } }, { status: 201, headers: { "cache-control": "no-store" } });
}
