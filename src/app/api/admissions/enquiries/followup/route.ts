import { NextResponse } from "next/server";
import { validateCompleteFollowUp } from "@/lib/admissions/enquiry-model";
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
  const validation = validateCompleteFollowUp(body.value);
  if (!validation.value) return NextResponse.json({ error: validation.errors[0] ?? "Invalid follow-up." }, { status: 400 });
  const value = validation.value;
  const { data, error } = await createAdminClient().rpc("record_admission_followup", { p_identity_id: identity.id, p_tenant_id: workspace.tenantId, p_enquiry_id: value.enquiryId, p_channel: value.channel, p_outcome: value.outcome, p_new_status: value.newStatus, p_next_follow_up_at: value.nextFollowUpAt });
  if (error) {
    if (error.message.includes("permission denied")) return NextResponse.json({ error: "Enquiry management permission required." }, { status: 403 });
    if (error.message.includes("not found")) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    if (error.message.includes("transition") || error.message.includes("follow-up required")) return NextResponse.json({ error: "Enquiry changed. Reload and try again." }, { status: 409 });
    return NextResponse.json({ error: "Unable to record follow-up." }, { status: 500 });
  }
  return NextResponse.json({ result: data }, { headers: { "cache-control": "no-store" } });
}
